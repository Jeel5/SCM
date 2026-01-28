// Background jobs controller - manages job creation, monitoring, and scheduling
import { jobsService } from '../services/jobsService.js';

// Get all jobs with filtering
export async function listJobs(req, res) {
  try {
    const { status, job_type, priority, page = 1, limit = 20 } = req.query;
    
    const filters = {};
    if (status) filters.status = status;
    if (job_type) filters.job_type = job_type;
    if (priority) filters.priority = parseInt(priority);

    const result = await jobsService.getJobs(filters, parseInt(page), parseInt(limit));
    
    res.json({
      success: true,
      data: result.jobs,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('List jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
}

// Get job details by ID
export async function getJobDetails(req, res) {
  try {
    const { id } = req.params;
    const job = await jobsService.getJobById(id);
    const logs = await jobsService.getJobLogs(id);
    
    res.json({
      success: true,
      data: {
        ...job,
        execution_logs: logs
      }
    });
  } catch (error) {
    console.error('Get job details error:', error);
    
    if (error.message === 'Job not found') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to fetch job details' });
  }
}

// Create a new background job
export async function createJob(req, res) {
  try {
    const { job_type, payload, priority, scheduled_for } = req.body;
    const userId = req.user?.userId;

    if (!job_type) {
      return res.status(400).json({ error: 'job_type is required' });
    }

    const job = await jobsService.createJob(
      job_type,
      payload || {},
      priority || 5,
      scheduled_for,
      userId
    );
    
    res.status(201).json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
}

// Retry a failed job
export async function retryJob(req, res) {
  try {
    const { id } = req.params;
    const job = await jobsService.retryJob(id);
    
    res.json({
      success: true,
      data: job,
      message: 'Job queued for retry'
    });
  } catch (error) {
    console.error('Retry job error:', error);
    res.status(500).json({ error: 'Failed to retry job' });
  }
}

// Cancel a pending job
export async function cancelJob(req, res) {
  try {
    const { id } = req.params;
    const job = await jobsService.cancelJob(id);
    
    res.json({
      success: true,
      data: job,
      message: 'Job cancelled'
    });
  } catch (error) {
    console.error('Cancel job error:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
}

// Get job statistics
export async function getJobStats(req, res) {
  try {
    const statsQuery = `
      SELECT 
        status,
        COUNT(*) as count,
        AVG(CASE 
          WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (completed_at - started_at))
          ELSE NULL 
        END) as avg_execution_time_seconds
      FROM background_jobs
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY status
    `;
    
    const pool = (await import('../configs/db.js')).default;
    const result = await pool.query(statsQuery);
    
    const stats = {
      by_status: result.rows.reduce((acc, row) => {
        acc[row.status] = {
          count: parseInt(row.count),
          avg_execution_time: row.avg_execution_time_seconds ? 
            parseFloat(row.avg_execution_time_seconds) : null
        };
        return acc;
      }, {}),
      total_24h: result.rows.reduce((sum, row) => sum + parseInt(row.count), 0)
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get job stats error:', error);
    res.status(500).json({ error: 'Failed to fetch job statistics' });
  }
}

// Cron schedule management
export async function listCronSchedules(req, res) {
  try {
    const schedules = await jobsService.getCronSchedules();
    
    res.json({
      success: true,
      data: schedules
    });
  } catch (error) {
    console.error('List cron schedules error:', error);
    res.status(500).json({ error: 'Failed to fetch cron schedules' });
  }
}

export async function createCronSchedule(req, res) {
  try {
    const { name, job_type, cron_expression, payload } = req.body;

    if (!name || !job_type || !cron_expression) {
      return res.status(400).json({ 
        error: 'name, job_type, and cron_expression are required' 
      });
    }

    const schedule = await jobsService.createCronSchedule(
      name,
      job_type,
      cron_expression,
      payload || {}
    );
    
    res.status(201).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    console.error('Create cron schedule error:', error);
    
    if (error.message.includes('Invalid cron expression')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to create cron schedule' });
  }
}

export async function updateCronSchedule(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const schedule = await jobsService.updateCronSchedule(id, updates);
    
    res.json({
      success: true,
      data: schedule
    });
  } catch (error) {
    console.error('Update cron schedule error:', error);
    
    if (error.message === 'Schedule not found') {
      return res.status(404).json({ error: error.message });
    }
    
    if (error.message === 'No fields to update') {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to update cron schedule' });
  }
}

export async function deleteCronSchedule(req, res) {
  try {
    const { id } = req.params;
    await jobsService.deleteCronSchedule(id);
    
    res.json({
      success: true,
      message: 'Cron schedule deleted'
    });
  } catch (error) {
    console.error('Delete cron schedule error:', error);
    res.status(500).json({ error: 'Failed to delete cron schedule' });
  }
}
