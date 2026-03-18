// Background jobs controller - manages job creation, monitoring, and scheduling
import { jobsService } from '../services/jobsService.js';
import jobsRepo from '../repositories/JobsRepository.js';
import { asyncHandler, ConflictError } from '../errors/index.js';

// Get all jobs with filtering
export const listJobs = asyncHandler(async (req, res) => {
  const { status, job_type, priority, page = 1, limit = 20 } = req.validatedQuery ?? req.query;
  const organizationId = req.user?.organizationId;
  // Cap limit to prevent runaway queries
  const cappedLimit = Math.min(parseInt(limit, 10) || 20, 100);

  const filters = {};
  if (status) filters.status = status;
  if (job_type) filters.job_type = job_type;
  if (priority) filters.priority = parseInt(priority, 10);

  const result = await jobsService.getJobs(filters, parseInt(page, 10), cappedLimit, organizationId);

  res.json({ success: true, data: result.jobs, pagination: result.pagination });
});

// Get job details by ID
export const getJobDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user?.organizationId;
  const job = await jobsService.getJobById(id, organizationId);
  const logs = await jobsService.getJobLogs(id);

  res.json({ success: true, data: { ...job, execution_logs: logs } });
});

// Create a new background job
export const createJob = asyncHandler(async (req, res) => {
  const { job_type, payload, priority, scheduled_for } = req.body;
  const userId = req.user?.userId;

  const job = await jobsService.createJob(
    job_type,
    payload || {},
    priority || 5,
    scheduled_for,
    userId
  );

  res.status(201).json({ success: true, data: job });
});

// Retry a failed job
export const retryJob = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user?.organizationId;

  // Pre-validate: only failed/dead_letter jobs can be retried
  const jobCheck = await jobsService.getJobById(id, organizationId);
  const retryableStatuses = ['failed', 'dead_letter'];
  if (!retryableStatuses.includes(jobCheck.status)) {
    throw new ConflictError(
      `Job cannot be retried in status '${jobCheck.status}'. Only failed or dead_letter jobs can be retried.`
    );
  }

  const job = await jobsService.retryJob(id, organizationId);

  res.json({ success: true, data: job, message: 'Job queued for retry' });
});

// Cancel a pending job
export const cancelJob = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user?.organizationId;

  // Pre-validate: only pending/retrying jobs can be cancelled
  const jobCheck = await jobsService.getJobById(id, organizationId);
  const cancellableStatuses = ['pending', 'retrying'];
  if (!cancellableStatuses.includes(jobCheck.status)) {
    throw new ConflictError(
      `Job cannot be cancelled in status '${jobCheck.status}'. Only pending or retrying jobs can be cancelled.`
    );
  }

  const job = await jobsService.cancelJob(id, organizationId);

  res.json({ success: true, data: job, message: 'Job cancelled' });
});

// Get job statistics
export const getJobStats = asyncHandler(async (req, res) => {
  const rows = await jobsRepo.getJobStats();

  const stats = {
    by_status: rows.reduce((acc, row) => {
      acc[row.status] = {
        count: parseInt(row.count, 10),
        avg_execution_time: row.avg_execution_time_seconds
          ? parseFloat(row.avg_execution_time_seconds)
          : null,
      };
      return acc;
    }, {}),
    total_24h: rows.reduce((sum, row) => sum + parseInt(row.count, 10), 0),
  };

  res.json({ success: true, data: stats });
});

// Cron schedule management
export const listCronSchedules = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const schedules = await jobsService.getCronSchedules(organizationId);

  res.json({ success: true, data: schedules });
});

export const createCronSchedule = asyncHandler(async (req, res) => {
  const { name, job_type, cron_expression, payload } = req.body;
  const organizationId = req.user?.organizationId;

  const schedule = await jobsService.createCronSchedule(
    name,
    job_type,
    cron_expression,
    payload || {},
    organizationId
  );

  res.status(201).json({ success: true, data: schedule });
});

export const updateCronSchedule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const organizationId = req.user?.organizationId;

  const schedule = await jobsService.updateCronSchedule(id, updates, organizationId);

  res.json({ success: true, data: schedule });
});

export const deleteCronSchedule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user?.organizationId;
  await jobsService.deleteCronSchedule(id, organizationId);

  res.json({ success: true, message: 'Cron schedule deleted' });
});

// Dead Letter Queue Management
export const getDeadLetterQueue = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.validatedQuery ?? req.query;
  const organizationId = req.user?.organizationId;

  const result = await jobsService.getDeadLetterQueue(parseInt(page, 10), parseInt(limit, 10), organizationId);

  res.json({ success: true, data: result.jobs, pagination: result.pagination });
});

export const retryFromDeadLetterQueue = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // org lookup happens inside the service via original_job_id → background_jobs
  const job = await jobsService.retryFromDeadLetterQueue(id);

  res.json({ success: true, data: job, message: 'Job moved back to queue for retry' });
});

export const purgeDeadLetterQueue = asyncHandler(async (req, res) => {
  const { older_than_days = 30 } = req.validatedQuery ?? req.query;

  const deletedCount = await jobsService.purgeDeadLetterQueue(parseInt(older_than_days, 10));

  res.json({ success: true, message: `Purged ${deletedCount} jobs from dead letter queue` });
});
