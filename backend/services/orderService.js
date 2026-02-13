import OrderRepository from '../repositories/OrderRepository.js';
import InventoryRepository from '../repositories/InventoryRepository.js';
import { NotFoundError, BusinessLogicError, assertExists } from '../errors/index.js';
import { logEvent, logPerformance } from '../utils/logger.js';
import { withTransaction } from '../utils/dbTransaction.js';
import pool from '../configs/db.js';
import logger from '../utils/logger.js';

// Order Service - contains business logic and orchestrates order operations
class OrderService {
  // Get paginated orders with optional filtering
  async getOrders({ page = 1, limit = 20, status, search, sortBy = 'created_at', sortOrder = 'DESC' }) {
    const { orders, totalCount } = await OrderRepository.findOrders({
      page,
      limit,
      status,
      search,
      sortBy,
      sortOrder
    });

    return {
      orders,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  }

  // Get order by ID including all items, throws error if not found
  async getOrderById(id) {
    const order = await OrderRepository.findOrderWithItems(id);
    assertExists(order, 'Order');
    return order;
  }

  // Create new order with items, reserves inventory, and requests carrier assignment - ALL in one transaction
  async createOrder(orderData, requestCarrierAssignment = true) {
    const startTime = Date.now();
    
    // Validate order has items
    if (!orderData.items || orderData.items.length === 0) {
      throw new BusinessLogicError('Order must have at least one item');
    }

    try {
      const result = await withTransaction(async (tx) => {
        // Prepare order data
        // Build order record with defaults
        const orderRecord = {
          order_number: orderData.order_number || `ORD-${Date.now()}`,
          customer_name: orderData.customer_name,
          customer_email: orderData.customer_email,
          customer_phone: orderData.customer_phone || null,
          status: orderData.status || 'created',
          priority: orderData.priority || 'standard',
          total_amount: orderData.total_amount,
          currency: orderData.currency || 'INR',
          shipping_address: JSON.stringify(orderData.shipping_address),
          billing_address: orderData.billing_address ? JSON.stringify(orderData.billing_address) : null,
          estimated_delivery: orderData.estimated_delivery || null,
          notes: orderData.notes || null
        };

        // Prepare items
        const items = orderData.items.map(item => ({
          product_id: item.product_id,
          sku: item.sku,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          weight: item.weight || null,
          warehouse_id: item.warehouse_id || null
        }));

        // Create order with items in transaction
        const order = await OrderRepository.createOrderWithItems(orderRecord, items, tx);

        // Reserve inventory for each item
        for (const item of orderData.items) {
          if (item.warehouse_id && item.sku) {
            const reserved = await InventoryRepository.reserveStock(
              item.sku,
              item.warehouse_id,
              item.quantity,
              tx
            );
            
            if (!reserved) {
              throw new BusinessLogicError(`Insufficient inventory for SKU: ${item.sku}`);
            }
          }
        }

        // Request carrier assignment within same transaction
        let assignments = [];
        let carriersToNotify = [];
        
        if (requestCarrierAssignment) {
          const serviceType = order.priority || 'standard';
          
          // Find eligible carriers
          const carriersResult = await tx.query(
            `SELECT id, code, name, contact_email, service_type, is_active
             FROM carriers 
             WHERE is_active = true 
             AND (service_type = $1 OR service_type = 'all')
             ORDER BY reliability_score DESC
             LIMIT 3`,
            [serviceType]
          );

          if (carriersResult.rows.length === 0) {
            throw new BusinessLogicError(`No available carriers for service type: ${serviceType}`);
          }

          // Create carrier assignments within same transaction
          for (const carrier of carriersResult.rows) {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            const requestPayload = {
              orderId: order.id,
              orderNumber: order.order_number,
              customerName: order.customer_name,
              customerEmail: order.customer_email,
              customerPhone: order.customer_phone,
              serviceType,
              totalAmount: parseFloat(order.total_amount),
              shippingAddress: order.shipping_address,
              items: orderData.items || [],
              requestedAt: new Date()
            };

            const idempotencyKey = `${order.id}-carrier-${carrier.id}-${Date.now()}`;

            const assignmentResult = await tx.query(
              `INSERT INTO carrier_assignments 
               (order_id, carrier_id, service_type, status, pickup_address, delivery_address,
                estimated_pickup, estimated_delivery, request_payload, expires_at, idempotency_key)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               RETURNING id, carrier_id, order_id, status, created_at`,
              [
                order.id,
                carrier.id,
                serviceType,
                'pending',
                order.shipping_address,
                order.shipping_address,
                new Date(Date.now() + 2 * 60 * 60 * 1000),
                new Date(Date.now() + 24 * 60 * 60 * 1000),
                JSON.stringify(requestPayload),
                expiresAt,
                idempotencyKey
              ]
            );

            const assignment = assignmentResult.rows[0];
            assignments.push(assignment);
            carriersToNotify.push({ assignment, carrier, requestPayload });

            logger.info(`Created carrier assignment in transaction`, {
              assignmentId: assignment.id,
              carrierId: carrier.id,
              orderId: order.id,
              idempotencyKey
            });
          }

          // Update order status to pending_carrier_assignment
          await tx.query(
            'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
            ['pending_carrier_assignment', order.id]
          );
        }

        return { order, assignments, carriersToNotify };
      });
      
      const order = result.order;
      
      // After transaction commits successfully, send notifications to carriers
      // External API calls happen outside transaction
      if (result.carriersToNotify && result.carriersToNotify.length > 0) {
        setImmediate(() => {
          for (const { assignment, carrier } of result.carriersToNotify) {
            // In production: POST to carrier webhook
            logger.info(`Notifying carrier: ${carrier.name}`, {
              assignmentId: assignment.id,
              carrierId: carrier.id
            });
          }
        });
      }
      
      // Log order creation event after successful commit
      logEvent('OrderCreated', {
        orderId: order.id,
        orderNumber: order.order_number,
        customerEmail: order.customer_email,
        totalAmount: order.total_amount,
        itemCount: order.items.length,
        carrierAssignments: result.assignments.length
      });
      
      logPerformance('createOrder', Date.now() - startTime, {
        orderId: order.id,
        itemCount: order.items.length,
      });
      
      return order;
      
    } catch (error) {
      logEvent('OrderCreationFailed', {
        customerEmail: orderData.customer_email,
        error: error.message,
      });
      
      throw error;
    }
  }

  // Update order status with logging
  async updateOrderStatus(id, status) {
    const order = await OrderRepository.findById(id);
    assertExists(order, 'Order');
    
    const oldStatus = order.status;
    const updatedOrder = await OrderRepository.updateStatus(id, status);
    
    logEvent('OrderStatusUpdated', {
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.order_number,
      oldStatus: oldStatus,
      newStatus: status,
    });
    
    return updatedOrder;
  }

  // Update order details (addresses, notes, delivery dates)
  async updateOrder(id, updates) {
    // Prepare update data
    const updateData = {};
    const allowedFields = [
      'customer_name', 'customer_email', 'customer_phone',
      'status', 'priority', 'total_amount', 
      'estimated_delivery', 'actual_delivery', 'notes'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    if (updates.shipping_address) {
      updateData.shipping_address = JSON.stringify(updates.shipping_address);
    }

    if (updates.billing_address) {
      updateData.billing_address = JSON.stringify(updates.billing_address);
    }

    if (Object.keys(updateData).length === 0) {
      throw new BusinessLogicError('No valid fields to update');
    }

    const order = await OrderRepository.update(id, updateData);
    assertExists(order, 'Order');
    return order;
  }

  /**
   * Cancel order and release inventory
   */
  async cancelOrder(id) {
    const client = await OrderRepository.beginTransaction();
    
    try {
      // Get order items
      const items = await OrderRepository.findOrderItems(id, client);

      // Release inventory for each item
      for (const item of items) {
        if (item.warehouse_id && item.sku) {
          await InventoryRepository.releaseStock(
            item.sku,
            item.warehouse_id,
            item.quantity,
            client
          );
        }
      }

      // Update order status
      const order = await OrderRepository.updateStatus(id, 'cancelled', client);

      await OrderRepository.commitTransaction(client);
      
      logEvent('OrderCancelled', {
        orderId: order.id,
        orderNumber: order.order_number,
        itemCount: items.length,
      });
      
      return order;
      
    } catch (error) {
      await OrderRepository.rollbackTransaction(client);
      throw error;
    }
  }
}

export default new OrderService();
