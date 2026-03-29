// Jobs Repository - all SQL for background_jobs, cron_schedules and dead_letter_queue.
import BaseRepository from './BaseRepository.js';
import { NotFoundError } from '../errors/index.js';

class JobsRepository extends BaseRepository {
  constructor() {
    super('background_jobs');
  }

  // ── Background jobs ──────────────────────────────────────────────────────────

  /**
   * Insert a job with idempotency-key support (ON CONFLICT DO NOTHING + UNION re-select).
   */
  async createJobIdempotent({ jobType, payload, priority, scheduledFor, createdBy, idempotencyKey }, client = null) {
    const result = await this.query(
      `WITH ins AS (
         INSERT INTO background_jobs
           (job_type, payload, priority, scheduled_for, created_by, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
         RETURNING *, TRUE AS is_new
       )
       SELECT * FROM ins
       UNION ALL
       SELECT *, FALSE AS is_new
         FROM background_jobs
        WHERE idempotency_key = $6
          AND idempotency_key IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM ins)`,
      [
        jobType,
        JSON.stringify(payload),
        priority,
        scheduledFor || new Date(),
        createdBy || null,
        idempotencyKey || null,
      ],
      client
    );
    return result.rows[0];
  }

  /**
   * Paginated list of jobs with optional filters; also JOIN users for created_by_name.
   */
  async getJobs({ status, job_type, priority } = {}, page = 1, limit = 20, organizationId = undefined, client = null) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let pc = 1;

    if (organizationId) { conditions.push(`j.organization_id = $${pc}`); params.push(organizationId); }
    pc += 1;
    if (status)         { conditions.push(`j.status = $${pc}`);          params.push(status); }
    pc += 1;
    if (job_type)       { conditions.push(`j.job_type = $${pc}`);        params.push(job_type); }
    pc += 1;
    if (priority)       { conditions.push(`j.priority = $${pc}`);        params.push(priority); }
    pc += 1;

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // total_count via window so we only need one round-trip
    params.push(limit, offset);
    const result = await this.query(
      `SELECT j.*, u.name AS created_by_name, COUNT(*) OVER() AS total_count
       FROM background_jobs j
       LEFT JOIN users u ON j.created_by = u.id
       ${where}
       ORDER BY j.priority ASC, j.scheduled_for ASC, j.created_at DESC
       LIMIT $${pc} OFFSET $${pc}`,
       pc += 2;
      params, client
    );

