import express from 'express';
import { listReturns, getReturn, createReturn, updateReturn, getReturnStats } from '../controllers/returnsController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.get('/returns', authenticate, listReturns);
router.get('/returns/stats', authenticate, getReturnStats);
router.get('/returns/:id', authenticate, getReturn);
router.post('/returns', authenticate, createReturn);
router.patch('/returns/:id', authenticate, updateReturn);

export default router;
