import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
import { getLogs } from '../controllers/logsController.js';

const router = express.Router();

router.get('/logs', authenticate, authorize('logs.view'), getLogs);

export default router;
