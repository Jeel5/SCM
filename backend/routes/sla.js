import express from 'express';
import { 
  listSlaPolicies, getEta, getSlaViolations, getSlaDashboard,
  listExceptions, createException, resolveException
} from '../controllers/slaController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// SLA
router.get('/sla/policies', authenticate, listSlaPolicies);
router.get('/sla/violations', authenticate, getSlaViolations);
router.get('/sla/dashboard', authenticate, getSlaDashboard);
router.get('/eta/:shipmentId', authenticate, getEta);

// Exceptions
router.get('/exceptions', authenticate, listExceptions);
router.post('/exceptions', authenticate, createException);
router.patch('/exceptions/:id/resolve', authenticate, resolveException);

export default router;
