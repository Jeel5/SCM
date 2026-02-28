// Jobs, dashboard, and analytics routes - background tasks and metrics
//
// Jobs and cron schedules are system-level resources managed by admin /
// operations_manager roles — they are not scoped to a single organisation.
// Dashboard and analytics are org-scoped and use injectOrgContext.
import express from 'express';
import { 
  listJobs, 
  getJobDetails, 
  createJob, 
  cancelJob, 
  retryJob, 
  getJobStats,
  listCronSchedules,
  createCronSchedule,
  updateCronSchedule,
  deleteCronSchedule,
  getDeadLetterQueue,
  retryFromDeadLetterQueue,
  purgeDeadLetterQueue
} from '../controllers/jobsController.js';
import { getDashboardStats } from '../controllers/dashboardController.js';
import { getAnalytics, getAnalyticsExport } from '../controllers/analyticsController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
import { injectOrgContext } from '../middlewares/multiTenant.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import {
  listJobsQuerySchema,
  listDLQQuerySchema,
  createJobSchema,
  createCronScheduleSchema,
  updateCronScheduleSchema,
} from '../validators/jobSchemas.js';

const router = express.Router();

// Jobs
router.get('/jobs', authenticate, authorize('jobs:read'), validateQuery(listJobsQuerySchema), listJobs);
router.get('/jobs/stats', authenticate, authorize('jobs:read'), getJobStats);
router.get('/jobs/:id', authenticate, authorize('jobs:read'), getJobDetails);
router.post('/jobs', authenticate, authorize('jobs:create'), validateRequest(createJobSchema), createJob);
router.post('/jobs/:id/cancel', authenticate, authorize('jobs:update'), cancelJob);
router.post('/jobs/:id/retry', authenticate, authorize('jobs:update'), retryJob);

// Cron schedules
router.get('/cron', authenticate, authorize('jobs:read'), listCronSchedules);
router.post('/cron', authenticate, authorize('jobs:create'), validateRequest(createCronScheduleSchema), createCronSchedule);
router.patch('/cron/:id', authenticate, authorize('jobs:update'), validateRequest(updateCronScheduleSchema), updateCronSchedule);
router.delete('/cron/:id', authenticate, authorize('jobs:delete'), deleteCronSchedule);

// Dead Letter Queue
router.get('/dead-letter-queue', authenticate, authorize('jobs:read'), validateQuery(listDLQQuerySchema), getDeadLetterQueue);
router.post('/dead-letter-queue/:id/retry', authenticate, authorize('jobs:update'), retryFromDeadLetterQueue);
router.delete('/dead-letter-queue/purge', authenticate, authorize('jobs:delete'), purgeDeadLetterQueue);

// Dashboard & Analytics — org-scoped data; injectOrgContext supplies req.orgContext
router.get('/dashboard/stats', authenticate, injectOrgContext, authorize('dashboard:read'), getDashboardStats);
router.get('/analytics', authenticate, injectOrgContext, authorize('analytics:read'), getAnalytics);
router.get('/analytics/export', authenticate, injectOrgContext, authorize('analytics:read'), getAnalyticsExport);

export default router;
