// Return routes - all require authentication and return permissions
import express from 'express';
import { listReturns, getReturn, createReturn, updateReturn, getReturnStats } from '../controllers/returnsController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import { validateUUIDParams } from '../middlewares/validateParams.js';
import { 
  createReturnSchema,
  updateReturnStatusSchema,
  listReturnsQuerySchema 
} from '../validators/returnSchemas.js';

const router = express.Router();

router.get('/returns', authenticate, authorize('returns.view'), validateQuery(listReturnsQuerySchema), listReturns);
router.get('/returns/stats', authenticate, authorize('returns.view'), getReturnStats);
router.get('/returns/:id', authenticate, authorize('returns.view'), validateUUIDParams, getReturn);
router.post('/returns', authenticate, authorize('returns.create'), validateRequest(createReturnSchema), createReturn);
router.patch('/returns/:id', authenticate, authorize('returns.update'), validateUUIDParams, validateRequest(updateReturnStatusSchema), updateReturn);

export default router;
