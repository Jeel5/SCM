// Background jobs service - handles job creation, execution, and scheduling
import pool from '../config/db.js';
import parser from 'cron-parser';

export const jobsService = {
  // Create a new background job; idempotencyKey prevents duplicate processing of the same event.
  async createJob(jobType, payload, priority = 5, scheduledFor = null, createdBy = null, idempotencyKey = null) {
    // Use a CTE so we always get the row back — either the newly inserted one or the
    // existing one (idempotent re-delivery). is_new=false signals a duplicate to callers.
    const result = await pool.query(
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
        createdBy,
        idempotencyKey || null
      ]
    );

    return result.rows[0];
  },

  // Get jobs with filtering and pagination
  async getJobs(filters = {}, page = 1, limit = 20, organizationId = undefined) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramCount = 1;

    // Org filter — applied first so superadmin sees all, org users see their own
    if (organizationId) {
      conditions.push(`j.organization_id = $${paramCount++}`);
      params.push(organizationId);
    }

    if (filters.status) {
      conditions.push(`j.status = $${paramCount++}`);
      params.push(filters.status);
    }

    if (filters.job_type) {
      conditions.push(`j.job_type = $${paramCount++}`);
      params.push(filters.job_type);
    }

    if (filters.priority) {
      conditions.push(`j.priority = $${paramCount++}`);
      params.push(filters.priority);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit, offset);
    const query = `
      SELECT 
        j.*,
        u.name as created_by_name
      FROM background_jobs j
      LEFT JOIN users u ON j.created_by = u.id
      ${whereClause}
      ORDER BY priority ASC, scheduled_for ASC, created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM background_jobs ${whereClause}`;
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const totalCount = parseInt(countResult.rows[0].count);

    return {
      jobs: result.rows,
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
    const orgClause = organizationId ? ' AND j.organization_id = $2' : '';
    const params = organizationId ? [jobId, organizationId] : [jobId];
    const result = await pool.query(
      `SELECT 
        j.*,
        u.name as created_by_name
       FROM background_jobs j
       LEFT JOIN users u ON j.created_by = u.id
       WHERE j.id = $1${orgClause}`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error('Job not found');
    }

    return result.rows[0];
  },

  // Get job execution logs
  async getJobLogs(jobId) {
    const result = await pool.query(
      `SELECT * FROM job_execution_logs
       WHERE job_id = $1
       ORDER BY attempt_number DESC`,
      [jobId]
    );

    return result.rows;
  },

  // Start job execution
  async startJobExecution(jobId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Conditional UPDATE: only transitions jobs that are still pending/retrying.
      // If two workers race on the same jobId, only one gets rowCount > 0; the other
      // receives null and must skip execution to prevent double-processing.
      const claimResult = await client.query(
        `UPDATE background_jobs 
         SET status = 'running', started_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND status IN ('pending', 'retrying')
         RETURNING id`,
        [jobId]
      );

      if (claimResult.rowCount === 0) {
        // Another worker already claimed this job — abort cleanly.
        await client.query('ROLLBACK');
        return null;
      }

      // Log execution start
      const logResult = await client.query(
        `INSERT INTO job_execution_logs 
         (job_id, attempt_number, status, started_at)
         SELECT $1, retry_count + 1, 'started', NOW()
         FROM background_jobs WHERE id = $1
         RETURNING *`,
        [jobId]
      );

      await client.query('COMMIT');
      return logResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Complete job execution
  async completeJobExecution(jobId, logId, result = null) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Update job status
      await client.query(
        `UPDATE background_jobs 
         SET status = 'completed', 
             result = $1, 
             completed_at = NOW(), 
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(result), jobId]
      );

      // Update execution log
      await client.query(
        `UPDATE job_execution_logs 
         SET status = 'completed',
             completed_at = NOW(),
             execution_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
         WHERE id = $1`,
        [logId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Fail job execution
  async failJobExecution(jobId, logId, errorMessage) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get current retry count
      const jobResult = await client.query(
        'SELECT retry_count, max_retries FROM background_jobs WHERE id = $1',
        [jobId]
      );

      const { retry_count, max_retries } = jobResult.rows[0];
      const shouldRetry = retry_count < max_retries;

      // Update job status
      if (shouldRetry) {
        await client.query(
          `UPDATE background_jobs 
           SET status = 'retrying',
               retry_count = retry_count + 1,
               error_message = $1,
               scheduled_for = NOW() + INTERVAL '5 minutes',
               updated_at = NOW()
           WHERE id = $2`,
          [errorMessage, jobId]
        );
      } else {
        await client.query(
          `UPDATE background_jobs 
           SET status = 'failed',
               error_message = $1,
               completed_at = NOW(),
               updated_at = NOW()
           WHERE id = $2`,
          [errorMessage, jobId]
        );
      }

      // Update execution log
      await client.query(
        `UPDATE job_execution_logs 
         SET status = 'failed',
             error_message = $1,
             completed_at = NOW(),
             execution_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
         WHERE id = $2`,
        [errorMessage, logId]
      );

      await client.query('COMMIT');

      return { shouldRetry, nextRetryCount: retry_count + 1 };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Retry a failed job (scoped to org when organizationId provided)
  async retryJob(jobId, organizationId = undefined) {
    const orgClause = organizationId ? ' AND organization_id = $2' : '';
    const params = organizationId ? [jobId, organizationId] : [jobId];
    const result = await pool.query(
      `UPDATE background_jobs 
       SET status = 'pending',
           error_message = NULL,
           scheduled_for = NOW(),
           updated_at = NOW()
       WHERE id = $1${orgClause}
       RETURNING id`,
      params
    );
    if (result.rows.length === 0) throw new Error('Job not found or access denied');
    return await this.getJobById(jobId);
  },

  // Cancel a job (scoped to org when organizationId provided)
  async cancelJob(jobId, organizationId = undefined) {
    const orgClause = organizationId ? ' AND organization_id = $2' : ' ';
    const baseParams = organizationId ? [jobId, organizationId] : [jobId];
    await pool.query(
      `UPDATE background_jobs 
       SET status = 'cancelled',
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND status IN ('pending', 'retrying')${orgClause}`,
      baseParams
    );
    return await this.getJobById(jobId);
  },

  // Get pending jobs for execution
  async getPendingJobs(limit = 10) {
    // FOR UPDATE SKIP LOCKED lets concurrent workers each claim distinct jobs.
    // The lock is advisory in a single-statement auto-commit, so startJobExecution
    // performs a conditional UPDATE (WHERE status IN ('pending','retrying')) as the
    // final race-proof claim gate.
    const result = await pool.query(
      `SELECT * FROM background_jobs
       WHERE status IN ('pending', 'retrying')
         AND scheduled_for <= NOW()
       ORDER BY priority ASC, scheduled_for ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [limit]
    );

    return result.rows;
  },

  // Cron schedules management
  async getCronSchedules() {
    const result = await pool.query(
      `SELECT * FROM cron_schedules
       ORDER BY is_active DESC, name ASC`
    );

    return result.rows;
  },

  async createCronSchedule(name, jobType, cronExpression, payload = {}) {
    // Validate cron expression
    try {
      const interval = parser.parseExpression(cronExpression);
      const nextRun = interval.next().toDate();

      const result = await pool.query(
        `INSERT INTO cron_schedules 
         (name, job_type, cron_expression, payload, next_run_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, jobType, cronExpression, JSON.stringify(payload), nextRun]
      );

      return result.rows[0];
    } catch (error) {
      throw new Error(`Invalid cron expression: ${error.message}`);
    }
  },

  async updateCronSchedule(scheduleId, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.name) {
      fields.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }

    if (updates.cron_expression) {
      // Validate new cron expression
      const interval = parser.parseExpression(updates.cron_expression);
      const nextRun = interval.next().toDate();
      
      fields.push(`cron_expression = $${paramCount++}`);
      values.push(updates.cron_expression);
      fields.push(`next_run_at = $${paramCount++}`);
      values.push(nextRun);
    }

    if (updates.payload !== undefined) {
      fields.push(`payload = $${paramCount++}`);
      values.push(JSON.stringify(updates.payload));
    }

    if (updates.is_active !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(updates.is_active);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push(`updated_at = NOW()`);
    values.push(scheduleId);

    const query = `
      UPDATE cron_schedules 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Schedule not found');
    }

    return result.rows[0];
  },

  async deleteCronSchedule(scheduleId) {
    await pool.query('DELETE FROM cron_schedules WHERE id = $1', [scheduleId]);
  },

  // Get due cron schedules
  async getDueCronSchedules() {
    const result = await pool.query(
      `SELECT * FROM cron_schedules
       WHERE is_active = true
         AND next_run_at <= NOW()
       ORDER BY next_run_at ASC`
    );

    return result.rows;
  },

  // Update last run time for cron schedule
  async updateCronLastRun(scheduleId) {
    const result = await pool.query(
      'SELECT cron_expression FROM cron_schedules WHERE id = $1',
      [scheduleId]
    );

    if (result.rows.length === 0) {
      throw new Error('Schedule not found');
    }

    const interval = parser.parseExpression(result.rows[0].cron_expression);
    const nextRun = interval.next().toDate();

    await pool.query(
      `UPDATE cron_schedules 
       SET last_run_at = NOW(), next_run_at = $1, updated_at = NOW()
       WHERE id = $2`,
      [nextRun, scheduleId]
    );
  },

  // Dead Letter Queue Management
  async moveToDeadLetterQueue(jobId, errorMessage) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get the job details
      const jobResult = await client.query(
        'SELECT * FROM background_jobs WHERE id = $1',
        [jobId]
      );
      
      if (jobResult.rows.length === 0) {
        throw new Error('Job not found');
      }
      
      const job = jobResult.rows[0];
      
      // Insert into dead letter queue
      await client.query(
        `INSERT INTO dead_letter_queue 
         (original_job_id, job_type, payload, priority, error_message, retry_count, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          job.id,
          job.job_type,
          job.payload,
          job.priority,
          errorMessage,
          job.retry_count,
          job.created_at
        ]
      );
      
      // Update job status
      await client.query(
        `UPDATE background_jobs 
         SET status = 'dead_letter', error_message = $2, updated_at = NOW()
         WHERE id = $1`,
        [jobId, errorMessage]
      );
      
      await client.query('COMMIT');
      
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async getDeadLetterQueue(page = 1, limit = 20, organizationId = undefined) {
    const offset = (page - 1) * limit;
    const orgJoin = organizationId
      ? `JOIN background_jobs bj ON bj.id = dlq.original_job_id AND bj.organization_id = $3`
      : '';
    const params = organizationId ? [limit, offset, organizationId] : [limit, offset];
    
    const result = await pool.query(
      `SELECT dlq.* FROM dead_letter_queue dlq
       ${orgJoin}
       ORDER BY dlq.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );
    
    const countParams = organizationId ? [organizationId] : [];
    const countWhere = organizationId
      ? `JOIN background_jobs bj ON bj.id = dlq.original_job_id AND bj.organization_id = $1`
      : '';
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM dead_letter_queue dlq ${countWhere}`,
      countParams
    );
    const totalCount = parseInt(countResult.rows[0].count);
    
    return {
      jobs: result.rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  },

  async retryFromDeadLetterQueue(dlqId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get the dead letter job
      const dlqResult = await client.query(
        'SELECT * FROM dead_letter_queue WHERE id = $1',
        [dlqId]
      );
      
      if (dlqResult.rows.length === 0) {
        throw new Error('Dead letter job not found');
      }
      
      const dlqJob = dlqResult.rows[0];
      
      // Create a new job
      const newJobResult = await client.query(
        `INSERT INTO background_jobs 
         (job_type, payload, priority, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING *`,
        [dlqJob.job_type, dlqJob.payload, dlqJob.priority]
      );
      
      // Remove from dead letter queue
      await client.query(
        'DELETE FROM dead_letter_queue WHERE id = $1',
        [dlqId]
      );
      
      await client.query('COMMIT');
      
      return newJobResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async purgeDeadLetterQueue(olderThanDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = await pool.query(
      'DELETE FROM dead_letter_queue WHERE created_at < $1',
      [cutoffDate]
    );
    
    return result.rowCount;
  }
};
