import orderService from '../services/orderService.js';
import { asyncHandler, AppError, ValidationError } from '../errors/index.js';
import { emitToOrg } from '../sockets/emitter.js';
import { cacheWrap, orgSeg, hashParams, invalidatePatterns, invalidationTargets } from '../utils/cache.js';
import operationalNotificationService from '../services/operationalNotificationService.js';
import logger from '../utils/logger.js';

// Orders Controller - handles HTTP requests and delegates to service layer

// List orders with filters and pagination
export const listOrders = asyncHandler(async (req, res) => {
  const queryParams = req.validatedQuery || req.query;
  const { status, search, page, limit, sortBy, sortOrder } = queryParams;
  const organizationId = req.orgContext?.organizationId;

  const pageNum  = parseInt(page, 10)  || 1;
  const limitNum = Math.min(parseInt(limit, 10) || 20, 100);

  // Cache paginated + filtered list for 30 seconds
  const cacheKey = `orders:list:${orgSeg(organizationId)}:${hashParams({ status, search, page: pageNum, limit: limitNum, sortBy, sortOrder })}`;
  const cached = await cacheWrap(cacheKey, 30, async () => {
    const result = await orderService.getOrders({ status, search, page: pageNum, limit: limitNum, sortBy, sortOrder, organizationId });
    return {
      stats: result.stats,
      data: result.orders.map(row => ({
        id: row.id,
        orderNumber: row.order_number,
        customerId: row.customer_id || 'N/A',
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        customerPhone: row.customer_phone,
        status: row.status,
        priority: row.priority,
        shippingAddress: row.shipping_address,
        billingAddress: row.billing_address,
        totalAmount: parseFloat(row.total_amount),
        currency: row.currency,
        items: (row.items || []).map(item => ({
          id: item.id,
          productId: item.product_id,
          sku: item.sku,
          productName: item.product_name,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unit_price || 0),
          weight: item.weight,
          warehouseId: item.warehouse_id
        })),
        itemCount: parseInt(row.item_count || 0, 10),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        estimatedDelivery: row.estimated_delivery,
        actualDelivery: row.actual_delivery,
        notes: row.notes
      })),
      pagination: result.pagination
    };
  });

  res.json({ success: true, ...cached });
});

// Get single order
export const getOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Get organization context for multi-tenancy
  const organizationId = req.orgContext?.organizationId;
  
  const order = await orderService.getOrderById(id, organizationId);
  
  res.json({
    success: true,
    data: {
      id: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      status: order.status,
      priority: order.priority,
      items: (order.items || []).map(item => ({
        id: item.id,
        productId: item.product_id,
        sku: item.sku,
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unit_price || 0),
        weight: item.weight,
        warehouseId: item.warehouse_id
      })),
      shippingAddress: order.shipping_address,
      billingAddress: order.billing_address,
      totalAmount: parseFloat(order.total_amount),
      currency: order.currency,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      estimatedDelivery: order.estimated_delivery,
      actualDelivery: order.actual_delivery,
      notes: order.notes
    }
  });
});

// Create order (automatically includes carrier assignment in same transaction)
export const createOrder = asyncHandler(async (req, res) => {
  // Inject organization context so order is scoped to the right org
  // For demo/unauthenticated requests this will be null (org-less demo order)
  const orderData = {
    ...req.body,
    organization_id: req.orgContext?.organizationId ?? null
  };
  
  // Carrier assignments are always created automatically
  const order = await orderService.createOrder(orderData);

  operationalNotificationService.queueOrganizationNotification({
    organizationId: req.orgContext?.organizationId,
    type: 'order',
    title: 'New Order Created',
    message: `Order ${order.order_number || order.orderNumber || order.id} was created successfully.`,
    link: '/orders',
    metadata: { event: 'order_created', orderId: order.id },
  });

  emitToOrg(req.orgContext?.organizationId, 'order:created', order);
  await invalidatePatterns(invalidationTargets(req.orgContext?.organizationId, 'orders:list', 'dash', 'analytics'));

  res.status(201).json({ 
    success: true, 
    message: 'Order created successfully', 
    data: order 
  });
});