    const rows = result.rows;
    const totalCount = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
    return { jobs: rows, totalCount };
  }

  /**
   * Fetch a single job by id, optionally scoped to an org.
   */
  async getJobById(jobId, organizationId = undefined, client = null) {
    const orgClause = organizationId ? ' AND j.organization_id = $2' : '';
    const params = organizationId ? [jobId, organizationId] : [jobId];
    const result = await this.query(
      `SELECT j.*, u.name AS created_by_name
       FROM background_jobs j
       LEFT JOIN users u ON j.created_by = u.id
       WHERE j.id = $1${orgClause}`,
      params, client
    );
    if (!result.rows[0]) throw new NotFoundError('Job');
    return result.rows[0];
  }

  /**
   * Get execution log entries for a job.
   */
  async getJobLogs(jobId, client = null) {
    const result = await this.query(
      `SELECT * FROM job_execution_logs WHERE job_id = $1 ORDER BY attempt_number DESC`,
      [jobId], client
    );
    return result.rows;
  }

  /**
   * Atomic job claim: only transitions jobs in pending/retrying status.
   * Returns the updated row (id only), or null if another worker already claimed it.
   */
  async claimJob(jobId, client = null) {
    const result = await this.query(
      `UPDATE background_jobs
       SET status = 'running', started_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status IN ('pending', 'retrying')
       RETURNING id`,
      [jobId], client
    );
    return result.rows[0] || null;
  }

  /**
   * Insert an execution_log row for the current attempt.
   */
  async insertExecutionLog(jobId, client = null) {
    const result = await this.query(
      `INSERT INTO job_execution_logs (job_id, attempt_number, status, started_at)
       SELECT $1, retry_count + 1, 'started', NOW()
       FROM background_jobs WHERE id = $1
       RETURNING *`,
      [jobId], client
    );
    return result.rows[0];
  }

  /**
   * Mark a job as completed (with optional result payload).
   */
  async completeJob(jobId, result = null, client = null) {
    await this.query(
      `UPDATE background_jobs
       SET status = 'completed', result = $1, completed_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(result), jobId], client
    );
  }

  /**
   * Mark an execution log row as completed.
   */
  async completeExecutionLog(logId, client = null) {
    await this.query(
      `UPDATE job_execution_logs
       SET status = 'completed',
           completed_at = NOW(),
           execution_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
       WHERE id = $1`,
      [logId], client
    );
  }

  /**
   * Return retry_count and max_retries for a job (used in failJobExecution).
   */
  async getJobRetryInfo(jobId, client = null) {
    const result = await this.query(
      'SELECT retry_count, max_retries FROM background_jobs WHERE id = $1',
      [jobId], client
    );
    return result.rows[0] || null;
  }

  /**
   * Schedule a retry: increment retry_count and postpone scheduled_for 5 minutes.
   */
  async scheduleJobRetry(jobId, errorMessage, client = null) {
    await this.query(
      `UPDATE background_jobs
       SET status = 'retrying',
           retry_count = retry_count + 1,
           error_message = $1,
           scheduled_for = NOW() + INTERVAL '5 minutes',
           updated_at = NOW()
       WHERE id = $2`,
      [errorMessage, jobId], client
    );
  }

  /**
   * Mark a job as permanently failed.
   */
  async failJob(jobId, errorMessage, client = null) {
    await this.query(
      `UPDATE background_jobs
       SET status = 'failed', error_message = $1, completed_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [errorMessage, jobId], client
    );
  }

  /**
   * Mark an execution log row as failed.
   */
  async failExecutionLog(logId, errorMessage, client = null) {
    await this.query(
      `UPDATE job_execution_logs
       SET status = 'failed',
           error_message = $1,
           completed_at = NOW(),
           execution_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
       WHERE id = $2`,
      [errorMessage, logId], client
    );
  }

  /**
   * Reset a failed/cancelled job back to pending for immediate re-execution.
   */
  async resetJobToPending(jobId, organizationId = undefined, client = null) {
    const orgClause = organizationId ? ' AND organization_id = $2' : '';
    const params = organizationId ? [jobId, organizationId] : [jobId];
    const result = await this.query(
      `UPDATE background_jobs
       SET status = 'pending', error_message = NULL, scheduled_for = NOW(), updated_at = NOW()
       WHERE id = $1${orgClause}
       RETURNING id`,
      params, client
    );
    return result.rows[0] || null;
  }

  /**
   * Cancel a pending/retrying job.
   */
  async cancelJob(jobId, organizationId = undefined, client = null) {
    const orgClause = organizationId ? ' AND organization_id = $2' : '';
    const params = organizationId ? [jobId, organizationId] : [jobId];
    await this.query(
      `UPDATE background_jobs
       SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status IN ('pending', 'retrying')${orgClause}`,
      params, client
    );
  }

  /**
   * Fetch jobs ready to be picked up by the worker loop (SKIP LOCKED advisory).
   */
  async getPendingJobs(limit = 10, client = null) {
    const result = await this.query(
      `SELECT * FROM background_jobs
       WHERE status IN ('pending', 'retrying') AND scheduled_for <= NOW()
       ORDER BY priority ASC, scheduled_for ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [limit], client
    );
    return result.rows;
  }

  // ── Cron schedules ───────────────────────────────────────────────────────────

  /**
   * List cron schedules, optionally scoped to an organization.
   */
  async getCronSchedules(organizationId = undefined, client = null) {
    const orgClause = organizationId ? ' WHERE organization_id = $1' : '';
    const params    = organizationId ? [organizationId] : [];
    const result = await this.query(
      `SELECT * FROM cron_schedules${orgClause} ORDER BY is_active DESC, name ASC`,
      params, client
    );
    return result.rows;
  }

  /**
   * Create a cron schedule used by the scheduler loop.
   */
  async createCronSchedule({ name, jobType, cronExpression, payload, nextRun, organizationId } = {}, client = null) {
    const result = await this.query(
      `INSERT INTO cron_schedules (name, job_type, cron_expression, payload, next_run_at, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, jobType, cronExpression, JSON.stringify(payload || {}), nextRun, organizationId || null], client
    );
    return result.rows[0];
  }

  /**
   * Update mutable cron schedule fields and bump updated_at.
   */
  async updateCronSchedule(scheduleId, fields, organizationId = undefined, client = null) {
    const setClauses = Object.keys(fields).map((k, i) => `${k} = $${i + 1}`);
    if (!setClauses.length) return null;
    setClauses.push('updated_at = NOW()');
    const params = [...Object.values(fields), scheduleId];
    const orgClause = organizationId ? ` AND organization_id = $${params.length + 1}` : '';
    if (organizationId) params.push(organizationId);
    const result = await this.query(
      `UPDATE cron_schedules SET ${setClauses.join(', ')}
       WHERE id = $${params.length - (organizationId ? 1 : 0)}${orgClause}
       RETURNING *`,
      params, client
    );
    return result.rows[0] || null;
  }

  /**
   * Delete a cron schedule by id, optionally constrained to an organization.
   */
  async deleteCronSchedule(scheduleId, organizationId = undefined, client = null) {
    const orgClause = organizationId ? ' AND organization_id = $2' : '';
    const params    = organizationId ? [scheduleId, organizationId] : [scheduleId];
    await this.query(`DELETE FROM cron_schedules WHERE id = $1${orgClause}`, params, client);
  }

  /**
   * Return active schedules that are due to run now.
   */
  async getDueCronSchedules(client = null) {
    const result = await this.query(
      `SELECT * FROM cron_schedules WHERE is_active = true AND next_run_at <= NOW() ORDER BY next_run_at ASC`,
      [], client
    );
    return result.rows;
  }

  /**
   * Fetch cron expression text for a single schedule.
   */
  async getCronExpression(scheduleId, client = null) {
    const result = await this.query(
      'SELECT cron_expression FROM cron_schedules WHERE id = $1',
      [scheduleId], client
    );
    return result.rows[0]?.cron_expression || null;
  }

  /**
   * Persist last_run_at and next_run_at after schedule execution.
   */
  async updateCronLastRun(scheduleId, nextRun, client = null) {
    await this.query(
      `UPDATE cron_schedules SET last_run_at = NOW(), next_run_at = $1, updated_at = NOW() WHERE id = $2`,
      [nextRun, scheduleId], client
    );
  }

  // ── Dead Letter Queue ─────────────────────────────────────────────────────────

  /**
   * Find a background job by id.
   */
  async findJob(jobId, client = null) {
    const result = await this.query('SELECT * FROM background_jobs WHERE id = $1', [jobId], client);
    return result.rows[0] || null;
  }

  /**
   * Insert a dead-letter queue record for a failed job.
   */
  async insertDlqEntry({ originalJobId, jobType, payload, priority, errorMessage, retryCount, createdAt } = {}, client = null) {
    await this.query(
      `INSERT INTO dead_letter_queue
         (original_job_id, job_type, payload, priority, error_message, retry_count, original_created_at, moved_to_dlq_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [originalJobId, jobType, payload, priority, errorMessage, retryCount, createdAt], client
    );
  }

  /**
   * Mark a background job as moved to dead-letter status.
   */
  async markJobDeadLetter(jobId, errorMessage, client = null) {
    await this.query(
      `UPDATE background_jobs SET status = 'dead_letter', error_message = $2, updated_at = NOW() WHERE id = $1`,
      [jobId, errorMessage], client
    );
  }

  /**
   * Fetch one dead-letter queue entry by id.
   */
  async getDlqEntry(dlqId, client = null) {
    const result = await this.query('SELECT * FROM dead_letter_queue WHERE id = $1', [dlqId], client);
    return result.rows[0] || null;
  }

  /**
   * Resolve organization id for the original job referenced by a DLQ entry.
   */
  async getOriginalJobOrgId(originalJobId, client = null) {
    const result = await this.query(
      'SELECT organization_id FROM background_jobs WHERE id = $1',
      [originalJobId], client
    );
    return result.rows[0]?.organization_id || null;
  }

  /**
   * Create a background job row without idempotency handling.
   */
  async createJob({ jobType, payload, priority, status = 'pending', organizationId } = {}, client = null) {
    const result = await this.query(
      `INSERT INTO background_jobs (job_type, payload, priority, status, organization_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [jobType, payload, priority, status, organizationId || null], client
    );
    return result.rows[0];
  }

  /**
   * Mark a DLQ entry as reprocessed and attach the replacement job id.
   */
  async markDlqReprocessed(dlqId, newJobId, client = null) {
    await this.query(
      `UPDATE dead_letter_queue
       SET reprocessed = true, reprocessed_at = NOW(), reprocessed_job_id = $1
       WHERE id = $2`,
      [newJobId, dlqId], client
    );
  }

  /**
   * Return paginated dead-letter queue items with total count.
   */
  async getDeadLetterQueue({ page = 1, limit = 20, organizationId } = {}, client = null) {
    const offset = (page - 1) * limit;
    const orgJoin = organizationId
      ? `JOIN background_jobs bj ON bj.id = dlq.original_job_id AND bj.organization_id = $3`
      : '';
    const params = organizationId ? [limit, offset, organizationId] : [limit, offset];

    const result = await this.query(
      `SELECT dlq.*, COUNT(*) OVER() AS total_count
       FROM dead_letter_queue dlq
       ${orgJoin}
       ORDER BY dlq.moved_to_dlq_at DESC
       LIMIT $1 OFFSET $2`,
      params, client
    );
    const rows = result.rows;
    const totalCount = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
    return { jobs: rows, totalCount };
  }

  /**
   * Permanently delete DLQ rows older than the provided cutoff timestamp.
   */
  async purgeDlq(cutoffDate, client = null) {
    const result = await this.query(
      'DELETE FROM dead_letter_queue WHERE moved_to_dlq_at < $1',
      [cutoffDate], client
    );
    return result.rowCount;
  }

  /**
   * Aggregate job statistics for the last 24 hours, grouped by status.
   * Returns an array of { status, count, avg_execution_time_seconds }.
   */
  async getJobStats(client = null) {
    const result = await this.query(
      `SELECT status,
              COUNT(*) AS count,
              AVG(CASE
                WHEN completed_at IS NOT NULL AND started_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (completed_at - started_at))
                ELSE NULL
              END) AS avg_execution_time_seconds
       FROM background_jobs
       WHERE created_at > NOW() - INTERVAL '24 hours'
       GROUP BY status`,
      [], client
    );
    return result.rows;
  }

  /**
   * Delete job execution logs older than a given date.
   */
  async deleteOldLogs(cutoffDate, client = null) {
    const result = await this.query(
      'DELETE FROM job_execution_logs WHERE created_at < $1',
      [cutoffDate], client
    );
    return result.rowCount;
  }

  /**
   * Delete completed background jobs older than a given date.
   */
  async deleteCompletedBefore(cutoffDate, client = null) {
    const result = await this.query(
      `DELETE FROM background_jobs
       WHERE status = 'completed'
       AND completed_at < $1`,
      [cutoffDate], client
    );
    return result.rowCount;
  }
}

export default new JobsRepository();
