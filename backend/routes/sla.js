// SLA and exception management routes - policies, violations, ETAs
import express from 'express';
import { 
  listSlaPolicies, createSlaPolicy, updateSlaPolicy, deactivateSlaPolicy,
  getEta, getSlaViolations, getSlaDashboard,
  listExceptions, getException, createException, resolveException
} from '../controllers/slaController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
import { validateQuery, validateRequest } from '../validators/index.js';
import {
  slaViolationsQuerySchema,
  exceptionsQuerySchema,
  createExceptionSchema,
  resolveExceptionSchema,
  createSLAPolicySchema,
  updateSLAPolicySchema,
} from '../validators/slaSchemas.js';

const router = express.Router();

// SLA Policies
router.get('/sla/policies',       authenticate, authorize('sla:read'),   listSlaPolicies);
router.post('/sla/policies',      authenticate, authorize('sla:manage'), validateRequest(createSLAPolicySchema), createSlaPolicy);
router.put('/sla/policies/:id',   authenticate, authorize('sla:manage'), validateRequest(updateSLAPolicySchema), updateSlaPolicy);
router.delete('/sla/policies/:id',authenticate, authorize('sla:manage'), deactivateSlaPolicy);

// SLA Violations & Dashboard
router.get('/sla/violations', authenticate, authorize('sla:read'), validateQuery(slaViolationsQuerySchema), getSlaViolations);
router.get('/sla/dashboard',  authenticate, authorize('sla:read'), getSlaDashboard);

// ETA predictions
router.get('/eta/:shipmentId', authenticate, authorize('shipments:read'), getEta);

// Exceptions
router.get('/exceptions',            authenticate, authorize('exceptions:read'),   validateQuery(exceptionsQuerySchema), listExceptions);
router.get('/exceptions/:id',        authenticate, authorize('exceptions:read'),   getException);
router.post('/exceptions',           authenticate, authorize('exceptions:create'), validateRequest(createExceptionSchema), createException);
router.patch('/exceptions/:id/resolve', authenticate, authorize('exceptions:update'), validateRequest(resolveExceptionSchema), resolveException);

export default router;
