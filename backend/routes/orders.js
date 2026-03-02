// Orders routes
import express from 'express';
import { listOrders, getOrder, createOrder, createTransferOrder, updateOrderStatus } from '../controllers/ordersController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import { validateUUIDParams } from '../middlewares/validateParams.js';
import { 
  createOrderSchema,
  createTransferOrderSchema,
  updateOrderStatusSchema,
  listOrdersQuerySchema 
} from '../validators/orderSchemas.js';

const router = express.Router();

// GET /api/orders - list orders with filters
router.get('/orders', authenticate, authorize('orders:read'), validateQuery(listOrdersQuerySchema), listOrders);
// GET /api/orders/:id - get single order
router.get('/orders/:id', authenticate, authorize('orders:read'), validateUUIDParams, getOrder);
// POST /api/orders - create new order (requires authentication so org context is always available)
router.post('/orders', authenticate, authorize('orders:create'), validateRequest(createOrderSchema), createOrder);
// POST /api/orders/transfer - create transfer order (warehouse-to-warehouse)
router.post('/orders/transfer', authenticate, authorize('orders:create'), validateRequest(createTransferOrderSchema), createTransferOrder);
// PATCH /api/orders/:id/status - update order status
router.patch('/orders/:id/status', authenticate, authorize('orders:update'), validateUUIDParams, validateRequest(updateOrderStatusSchema), updateOrderStatus);

export default router;
