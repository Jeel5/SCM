import OrderRepository from '../repositories/OrderRepository.js';
import InventoryRepository from '../repositories/InventoryRepository.js';
import WarehouseRepository from '../repositories/WarehouseRepository.js';
import { NotFoundError, BusinessLogicError, assertExists } from '../errors/index.js';
import { logEvent, logPerformance } from '../utils/logger.js';
import { withTransaction } from '../utils/dbTransaction.js';
import pool from '../configs/db.js';
import logger from '../utils/logger.js';

// Order Service - contains business logic and orchestrates order operations
class OrderService {
  // Get paginated orders with optional filtering
  async getOrders({ page = 1, limit = 20, status, search, sortBy = 'created_at', sortOrder = 'DESC', organizationId = undefined }) {
    const { orders, totalCount } = await OrderRepository.findOrders({
      page,
      limit,
      status,
      search,
      sortBy,
      sortOrder,
      organizationId
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
  async getOrderById(id, organizationId = undefined) {
    const order = await OrderRepository.findOrderWithItems(id, organizationId);
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
        // Build order record with all fields from request
        // Generate human-readable order number if not supplied
        const now = new Date();
        const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
        const randPart = Math.floor(10000 + Math.random() * 90000);

        const orderRecord = {
          order_number: orderData.order_number || `ORD-${datePart}-${randPart}`,
          external_order_id: orderData.external_order_id || null,
          platform: orderData.platform || 'api',
          customer_name: orderData.customer_name,
          customer_email: orderData.customer_email,
          customer_phone: orderData.customer_phone || null,
          status: orderData.status || 'created',
          priority: orderData.priority || 'standard',
          order_type: orderData.order_type || 'regular',
          organization_id: orderData.organization_id || null,
          is_cod: orderData.is_cod || false,
          subtotal: orderData.subtotal || null,
          tax_amount: orderData.tax_amount || 0,
          shipping_amount: orderData.shipping_amount || 0,
          discount_amount: orderData.discount_amount || 0,
          total_amount: orderData.total_amount,
          currency: orderData.currency || 'INR',
          shipping_address: JSON.stringify(orderData.shipping_address),
          billing_address: orderData.billing_address ? JSON.stringify(orderData.billing_address) : null,
          estimated_delivery: orderData.estimated_delivery || null,
          notes: orderData.notes || null,
          special_instructions: orderData.special_instructions || null,
          tags: orderData.tags ? JSON.stringify(orderData.tags) : null
        };

        // Prepare items with complete shipping attributes
        const items = orderData.items.map(item => ({
          product_id: item.product_id,
          sku: item.sku,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount || 0,
          tax: item.tax || 0,
          total_price: item.total_price || (item.unit_price * item.quantity),
          weight: item.weight || null,
          dimensions: item.dimensions ? JSON.stringify(item.dimensions) : null,
          is_fragile: item.is_fragile || false,
          is_hazardous: item.is_hazardous || false,
          is_perishable: item.is_perishable || false,
          requires_cold_storage: item.requires_cold_storage || false,
          item_type: item.item_type || 'general',
          package_type: item.package_type || 'box',
          handling_instructions: item.handling_instructions || null,
          requires_insurance: item.requires_insurance || false,
          declared_value: item.declared_value || null,
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
          
          // Find eligible carriers (only available ones)
          const carriersResult = await tx.query(
            `SELECT id, code, name, contact_email, service_type, is_active, availability_status
             FROM carriers 
             WHERE is_active = true 
             AND availability_status = 'available'
             AND (service_type = $1 OR service_type = 'all')
             ORDER BY reliability_score DESC
             LIMIT 3`,
            [serviceType]
          );

          if (carriersResult.rows.length === 0) {
            logger.warn(`No available carriers for new order. Order will remain in pending_carrier_assignment.`, { orderId: order.id, serviceType });
            // Don't throw error - let retry service handle this
            // Order stays in pending_carrier_assignment status
          } else {

          // Create carrier assignments within same transaction
          for (const carrier of carriersResult.rows) {
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minute window per batch

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
   * Create Transfer Order - Warehouse-to-warehouse inventory transfer
   * 
   * WORKFLOW:
   * 1. Validate warehouses exist and are active
   * 2. Check inventory availability at source warehouse
   * 3. Create order with type='transfer'
   * 4. Auto-create shipment for tracking
   * 5. Reserve inventory at source warehouse
   * 
   * DELIVERY HOOK: When shipment status='delivered', 
   * inventory is auto-transferred via shipmentsController
   * 
   * @param {Object} transferData - Transfer order data
   * @param {string} transferData.from_warehouse_id - Source warehouse ID
   * @param {string} transferData.to_warehouse_id - Destination warehouse ID
   * @param {Array} transferData.items - Items to transfer [{product_id, sku, product_name, quantity, unit_cost}]
   * @param {string} transferData.priority - 'express' | 'standard' | 'bulk'
   * @param {string} transferData.reason - Reason for transfer (required)
   * @param {string} transferData.requested_by - User who requested transfer
   * @param {string} transferData.notes - Additional notes
   * @param {Date} transferData.expected_delivery_date - Expected delivery date
   * 
   * @returns {Object} Created transfer order with shipment details
   */
  async createTransferOrder(transferData) {
    const startTime = Date.now();

    try {
      const result = await withTransaction(async (tx) => {
        // 1. Fetch warehouse details
        const fromWarehouse = await WarehouseRepository.findByIdWithDetails(
          transferData.from_warehouse_id,
          tx
        );
        const toWarehouse = await WarehouseRepository.findByIdWithDetails(
          transferData.to_warehouse_id,
          tx
        );

        assertExists(fromWarehouse, 'Source warehouse');
        assertExists(toWarehouse, 'Destination warehouse');

        if (!fromWarehouse.is_active) {
          throw new BusinessLogicError('Source warehouse is not active');
        }
        if (!toWarehouse.is_active) {
          throw new BusinessLogicError('Destination warehouse is not active');
        }

        // 2. Check inventory availability at source warehouse
        for (const item of transferData.items) {
          const inventory = await InventoryRepository.findBySKUAndWarehouse(
            item.sku,
            transferData.from_warehouse_id,
            tx
          );

          if (!inventory) {
            throw new NotFoundError(`SKU ${item.sku} not found in source warehouse`);
          }

          if (inventory.quantity_available < item.quantity) {
            throw new BusinessLogicError(
              `Insufficient stock for SKU ${item.sku}. Available: ${inventory.quantity_available}, Requested: ${item.quantity}`
            );
          }
        }

        // 3. Transform transfer request into order format
        const totalAmount = transferData.items.reduce(
          (sum, item) => sum + (item.unit_cost || 0) * item.quantity,
          0
        );

        const orderData = {
          order_number: `TRF-${Date.now()}`,
          order_type: 'transfer',
          customer_name: `Transfer: ${fromWarehouse.warehouse_name} → ${toWarehouse.warehouse_name}`,
          customer_email: toWarehouse.contact_email || 'transfers@system.local',
          customer_phone: toWarehouse.contact_phone || null,
          status: 'pending',
          priority: transferData.priority || 'standard',
          total_amount: totalAmount,
          currency: 'INR',
          shipping_address: toWarehouse.address,
          billing_address: fromWarehouse.address,
          estimated_delivery: transferData.expected_delivery_date || null,
          notes: `TRANSFER ORDER\nReason: ${transferData.reason}\nRequested by: ${transferData.requested_by || 'System'}\nNotes: ${transferData.notes || 'N/A'}`,
          special_instructions: `INTERNAL TRANSFER - Handle with care`,
          tags: JSON.stringify(['transfer', 'internal', transferData.priority]),
          items: transferData.items.map(item => ({
            product_id: item.product_id,
            sku: item.sku,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_cost || 0,
            total_price: (item.unit_cost || 0) * item.quantity,
            warehouse_id: transferData.from_warehouse_id,
            item_type: 'general',
            package_type: 'box'
          }))
        };

        // 4. Create order using existing infrastructure (but don't request carrier assignment)
        const order = await OrderRepository.createOrderWithItems(
          {
            order_number: orderData.order_number,
            customer_name: orderData.customer_name,
            customer_email: orderData.customer_email,
            customer_phone: orderData.customer_phone,
            status: orderData.status,
            priority: orderData.priority,
            order_type: orderData.order_type,
            is_cod: false,
            subtotal: totalAmount,
            tax_amount: 0,
            shipping_amount: 0,
            discount_amount: 0,
            total_amount: totalAmount,
            currency: orderData.currency,
            shipping_address: JSON.stringify(orderData.shipping_address),
            billing_address: JSON.stringify(orderData.billing_address),
            estimated_delivery: orderData.estimated_delivery,
            notes: orderData.notes,
            special_instructions: orderData.special_instructions,
            tags: orderData.tags
          },
          orderData.items,
          tx
        );

        // 5. Reserve inventory at source warehouse
        for (const item of transferData.items) {
          const reserved = await InventoryRepository.reserveStock(
            item.sku,
            transferData.from_warehouse_id,
            item.quantity,
            tx
          );

          if (!reserved) {
            throw new BusinessLogicError(`Failed to reserve inventory for SKU: ${item.sku}`);
          }
        }

        // 6. Auto-create shipment for tracking (internal carrier)
        // Calculate estimated dates
        const pickupDate = new Date();
        pickupDate.setHours(pickupDate.getHours() + 2); // Pickup in 2 hours

        let deliveryDate = new Date();
        if (transferData.priority === 'express') {
          deliveryDate.setDate(deliveryDate.getDate() + 1); // Next day
        } else if (transferData.priority === 'bulk') {
          deliveryDate.setDate(deliveryDate.getDate() + 5); // 5 days
        } else {
          deliveryDate.setDate(deliveryDate.getDate() + 3); // 3 days (standard)
        }

        const shipmentResult = await tx.query(
          `INSERT INTO shipments 
           (shipment_number, order_id, warehouse_id, carrier_id, status, 
            origin_address, destination_address, 
            estimated_pickup_date, estimated_delivery_date,
            tracking_notes, created_at, updated_at)
           VALUES ($1, $2, $3, 
                   (SELECT id FROM carriers WHERE code = 'INTERNAL' LIMIT 1), 
                   $4, $5, $6, $7, $8, $9, NOW(), NOW())
           RETURNING id, shipment_number, status, estimated_delivery_date`,
          [
            `SHP-TRF-${Date.now()}`,
            order.id,
            transferData.from_warehouse_id,
            'pending',
            JSON.stringify(fromWarehouse.address),
            JSON.stringify(toWarehouse.address),
            pickupDate,
            transferData.expected_delivery_date || deliveryDate,
            `Transfer from ${fromWarehouse.warehouse_name} to ${toWarehouse.warehouse_name}`
          ]
        );

        const shipment = shipmentResult.rows[0];

        // Log event
        logger.info('Transfer order created', {
          orderId: order.id,
          orderNumber: order.order_number,
          shipmentId: shipment.id,
          fromWarehouse: fromWarehouse.warehouse_name,
          toWarehouse: toWarehouse.warehouse_name,
          itemCount: transferData.items.length,
          totalAmount
        });

        return {
          order,
          shipment,
          fromWarehouse: {
            id: fromWarehouse.id,
            name: fromWarehouse.warehouse_name,
            code: fromWarehouse.warehouse_code
          },
          toWarehouse: {
            id: toWarehouse.id,
            name: toWarehouse.warehouse_name,
            code: toWarehouse.warehouse_code
          }
        };
      });

      logPerformance('createTransferOrder', Date.now() - startTime);
      
      return result;
      
    } catch (error) {
      logger.error('Failed to create transfer order', {
        error: error.message,
        transferData: {
          from: transferData.from_warehouse_id,
          to: transferData.to_warehouse_id,
          itemCount: transferData.items?.length
        }
      });
      throw error;
    }
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
