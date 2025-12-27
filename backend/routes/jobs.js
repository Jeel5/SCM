import express from 'express';
import { listJobs, getJob, createJob, cancelJob, retryJob, getJobStats, getDashboardStats, getAnalytics } from '../controllers/jobsController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Jobs
router.get('/jobs', authenticate, listJobs);
router.get('/jobs/stats', authenticate, getJobStats);
router.get('/jobs/:id', authenticate, getJob);
router.post('/jobs', authenticate, createJob);
router.post('/jobs/:id/cancel', authenticate, cancelJob);
router.post('/jobs/:id/retry', authenticate, retryJob);

// Dashboard & Analytics
router.get('/dashboard/stats', authenticate, getDashboardStats);
router.get('/analytics', authenticate, getAnalytics);

export default router;
