import express from 'express';
import { listJobs } from '../controllers/jobsController.js';

const router = express.Router();

router.get('/jobs', listJobs);

export default router;
