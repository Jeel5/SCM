// Background jobs service - handles job creation, execution, and scheduling
import jobsRepo from '../repositories/JobsRepository.js';
import { withTransaction } from '../utils/dbTransaction.js';
import parser from 'cron-parser';
import { NotFoundError, ValidationError } from '../errors/index.js';

export const jobsService = {
  // Create a new background job; idempotencyKey prevents duplicate processing of the same event.
  async createJob(jobType, payload, priority = 5, scheduledFor = null, createdBy = null, idempotencyKey = null) {
    return jobsRepo.createJobIdempotent({ jobType, payload, priority, scheduledFor, createdBy, idempotencyKey });
  },

  // Get jobs with filtering and pagination
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

  // Get job by ID (with optional org scope)
  async getJobById(jobId, organizationId = undefined) {
    return jobsRepo.getJobById(jobId, organizationId);
  },

  // Get job execution logs
  async getJobLogs(jobId) {
    return jobsRepo.getJobLogs(jobId);
  },

  // Start job execution
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

  // Complete job execution
  async completeJobExecution(jobId, logId, result = null) {
    return withTransaction(async (tx) => {
      await jobsRepo.completeJob(jobId, result, tx);
      await jobsRepo.completeExecutionLog(logId, tx);
    });
  },

  // Fail job execution
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

  // Retry a failed job (scoped to org when organizationId provided)
  async retryJob(jobId, organizationId = undefined) {
    const row = await jobsRepo.resetJobToPending(jobId, organizationId);
    if (!row) throw new NotFoundError('Job');
    return jobsRepo.getJobById(jobId);
  },

  // Cancel a job (scoped to org when organizationId provided)
  async cancelJob(jobId, organizationId = undefined) {
    await jobsRepo.cancelJob(jobId, organizationId);
    return jobsRepo.getJobById(jobId);
  },

  // Get pending jobs for execution
  async getPendingJobs(limit = 10) {
    return jobsRepo.getPendingJobs(limit);
  },

  // Cron schedules management
  async getCronSchedules(organizationId = undefined) {
    return jobsRepo.getCronSchedules(organizationId);
  },

  async createCronSchedule(name, jobType, cronExpression, payload = {}, organizationId = undefined) {
    try {
      const interval = parser.parseExpression(cronExpression);
      const nextRun = interval.next().toDate();
      return jobsRepo.createCronSchedule({ name, jobType, cronExpression, payload, nextRun, organizationId });
    } catch (error) {
      throw new ValidationError(`Invalid cron expression: ${error.message}`);
    }
  },

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
    return updated;
  },

  async deleteCronSchedule(scheduleId, organizationId = undefined) {
    return jobsRepo.deleteCronSchedule(scheduleId, organizationId);
  },

  // Get due cron schedules
  async getDueCronSchedules() {
    return jobsRepo.getDueCronSchedules();
  },

  // Update last run time for cron schedule
  async updateCronLastRun(scheduleId) {
    const cronExpression = await jobsRepo.getCronExpression(scheduleId);
    if (!cronExpression) throw new NotFoundError('Schedule');

    const interval = parser.parseExpression(cronExpression);
    const nextRun = interval.next().toDate();
    await jobsRepo.updateCronLastRun(scheduleId, nextRun);
  },

  // Dead Letter Queue Management
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

  async purgeDeadLetterQueue(olderThanDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    return jobsRepo.purgeDlq(cutoffDate);
  }
};

