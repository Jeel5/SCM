import express from 'express';
import { listOrders, getOrder, createOrder, updateOrderStatus } from '../controllers/ordersController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.get('/orders', authenticate, listOrders);
router.get('/orders/:id', authenticate, getOrder);
router.post('/orders', authenticate, createOrder);
router.patch('/orders/:id/status', authenticate, updateOrderStatus);

export default router;
