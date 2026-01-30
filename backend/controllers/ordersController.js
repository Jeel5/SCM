import orderService from '../services/orderService.js';
import { asyncHandler } from '../errors/index.js';

// Orders Controller - handles HTTP requests and delegates to service layer

// List orders with filters and pagination
export const listOrders = asyncHandler(async (req, res) => {
  const { status, search, page, limit, sortBy, sortOrder } = req.query;
  
  const result = await orderService.getOrders({
    status,
    search,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sortBy,
    sortOrder
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
  
  const order = await orderService.getOrderById(id);
  
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

// Create order
export const createOrder = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.body);
  
  res.status(201).json({ 
      success: true, 
    message: 'Order created successfully', 
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
