// Orders routes
import express from 'express';
import { listOrders, getOrder, createOrder, createTransferOrder } from '../controllers/ordersController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
import { injectOrgContext } from '../middlewares/multiTenant.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import { 
  createOrderSchema,
  createTransferOrderSchema,
  listOrdersQuerySchema 
} from '../validators/orderSchemas.js';

const router = express.Router();

// GET /api/orders - list orders with filters
router.get('/orders', authenticate, injectOrgContext, authorize('orders:read'), validateQuery(listOrdersQuerySchema), listOrders);
// GET /api/orders/:id - get single order
router.get('/orders/:id', authenticate, injectOrgContext, authorize('orders:read'), getOrder);
// POST /api/orders - create new order (requires authentication so org context is always available)
router.post('/orders', authenticate, injectOrgContext, authorize('orders:create'), validateRequest(createOrderSchema), createOrder);
// POST /api/orders/transfer - create transfer order (warehouse-to-warehouse)
router.post('/orders/transfer', authenticate, injectOrgContext, authorize('orders:create'), validateRequest(createTransferOrderSchema), createTransferOrder);

export default router;