/**
 * Create Transfer Order - Creates order for warehouse-to-warehouse inventory transfer
 * 
 * ARCHITECTURE DECISION: Reuses existing order/shipment infrastructure
 * - Creates order with type 'transfer'
 * - Auto-creates internal shipment for tracking
 * - On delivery, triggers automatic inventory transfer
 * 
 * REAL-WORLD BENEFITS:
 * - Full audit trail (who requested, approved, shipped)
 * - In-transit tracking (prevents "lost" inventory)
 * - ETA predictions (destination warehouse can plan)
 * - Workflow approvals (manager authorization)
 * 
 * EDGE CASES HANDLED:
 * - Insufficient stock at source → rollback
 * - Cancelled transfers → inventory released
 * - Partial delivery → partial transfer
 */
export const createTransferOrder = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  const order = await orderService.createTransferOrder(req.body, organizationId);
  
  res.status(201).json({ 
    success: true, 
    message: 'Transfer order created successfully', 
    data: order 
  });
});

// Update order status
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const organizationId = req.orgContext?.organizationId;

  // Status value is already validated by Joi (updateOrderStatusSchema).
  // State-machine transition validity is enforced by orderService.updateOrderStatus().
  // No redundant whitelist check here — single source of truth in the service.
  if (!status) {
    throw new ValidationError('Status is required');
  }

  logger.info('Order status update requested', { orderId: id, newStatus: status, organizationId });

  const order = await orderService.updateOrderStatus(id, status, organizationId);

  operationalNotificationService.queueOrganizationNotification({
    organizationId,
    type: 'order',
    title: 'Order Status Updated',
    message: `Order ${order.order_number || order.orderNumber || order.id} moved to '${order.status}'.`,
    link: '/orders',
    metadata: { event: 'order_status_updated', orderId: order.id, status: order.status },
  });

  emitToOrg(organizationId, 'order:updated', { id: order.id, status: order.status, orderNumber: order.order_number });
  await invalidatePatterns(invalidationTargets(organizationId, 'orders:list', 'dash', 'analytics'));

  res.json({ 
    success: true, 
    message: `Order status updated to '${status}'`, 
    data: order 
  });
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;

  const order = await orderService.cancelOrder(id, organizationId);

  operationalNotificationService.queueOrganizationNotification({
    organizationId,
    type: 'order',
    title: 'Order Cancelled',
    message: `Order ${order.order_number || order.orderNumber || order.id} has been cancelled.`,
    link: '/orders',
    metadata: { event: 'order_cancelled', orderId: order.id },
  });

  emitToOrg(organizationId, 'order:updated', {
    id: order.id,
    status: order.status,
    orderNumber: order.order_number,
    reverseShipment: order.reverse_shipment || null,
  });
  await invalidatePatterns(invalidationTargets(organizationId, 'orders:list', 'shipments:list', 'dash', 'analytics'));

  res.json({
    success: true,
    message: 'Order cancelled successfully',
    data: order,
  });
});

export const initiateOrderReturn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;

  if (!req.body.reason) {
    throw new ValidationError('reason is required');
  }

  const createdReturn = await orderService.initiateReturnForDeliveredOrder(id, req.body, organizationId);

  operationalNotificationService.queueOrganizationNotification({
    organizationId,
    type: 'return',
    title: 'Return Request Created',
    message: `Return ${createdReturn.rma_number || createdReturn.rmaNumber || createdReturn.id} was created from delivered order.`,
    link: '/returns',
    metadata: { event: 'return_created_from_order', returnId: createdReturn.id, orderId: id },
  });

  emitToOrg(organizationId, 'return:created', createdReturn);
  await invalidatePatterns(invalidationTargets(organizationId, 'returns:list', 'orders:list', 'dash', 'analytics'));

  res.status(201).json({
    success: true,
    message: 'Return request created from delivered order',
    data: createdReturn,
  });
});
