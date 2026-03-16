// Orders routes
import express from 'express';
import { listOrders, getOrder, createOrder, createTransferOrder, updateOrderStatus, cancelOrder, initiateOrderReturn } from '../controllers/ordersController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import { validateUUIDParams } from '../middlewares/validateParams.js';
import { 
  createOrderSchema,
  createTransferOrderSchema,
  cancelOrderSchema,
  initiateReturnFromOrderSchema,
  updateOrderStatusSchema,
  listOrdersQuerySchema 
} from '../validators/orderSchemas.js';

const router = express.Router();

// GET /api/orders - list orders with filters
router.get('/orders', authenticate, authorize('orders.view'), validateQuery(listOrdersQuerySchema), listOrders);
// GET /api/orders/:id - get single order
router.get('/orders/:id', authenticate, authorize('orders.view'), validateUUIDParams, getOrder);
// POST /api/orders - create new order (requires authentication so org context is always available)
router.post('/orders', authenticate, authorize('orders.create'), validateRequest(createOrderSchema), createOrder);
// POST /api/orders/transfer - create transfer order (warehouse-to-warehouse)
router.post('/orders/transfer', authenticate, authorize('orders.create'), validateRequest(createTransferOrderSchema), createTransferOrder);
// PATCH /api/orders/:id/status - update order status
router.patch('/orders/:id/status', authenticate, authorize('orders.update'), validateUUIDParams, validateRequest(updateOrderStatusSchema), updateOrderStatus);
// POST /api/orders/:id/cancel - explicit cancellation with reverse-logistics handling
router.post('/orders/:id/cancel', authenticate, authorize('orders.update'), validateUUIDParams, validateRequest(cancelOrderSchema), cancelOrder);
// POST /api/orders/:id/returns - create return request for delivered order
router.post('/orders/:id/returns', authenticate, authorize('returns.create'), validateUUIDParams, validateRequest(initiateReturnFromOrderSchema), initiateOrderReturn);

export default router;
