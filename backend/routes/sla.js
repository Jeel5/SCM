// SLA and exception management routes - policies, violations, ETAs
import express from 'express';
import { 
  listSlaPolicies, getEta, getSlaViolations, getSlaDashboard,
  listExceptions, createException, resolveException
} from '../controllers/slaController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';

const router = express.Router();

// SLA
router.get('/sla/policies', authenticate, authorize('sla:read'), listSlaPolicies);
router.get('/sla/violations', authenticate, authorize('sla:read'), getSlaViolations);
router.get('/sla/dashboard', authenticate, authorize('sla:read'), getSlaDashboard);
router.get('/eta/:shipmentId', authenticate, authorize('shipments:read'), getEta);

// Exceptions
router.get('/exceptions', authenticate, authorize('exceptions:read'), listExceptions);
router.post('/exceptions', authenticate, authorize('exceptions:create'), createException);
router.patch('/exceptions/:id/resolve', authenticate, authorize('exceptions:update'), resolveException);

export default router;
