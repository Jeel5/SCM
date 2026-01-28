// Jobs Controller - handles background job management
import pool from '../configs/db.js';

// Get jobs list with filters and pagination
export async function listJobs(req, res) {
  try {
    const { page = 1, limit = 20, status, jobType } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM jobs WHERE 1=1';
    const params = [];
    
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    if (jobType) {
      params.push(jobType);
      query += ` AND job_type = $${params.length}`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await pool.query(query, params);
    
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM jobs WHERE 1=1' + 
      (status ? ' AND status = $1' : '') +
      (jobType ? ` AND job_type = $${status ? '2' : '1'}` : ''),
      [status, jobType].filter(Boolean)
    );
    
    res.json({
      success: true,
      data: result.rows.map(j => ({
        id: j.id,
        jobType: j.job_type,
        status: j.status,
        priority: j.priority,
        payload: j.payload,
        result: j.result,
        error: j.error,
        attempts: j.attempts,
        maxAttempts: j.max_attempts,
        scheduledAt: j.scheduled_at,
        startedAt: j.started_at,
        completedAt: j.completed_at,
        createdAt: j.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count)
      }
    });
  } catch (error) {
    console.error('List jobs error:', error);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
}

export async function getJob(req, res) {
  try {
    const { id } = req.params;
    
    const result = await pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const j = result.rows[0];
    res.json({
      success: true,
      data: {
        id: j.id,
        jobType: j.job_type,
        status: j.status,
        priority: j.priority,
        payload: j.payload,
        result: j.result,
        error: j.error,
        attempts: j.attempts,
        maxAttempts: j.max_attempts,
        scheduledAt: j.scheduled_at,
        startedAt: j.started_at,
        completedAt: j.completed_at,
        createdAt: j.created_at
      }
    });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Failed to get job' });
  }
}

export async function createJob(req, res) {
  try {
    const { jobType, priority = 'normal', payload, scheduledAt } = req.body;
    
    const result = await pool.query(
      `INSERT INTO jobs (job_type, priority, payload, scheduled_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [jobType, priority, JSON.stringify(payload), scheduledAt || null]
    );
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
}

export async function cancelJob(req, res) {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE jobs SET status = 'cancelled' WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found or cannot be cancelled' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Cancel job error:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
}

export async function retryJob(req, res) {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE jobs SET status = 'pending', attempts = 0, error = NULL 
       WHERE id = $1 AND status = 'failed' RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found or cannot be retried' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Retry job error:', error);
    res.status(500).json({ error: 'Failed to retry job' });
  }
}

export async function getJobStats(req, res) {
  try {
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
      FROM jobs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);
    
    const byTypeResult = await pool.query(`
      SELECT job_type, COUNT(*) as count
      FROM jobs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY job_type
    `);
    
    const stats = statsResult.rows[0];
    
    res.json({
      success: true,
      data: {
        total: parseInt(stats.total_jobs),
        byStatus: {
          pending: parseInt(stats.pending),
          processing: parseInt(stats.processing),
          completed: parseInt(stats.completed),
          failed: parseInt(stats.failed),
          cancelled: parseInt(stats.cancelled)
        },
        byType: byTypeResult.rows.map(t => ({
          type: t.job_type,
          count: parseInt(t.count)
        }))
      }
    });
  } catch (error) {
    console.error('Get job stats error:', error);
    res.status(500).json({ error: 'Failed to get job stats' });
  }
}
