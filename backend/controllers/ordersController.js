import orderService from '../services/orderService.js';
import { asyncHandler } from '../errors/index.js';

// Orders Controller - handles HTTP requests and delegates to service layer

// List orders with filters and pagination
export const listOrders = asyncHandler(async (req, res) => {
  // Use validatedQuery for Joi-validated params (with type coercion)
  const queryParams = req.validatedQuery || req.query;
  const { status, search, page, limit, sortBy, sortOrder } = queryParams;
  
  // Get organization context for multi-tenancy
  const organizationId = req.orgContext?.organizationId;
  
  const result = await orderService.getOrders({
    status,
    search,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sortBy,
    sortOrder,
    organizationId
  });
  
  // Transform for frontend
  const orders = result.orders.map(row => ({
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
    itemCount: parseInt(row.item_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    estimatedDelivery: row.estimated_delivery,
    actualDelivery: row.actual_delivery,
    notes: row.notes
  }));
  
  res.json({
    success: true,
    data: orders,
    pagination: result.pagination
  });
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

// Create order (includes carrier assignment in same transaction)
export const createOrder = asyncHandler(async (req, res) => {
  // requestCarrierAssignment flag can be set to false if caller wants to handle it separately
  const requestCarrierAssignment = req.body.requestCarrierAssignment !== false;
  
  // Inject organization context so order is scoped to the right org
  // For demo/unauthenticated requests this will be null (org-less demo order)
  const orderData = {
    ...req.body,
    organization_id: req.orgContext?.organizationId || null
  };
  
  const order = await orderService.createOrder(orderData, requestCarrierAssignment);
  
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
  const order = await orderService.createTransferOrder(req.body);
  
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
  
  const order = await orderService.updateOrderStatus(id, status);
  
  res.json({ 
    success: true, 
    message: 'Order status updated', 
    data: order 
  });
});
