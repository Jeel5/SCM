// Return routes - all require authentication and return permissions
import express from 'express';
import { listReturns, getReturn, createReturn, updateReturn, getReturnStats } from '../controllers/returnsController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import { 
  createReturnSchema, 
  listReturnsQuerySchema 
} from '../validators/returnSchemas.js';

const router = express.Router();

router.get('/returns', authenticate, authorize('returns:read'), validateQuery(listReturnsQuerySchema), listReturns);
router.get('/returns/stats', authenticate, authorize('returns:read'), getReturnStats);
router.get('/returns/:id', authenticate, authorize('returns:read'), getReturn);
router.post('/returns', authenticate, authorize('returns:create'), validateRequest(createReturnSchema), createReturn);
router.patch('/returns/:id', authenticate, authorize('returns:update'), updateReturn);

export default router;
