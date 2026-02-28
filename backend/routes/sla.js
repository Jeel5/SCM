// SLA and exception management routes - policies, violations, ETAs
import express from 'express';
import { 
  listSlaPolicies, getEta, getSlaViolations, getSlaDashboard,
  listExceptions, createException, resolveException
} from '../controllers/slaController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
import { injectOrgContext } from '../middlewares/multiTenant.js';
import { validateQuery, validateRequest } from '../validators/index.js';
import {
  slaViolationsQuerySchema,
  exceptionsQuerySchema,
  createExceptionSchema,
  resolveExceptionSchema,
} from '../validators/slaSchemas.js';

const router = express.Router();

// SLA — all org-scoped; injectOrgContext provides req.orgContext for the controller.
router.get('/sla/policies', authenticate, injectOrgContext, authorize('sla:read'), listSlaPolicies);
router.get('/sla/violations', authenticate, injectOrgContext, authorize('sla:read'), validateQuery(slaViolationsQuerySchema), getSlaViolations);
router.get('/sla/dashboard', authenticate, injectOrgContext, authorize('sla:read'), getSlaDashboard);
router.get('/eta/:shipmentId', authenticate, injectOrgContext, authorize('shipments:read'), getEta);

// Exceptions
router.get('/exceptions', authenticate, injectOrgContext, authorize('exceptions:read'), validateQuery(exceptionsQuerySchema), listExceptions);
router.post('/exceptions', authenticate, injectOrgContext, authorize('exceptions:create'), validateRequest(createExceptionSchema), createException);
router.patch('/exceptions/:id/resolve', authenticate, injectOrgContext, authorize('exceptions:update'), validateRequest(resolveExceptionSchema), resolveException);

export default router;
