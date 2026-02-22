// Return routes - all require authentication and return permissions
import express from 'express';
import { listReturns, getReturn, createReturn, updateReturn, getReturnStats } from '../controllers/returnsController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
import { injectOrgContext } from '../middlewares/multiTenant.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import { 
  createReturnSchema,
  updateReturnStatusSchema,
  listReturnsQuerySchema 
} from '../validators/returnSchemas.js';

const router = express.Router();

router.get('/returns', authenticate, injectOrgContext, authorize('returns:read'), validateQuery(listReturnsQuerySchema), listReturns);
router.get('/returns/stats', authenticate, injectOrgContext, authorize('returns:read'), getReturnStats);
router.get('/returns/:id', authenticate, injectOrgContext, authorize('returns:read'), getReturn);
router.post('/returns', authenticate, injectOrgContext, authorize('returns:create'), validateRequest(createReturnSchema), createReturn);
router.patch('/returns/:id', authenticate, injectOrgContext, authorize('returns:update'), validateRequest(updateReturnStatusSchema), updateReturn);

export default router;
