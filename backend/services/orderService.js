import OrderRepository from '../repositories/OrderRepository.js';
import InventoryRepository from '../repositories/InventoryRepository.js';
import WarehouseRepository from '../repositories/WarehouseRepository.js';
import CarrierRepository from '../repositories/CarrierRepository.js';
import ShipmentRepository from '../repositories/ShipmentRepository.js';
import ProductRepository from '../repositories/ProductRepository.js';
import { NotFoundError, BusinessLogicError, assertExists } from '../errors/index.js';
import { logEvent, logPerformance } from '../utils/logger.js';
import { withTransaction } from '../utils/dbTransaction.js';
import logger from '../utils/logger.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generate a reasonable SKU from a product name when none was provided.
 * Format: {PREFIX}-{YYYYMM}-{RAND5}  e.g. LAPTOP-202507-K3P9Q
 */
function generateSkuFromName(name) {
  const prefix = (name || 'ITEM')
    .replace(/[^A-Z0-9\s]/gi, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w.slice(0, 3).toUpperCase())
    .join('')
    .slice(0, 6) || 'ITEM';
  const month = new Date().toISOString().slice(0, 7).replace('-', '');
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${month}-${rand}`;
}

// ─── Order State Machine ────────────────────────────────────────────────────
// Defines which status transitions are legal.  An order can only move forward
// through the pipeline (or be cancelled/held from most states).
const ORDER_VALID_TRANSITIONS = {
  created:                    ['confirmed', 'cancelled', 'on_hold'],
  confirmed:                  ['allocated', 'cancelled', 'on_hold'],
  allocated:                  ['processing', 'cancelled', 'on_hold'],
  processing:                 ['ready_to_ship', 'cancelled', 'on_hold'],
  ready_to_ship:              ['shipped', 'cancelled', 'on_hold'],
  pending_carrier_assignment: ['confirmed', 'allocated', 'cancelled', 'on_hold'],
  shipped:                    ['in_transit', 'returned', 'cancelled'],
  in_transit:                 ['out_for_delivery', 'returned', 'cancelled'],
  out_for_delivery:           ['delivered', 'returned'],
  delivered:                  [], // terminal — no forward transitions
  returned:                   [], // terminal
  cancelled:                  [], // terminal
  on_hold:                    ['created', 'confirmed', 'allocated', 'cancelled'],
};

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
        // Generate human-readable order number if not supplied — sequence-based to avoid races
        let generatedOrderNumber = orderData.order_number;
        if (!generatedOrderNumber) {
          const now = new Date();
          const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
          const seqPart = await OrderRepository.nextOrderNumberSeq(tx);
          generatedOrderNumber = `ORD-${datePart}-${seqPart}`;
        }

        const orderRecord = {
          order_number: generatedOrderNumber,
          external_order_id: orderData.external_order_id || null,
          platform: orderData.platform || 'api',
          customer_name: orderData.customer_name,
          customer_email: orderData.customer_email,
          customer_phone: orderData.customer_phone || null,
          status: 'created', // always starts as 'created' — not settable by client
          priority: orderData.priority || 'standard',
          order_type: orderData.order_type || 'regular',
          organization_id: orderData.organization_id || null,
          is_cod: orderData.is_cod || false,
          // Totals are populated after server-side calculation below
          subtotal: null,
          tax_amount: 0,
          shipping_amount: orderData.shipping_amount || 0,
          discount_amount: orderData.discount_amount || 0,
          total_amount: 0,
          currency: orderData.currency || 'INR',
          shipping_address: JSON.stringify(orderData.shipping_address),
          billing_address: orderData.billing_address ? JSON.stringify(orderData.billing_address) : null,
          estimated_delivery: orderData.estimated_delivery || null,
          notes: orderData.notes || null,
          special_instructions: orderData.special_instructions || null,
          tags: orderData.tags ? JSON.stringify(orderData.tags) : null
        };

        // ── Product Validation & Warehouse Allocation ────────────────────────────
        // For each item:
        //   1. Match SKU → product in products table (enrich with product data)
        //   2. If product not found AND this is a webhook order (has external_order_id), auto-create product
        //   3. Auto-assign warehouse if not specified (find best warehouse with stock)
        //   4. Validate stock availability
        const isWebhookOrder = !!orderData.external_order_id;
        const orgId = orderData.organization_id;
        const enrichedItems = [];

        for (const item of orderData.items) {
          let product = null;

          // 1. Resolve product by product_id or SKU
          if (item.product_id) {
            product = await ProductRepository.findById(item.product_id, orgId, tx);
          } else if (item.sku) {
            product = await ProductRepository.findBySku(item.sku, orgId, tx);
          }

          // 2. For webhook orders: auto-create product if not found
          if (!product && isWebhookOrder) {
            // Generate a SKU if the webhook didn't provide one
            const productName = item.product_name || item.name || 'ITEM';
            const autoSku = item.sku || generateSkuFromName(productName);
            logger.info(`Auto-creating product from webhook for SKU: ${autoSku}`);
            product = await ProductRepository.create({
              organization_id: orgId,
              sku: autoSku,
              name: productName,
              category: item.category || null,
              weight: item.weight || null,
              dimensions: item.dimensions || null,
              unit_price: item.unit_price || item.price || null,
              is_fragile: item.is_fragile || false,
              is_hazmat: item.is_hazardous || false,
              is_perishable: item.is_perishable || false,
              requires_cold_storage: item.requires_cold_storage || false,
              item_type: item.item_type || 'general',
              package_type: item.package_type || 'box',
              requires_insurance: item.requires_insurance || false,
              declared_value: item.declared_value || null,
            }, tx);
          }

          // 3. For API orders: product must exist
          if (!product && !isWebhookOrder) {
            throw new BusinessLogicError(
              item.sku
                ? `Product with SKU "${item.sku}" not found. Create the product first or add it to inventory.`
                : `Product not found. Each item must reference a valid product_id or SKU.`
            );
          }

          // Enrich item with product data where not already provided
          const enrichedItem = {
            product_id: product?.id || item.product_id || null,
            sku: product?.sku || item.sku,
            product_name: item.product_name || product?.name || 'Unknown',
            quantity: item.quantity,
            unit_price: item.unit_price || parseFloat(product?.unit_price) || 0,
            discount: item.discount || 0,
            tax: item.tax || 0,
            total_price: item.total_price || ((item.unit_price || parseFloat(product?.unit_price) || 0) * item.quantity),
            weight: item.weight || parseFloat(product?.weight) || null,
            dimensions: item.dimensions ? JSON.stringify(item.dimensions) : (product?.dimensions || null),
            is_fragile: item.is_fragile ?? product?.is_fragile ?? false,
            is_hazardous: item.is_hazardous ?? product?.is_hazmat ?? false,
            is_perishable: item.is_perishable ?? product?.is_perishable ?? false,
            requires_cold_storage: item.requires_cold_storage ?? product?.requires_cold_storage ?? false,
            item_type: item.item_type || product?.item_type || 'general',
            package_type: item.package_type || product?.package_type || 'box',
            handling_instructions: item.handling_instructions || product?.handling_instructions || null,
            requires_insurance: item.requires_insurance ?? product?.requires_insurance ?? false,
            declared_value: item.declared_value || parseFloat(product?.declared_value) || null,
            warehouse_id: item.warehouse_id || null,
          };

          // 4. Auto-assign warehouse if not specified
          if (!enrichedItem.warehouse_id && orgId && enrichedItem.sku) {
            const warehouseId = await InventoryRepository.findBestWarehouseForSku(
              enrichedItem.sku, orgId, enrichedItem.quantity, tx
            );
            if (warehouseId) {
              enrichedItem.warehouse_id = warehouseId;
              logger.debug(`Auto-assigned warehouse ${warehouseId} for SKU ${enrichedItem.sku}`);
            } else {
              logger.warn(`No warehouse with sufficient stock for SKU ${enrichedItem.sku} (qty: ${enrichedItem.quantity})`);
            }
          }

          enrichedItems.push(enrichedItem);
        }

        // SERVER-SIDE recalculation of financial totals — never trust client-supplied values
        const serverSubtotal = enrichedItems.reduce((sum, item) => {
          const lineTotal = (item.unit_price * item.quantity) - (item.discount || 0);
          return sum + lineTotal;
        }, 0);
        const serverTaxAmount = enrichedItems.reduce((sum, item) => sum + (item.tax || 0), 0);
        const shippingAmount = orderData.shipping_amount || 0;
        const discountAmount = orderData.discount_amount || 0;
        const serverTotal = serverSubtotal + serverTaxAmount + shippingAmount - discountAmount;

        // Override any client-supplied totals with server-calculated values
        orderRecord.subtotal = serverSubtotal;
        orderRecord.tax_amount = serverTaxAmount;
        orderRecord.shipping_amount = shippingAmount;
        orderRecord.discount_amount = discountAmount;
        orderRecord.total_amount = serverTotal;

        // Create order with items in transaction
        const order = await OrderRepository.createOrderWithItems(orderRecord, enrichedItems, tx);

        // Reserve inventory for each item that has a warehouse assignment
        for (const item of enrichedItems) {
          if (item.warehouse_id && item.sku) {
            const reserved = await InventoryRepository.reserveStock(
              item.sku,
              item.warehouse_id,
              item.quantity,
              tx
            );
            
            if (!reserved) {
              if (isWebhookOrder) {
                // Webhook orders: don't reject — flag for attention, order continues without reservation
                logger.warn(`Insufficient stock for SKU ${item.sku} (qty: ${item.quantity}). Order will proceed without reservation.`, { orderId: order.id });
              } else {
                throw new BusinessLogicError(
                  `Insufficient stock for SKU "${item.sku}". ` +
                  `Required: ${item.quantity}. Check available inventory and try again.`
                );
              }
            }
          }
        }

        // Request carrier assignment within same transaction
        let assignments = [];
        let carriersToNotify = [];
        
        if (requestCarrierAssignment) {
          const serviceType = order.priority || 'standard';
          
          // Find eligible carriers (only available ones)
          const eligibleCarriers = await CarrierRepository.findEligibleCarriers(serviceType, 3, tx);

          if (eligibleCarriers.length === 0) {
            logger.warn(`No available carriers for new order. Order will remain in pending_carrier_assignment.`, { orderId: order.id, serviceType });
            // Don't throw error - let retry service handle this
            // Order stays in pending_carrier_assignment status
          } else {

          // Create carrier assignments within same transaction
          for (const carrier of eligibleCarriers) {
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

            const assignment = await CarrierRepository.createCarrierAssignment(
              {
                orderId: order.id,
                carrierId: carrier.id,
                serviceType,
                status: 'pending',
                pickupAddress: order.shipping_address,
                deliveryAddress: order.shipping_address,
                estimatedPickup: new Date(Date.now() + 2 * 60 * 60 * 1000),
                estimatedDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000),
                requestPayload,
                expiresAt,
                idempotencyKey,
              },
              tx
            );

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
          await OrderRepository.updateStatus(order.id, 'pending_carrier_assignment', tx);
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

  // Update order status with state-machine validation + inventory lifecycle
  async updateOrderStatus(id, status, organizationId = undefined) {
    return withTransaction(async (tx) => {
      // Lock the order row inside the transaction to prevent concurrent status races
      const order = await OrderRepository.findById(id, undefined, tx);
      assertExists(order, 'Order');

      const oldStatus = order.status;

      // Enforce valid transitions
      const allowed = ORDER_VALID_TRANSITIONS[oldStatus];
      if (allowed === undefined) {
        throw new BusinessLogicError(`Unknown current order status: '${oldStatus}'`);
      }
      if (!allowed.includes(status)) {
        throw new BusinessLogicError(
          `Invalid status transition for order ${id}: '${oldStatus}' → '${status}'. ` +
          `Allowed: ${allowed.length ? allowed.join(', ') : '(none — terminal state)'}`
        );
      }

      // ── Inventory Lifecycle ─────────────────────────────────────────────────────
      // cancelled → release all reserved stock back to available
      // shipped   → commit reservations: deduct from total quantity (stock leaves warehouse)
      if (status === 'cancelled' || status === 'shipped') {
        const items = await OrderRepository.findOrderItems(id, tx);
        for (const item of items) {
          if (!item.warehouse_id || !item.sku) continue;
          if (status === 'cancelled') {
            await InventoryRepository.releaseStock(item.sku, item.warehouse_id, item.quantity, tx);
          } else {
            // shipped: convert reservation to an actual deduction — stock permanently leaves
            await InventoryRepository.deductStock(item.sku, item.warehouse_id, item.quantity, tx);
          }
        }
      }

      const updatedOrder = await OrderRepository.updateStatus(id, status, organizationId, tx);

      logEvent('OrderStatusUpdated', {
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.order_number,
        oldStatus,
        newStatus: status,
      });

      return updatedOrder;
    });
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
  async createTransferOrder(transferData, organizationId = undefined) {
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

        const trnSeq = await OrderRepository.nextTransferOrderSeq(tx);

        const orderData = {
          order_number: `TRF-${trnSeq}`,
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
            organization_id: organizationId || null,
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

        const shipment = await ShipmentRepository.createTransferShipment(
          {
            orderId: order.id,
            warehouseId: transferData.from_warehouse_id,
            originAddress: fromWarehouse.address,
            destinationAddress: toWarehouse.address,
            estimatedPickup: pickupDate,
            estimatedDelivery: transferData.expected_delivery_date || deliveryDate,
            notes: `Transfer from ${fromWarehouse.warehouse_name} to ${toWarehouse.warehouse_name}`,
          },
          tx
        );

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
  async cancelOrder(id, organizationId = undefined) {
    return withTransaction(async (tx) => {
      // Get order items
      const items = await OrderRepository.findOrderItems(id, tx);

      // Release inventory for each item
      for (const item of items) {
        if (item.warehouse_id && item.sku) {
          await InventoryRepository.releaseStock(
            item.sku,
            item.warehouse_id,
            item.quantity,
            tx
          );
        }
      }

      // Update order status — pass undefined as organizationId then tx as client
      const order = await OrderRepository.updateStatus(id, 'cancelled', organizationId, tx);

      logEvent('OrderCancelled', {
        orderId: order.id,
        orderNumber: order.order_number,
        itemCount: items.length,
      });
      
      return order;
    });
  }
}

export default new OrderService();
