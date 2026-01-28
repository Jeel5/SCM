// Jobs, dashboard, and analytics routes - background tasks and metrics
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
  deleteCronSchedule
} from '../controllers/jobsController.js';
import { getDashboardStats } from '../controllers/dashboardController.js';
import { getAnalytics } from '../controllers/analyticsController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';

const router = express.Router();

// Jobs
router.get('/jobs', authenticate, authorize('jobs:read'), listJobs);
router.get('/jobs/stats', authenticate, authorize('jobs:read'), getJobStats);
router.get('/jobs/:id', authenticate, authorize('jobs:read'), getJobDetails);
router.post('/jobs', authenticate, authorize('jobs:create'), createJob);
router.post('/jobs/:id/cancel', authenticate, authorize('jobs:update'), cancelJob);
router.post('/jobs/:id/retry', authenticate, authorize('jobs:update'), retryJob);

// Cron schedules
router.get('/cron', authenticate, authorize('jobs:read'), listCronSchedules);
router.post('/cron', authenticate, authorize('jobs:create'), createCronSchedule);
router.patch('/cron/:id', authenticate, authorize('jobs:update'), updateCronSchedule);
router.delete('/cron/:id', authenticate, authorize('jobs:delete'), deleteCronSchedule);

// Dashboard & Analytics
router.get('/dashboard/stats', authenticate, authorize('dashboard:read'), getDashboardStats);
router.get('/analytics', authenticate, authorize('analytics:read'), getAnalytics);

export default router;
