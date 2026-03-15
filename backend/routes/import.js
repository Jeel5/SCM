// Import routes — async CSV upload & job status polling
import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { importRateLimit } from '../middlewares/rateLimiter.js';
import { startImport, getImportJobStatus, uploadMiddleware } from '../controllers/importController.js';

const router = express.Router();

// Upload a CSV file and enqueue a background import job.
// Returns { jobId, totalRows } — client tracks progress via Socket.IO.
router.post(
  '/import/upload',
  authenticate,
  importRateLimit,
  uploadMiddleware,
  startImport
);

// Poll the status of an import job (fallback if socket is unavailable).
router.get(
  '/import/jobs/:jobId',
  authenticate,
  getImportJobStatus
);

export default router;
