// Orders routes - all routes require authentication and permission checks
import express from 'express';
import { listOrders, getOrder, createOrder, updateOrderStatus } from '../controllers/ordersController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import { 
  createOrderSchema, 
  updateOrderStatusSchema, 
  listOrdersQuerySchema 
} from '../validators/orderSchemas.js';

const router = express.Router();

// GET /api/orders - list orders with filters
router.get('/orders', authenticate, authorize('orders:read'), validateQuery(listOrdersQuerySchema), listOrders);
// GET /api/orders/:id - get single order
router.get('/orders/:id', authenticate, authorize('orders:read'), getOrder);
// POST /api/orders - create new order
router.post('/orders', authenticate, authorize('orders:create'), validateRequest(createOrderSchema), createOrder);
// PATCH /api/orders/:id/status - update order status
router.patch('/orders/:id/status', authenticate, authorize('orders:update'), validateRequest(updateOrderStatusSchema), updateOrderStatus);

export default router;
