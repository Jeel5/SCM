// Background jobs service - handles job creation, execution, and scheduling
import jobsRepo from '../repositories/JobsRepository.js';
import { withTransaction } from '../utils/dbTransaction.js';
import parser from 'cron-parser';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { enqueueJob } from '../queues/index.js';
import { cronScheduler } from '../jobs/cronScheduler.js';
import logger from '../utils/logger.js';

export const jobsService = {
  /**
   * Create a background job and enqueue it for worker processing.
   * Idempotency keys prevent duplicate inserts for repeated webhook/event inputs.
   */
  async createJob(jobType, payload, priority = 5, scheduledFor = null, createdBy = null, idempotencyKey = null) {
    const dbJob = await jobsRepo.createJobIdempotent({ jobType, payload, priority, scheduledFor, createdBy, idempotencyKey });

    // Calculate delay from scheduledFor
    const delay = scheduledFor ? Math.max(0, new Date(scheduledFor).getTime() - Date.now()) : 0;

    // Enqueue in BullMQ (fails silently if Redis is down — DB record still exists
    // and can be processed manually via retryJob)
    try {
      await enqueueJob(jobType, dbJob.id, dbJob.payload, { priority, delay });
    } catch (err) {
      // Non-fatal: job is in DB, worker will retry via queue on reconnect
      logger.warn('[jobsService] BullMQ enqueue failed; job remains in DB for retry', {
        jobId: dbJob.id,
        jobType,
        error: err.message,
      });
    }

    return dbJob;
  },

  /**
   * Return filtered jobs with pagination metadata.
   */
  async getJobs(filters = {}, page = 1, limit = 20, organizationId = undefined) {
    const { jobs, totalCount } = await jobsRepo.getJobs(filters, page, limit, organizationId);
    return {
      jobs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  },

  /**
   * Get a single background job by id.
   */
  async getJobById(jobId, organizationId = undefined) {
    return jobsRepo.getJobById(jobId, organizationId);
  },

  /**
   * Fetch execution attempts for a job.
   */
  async getJobLogs(jobId) {
    return jobsRepo.getJobLogs(jobId);
  },

  /**
   * Claim a job for execution and create a corresponding execution log row.
   */
  async startJobExecution(jobId) {
    return withTransaction(async (tx) => {
      // Conditional UPDATE: only transitions jobs that are still pending/retrying.
      // If two workers race on the same jobId, only one gets a row back; the other
      // receives null and must skip execution to prevent double-processing.
      const claimed = await jobsRepo.claimJob(jobId, tx);
      if (!claimed) return null;

      return jobsRepo.insertExecutionLog(jobId, tx);
    });
  },

  /**
   * Mark both job and execution log as completed.
   */
  async completeJobExecution(jobId, logId, result = null) {
    return withTransaction(async (tx) => {
      await jobsRepo.completeJob(jobId, result, tx);
      await jobsRepo.completeExecutionLog(logId, tx);
    });
  },

  /**
   * Fail an execution attempt and either schedule retry or mark job failed.
   */
  async failJobExecution(jobId, logId, errorMessage) {
    return withTransaction(async (tx) => {
      const retryInfo = await jobsRepo.getJobRetryInfo(jobId, tx);
      const { retry_count, max_retries } = retryInfo;
      const shouldRetry = retry_count < max_retries;

      if (shouldRetry) {
        await jobsRepo.scheduleJobRetry(jobId, errorMessage, tx);
      } else {
        await jobsRepo.failJob(jobId, errorMessage, tx);
      }

      await jobsRepo.failExecutionLog(logId, errorMessage, tx);

      return { shouldRetry, nextRetryCount: retry_count + 1 };
    });
  },

  /**
   * Reset a failed/cancelled job to pending so workers can retry it.
   */
  async retryJob(jobId, organizationId = undefined) {
    const row = await jobsRepo.resetJobToPending(jobId, organizationId);
    if (!row) throw new NotFoundError('Job');
    return jobsRepo.getJobById(jobId);
  },

  /**
   * Cancel a pending/retrying job.
   */
  async cancelJob(jobId, organizationId = undefined) {
    await jobsRepo.cancelJob(jobId, organizationId);
    return jobsRepo.getJobById(jobId);
  },

  /**
   * Get jobs ready for immediate worker pickup.
   */
  async getPendingJobs(limit = 10) {
    return jobsRepo.getPendingJobs(limit);
  },

  /**
   * List cron schedules for an organization.
   */
  async getCronSchedules(organizationId = undefined) {
    return jobsRepo.getCronSchedules(organizationId);
  },

  /**
   * Validate and create a cron schedule, then register it with the scheduler.
   */
  async createCronSchedule(name, jobType, cronExpression, payload = {}, organizationId = undefined) {
    try {
      const interval = parser.parseExpression(cronExpression);
      const nextRun = interval.next().toDate();
      const schedule = await jobsRepo.createCronSchedule({ name, jobType, cronExpression, payload, nextRun, organizationId });
      // Register in BullMQ so it fires at the right time
      await cronScheduler.addSchedule(schedule);
      return schedule;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ValidationError(`Invalid cron expression: ${error.message}`);
    }
  },

  /**
   * Update cron schedule fields and synchronize runtime scheduler state.
   */
  async updateCronSchedule(scheduleId, updates, organizationId = undefined) {
    const fields = {};

    if (updates.name) fields.name = updates.name;

    if (updates.cron_expression) {
      try {
        const interval = parser.parseExpression(updates.cron_expression);
        fields.cron_expression = updates.cron_expression;
        fields.next_run_at = interval.next().toDate();
      } catch (error) {
        throw new ValidationError(`Invalid cron expression: ${error.message}`);
      }
    }

    if (updates.payload !== undefined) fields.payload = JSON.stringify(updates.payload);
    if (updates.is_active !== undefined) fields.is_active = updates.is_active;

    if (Object.keys(fields).length === 0) throw new ValidationError('No fields to update');

    const updated = await jobsRepo.updateCronSchedule(scheduleId, fields, organizationId);
    if (!updated) throw new NotFoundError('Schedule');
    // Sync change to BullMQ (remove old repeatable + add new if active)
    await cronScheduler.updateSchedule(updated);
    return updated;
  },

  /**
   * Delete a cron schedule and unregister it from runtime scheduler.
   */
  async deleteCronSchedule(scheduleId, organizationId = undefined) {
    await jobsRepo.deleteCronSchedule(scheduleId, organizationId);
    // Remove from BullMQ so it stops firing
    await cronScheduler.removeSchedule(scheduleId);
  },

  /**
   * Get active cron schedules that are due now.
   */
  async getDueCronSchedules() {
    return jobsRepo.getDueCronSchedules();
  },

  /**
   * Recompute next_run_at from cron expression and persist last/next run markers.
   */
  async updateCronLastRun(scheduleId) {
    const cronExpression = await jobsRepo.getCronExpression(scheduleId);
    if (!cronExpression) throw new NotFoundError('Schedule');

    const interval = parser.parseExpression(cronExpression);
    const nextRun = interval.next().toDate();
    await jobsRepo.updateCronLastRun(scheduleId, nextRun);
  },

  /**
   * Move a terminally failed job to the dead-letter queue.
   */
  async moveToDeadLetterQueue(jobId, errorMessage) {
    return withTransaction(async (tx) => {
      const job = await jobsRepo.findJob(jobId, tx);
      if (!job) throw new NotFoundError('Job');

      await jobsRepo.insertDlqEntry({
        originalJobId: job.id,
        jobType: job.job_type,
        payload: job.payload,
        priority: job.priority,
        errorMessage,
        retryCount: job.retry_count,
        createdAt: job.created_at,
      }, tx);

      await jobsRepo.markJobDeadLetter(jobId, errorMessage, tx);
      return true;
    });
  },

  /**
   * Return paginated dead-letter queue rows.
   */
  async getDeadLetterQueue(page = 1, limit = 20, organizationId = undefined) {
    const { jobs, totalCount } = await jobsRepo.getDeadLetterQueue({ page, limit, organizationId });
    return {
      jobs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  },

  /**
   * Requeue a dead-letter job as a new pending background job.
   */
  async retryFromDeadLetterQueue(dlqId) {
    return withTransaction(async (tx) => {
      const dlqJob = await jobsRepo.getDlqEntry(dlqId, tx);
      if (!dlqJob) throw new NotFoundError('Dead letter job');

      // Preserve the original org scope on the requeued job
      const orgId = await jobsRepo.getOriginalJobOrgId(dlqJob.original_job_id, tx);

      const newJob = await jobsRepo.createJob({
        jobType: dlqJob.job_type,
        payload: dlqJob.payload,
        priority: dlqJob.priority,
        status: 'pending',
        organizationId: orgId,
      }, tx);

      await jobsRepo.markDlqReprocessed(dlqId, newJob.id, tx);
      return newJob;
    });
  },

  /**
   * Delete old dead-letter rows older than N days.
   */
  async purgeDeadLetterQueue(olderThanDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    return jobsRepo.purgeDlq(cutoffDate);
  }
};

