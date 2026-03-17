import OrderRepository from '../repositories/OrderRepository.js';
import InventoryRepository from '../repositories/InventoryRepository.js';
import WarehouseRepository from '../repositories/WarehouseRepository.js';
import CarrierRepository from '../repositories/CarrierRepository.js';
import ShipmentRepository from '../repositories/ShipmentRepository.js';
import ProductRepository from '../repositories/ProductRepository.js';
import ReturnRepository from '../repositories/ReturnRepository.js';
import { NotFoundError, BusinessLogicError, assertExists } from '../errors/index.js';
import { logEvent, logPerformance } from '../utils/logger.js';
import { withTransaction } from '../utils/dbTransaction.js';
import logger from '../utils/logger.js';

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
  out_for_delivery:           ['delivered', 'returned', 'cancelled'],
  delivered:                  [], // terminal — no forward transitions
  returned:                   [], // terminal
  cancelled:                  [], // terminal
  on_hold:                    ['created', 'confirmed', 'allocated', 'cancelled'],
};

const IN_TRANSIT_CANCEL_STATUSES = new Set(['shipped', 'in_transit', 'out_for_delivery']);

function parseJsonValue(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toCoordinates(address = {}) {
  const lat = Number(address.lat ?? address.latitude ?? address.coordinates?.lat);
  const lon = Number(address.lon ?? address.lng ?? address.longitude ?? address.coordinates?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

function estimateReverseShippingCost(originAddress, destinationAddress) {
  const from = toCoordinates(originAddress);
  const to = toCoordinates(destinationAddress);
  if (!from || !to) {
    return { estimatedCost: 120, distanceKm: null };
  }
  const distanceKm = Math.max(1, Math.round(haversineKm(from, to)));
  const estimatedCost = Math.round(45 + (distanceKm * 6.5));
  return { estimatedCost, distanceKm };
}

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
        //   1. Match SKU/product_id → product in products table (MUST exist — no auto-create)
        //   2. Auto-assign warehouse with sufficient stock (MUST have available inventory)
        //   3. Reserve stock — order is REJECTED if stock is insufficient
        //
        // PRODUCTION RULE: Products must be created via the MDM API and assigned
        // inventory in a warehouse BEFORE orders (webhook or API) can reference them.
        // Use GET /api/webhooks/:orgToken/catalog to fetch orderable products.
        const orgId = orderData.organization_id;
        const enrichedItems = [];

        for (const item of orderData.items) {
          let product = null;

          // 1. Resolve product by product_id or SKU — must already exist in catalog
          if (item.product_id) {
            product = await ProductRepository.findById(item.product_id, orgId, tx);
          } else if (item.sku) {
            product = await ProductRepository.findBySku(item.sku, orgId, tx);
          }

          // Product MUST exist — no auto-creation for any order type
          if (!product) {
            throw new BusinessLogicError(
              item.sku
                ? `Product with SKU "${item.sku}" not found in catalog. ` +
                  `Products must be created via the MDM API and assigned inventory before orders can be placed. ` +
                  `Use GET /api/webhooks/:orgToken/catalog to list available products.`
                : `Product not found. Each item must reference a valid product_id or SKU that exists in the catalog with available inventory.`
            );
          }

          // Enrich item with product data where not already provided
          const enrichedItem = {
            product_id: product?.id || item.product_id || null,
            sku: product?.sku || item.sku,
            product_name: item.product_name || product?.name || 'Unknown',
            quantity: item.quantity,
            unit_price: item.unit_price || parseFloat(product?.selling_price) || 0,
            discount: item.discount || 0,
            tax: item.tax || 0,
            total_price: item.total_price || ((item.unit_price || parseFloat(product?.selling_price) || 0) * item.quantity),
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

          // 4. Require warehouse with available stock — no warehouse = reject order
          if (!enrichedItem.warehouse_id && orgId && enrichedItem.sku) {
            const warehouseId = await InventoryRepository.findBestWarehouseForSku(
              enrichedItem.sku, orgId, enrichedItem.quantity, tx
            );
            if (warehouseId) {
              enrichedItem.warehouse_id = warehouseId;
              logger.debug(`Auto-assigned warehouse ${warehouseId} for SKU ${enrichedItem.sku}`);
            } else {
              throw new BusinessLogicError(
                `Insufficient inventory for SKU "${enrichedItem.sku}". ` +
                `Required quantity: ${enrichedItem.quantity}. ` +
                `Add stock via the inventory API before placing orders for this product.`
              );
            }
          } else if (!enrichedItem.warehouse_id) {
            throw new BusinessLogicError(
              `No warehouse assigned for SKU "${enrichedItem.sku || 'unknown'}" and no organization context to look up inventory. ` +
              `Ensure the order includes organization_id and the product has inventory assigned.`
            );
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
              throw new BusinessLogicError(
                `Insufficient stock for SKU "${item.sku}". ` +
                `Required: ${item.quantity}. Check available inventory and try again.`
              );
            }
          }
        }

        // Request carrier assignment within same transaction
        let assignments = [];
        let carriersToNotify = [];
        
        if (requestCarrierAssignment) {
          const serviceType = order.priority || 'standard';

          const primaryWarehouseId = enrichedItems.find(i => i.warehouse_id)?.warehouse_id || null;
          const pickupWarehouse = primaryWarehouseId
            ? await WarehouseRepository.findByIdWithDetails(primaryWarehouseId, orgId, tx)
            : null;

          const deliveryAddress = typeof order.shipping_address === 'string'
            ? JSON.parse(order.shipping_address)
            : order.shipping_address;

          const pickupAddress = pickupWarehouse
            ? {
                ...(pickupWarehouse.address || {}),
                coordinates: pickupWarehouse.coordinates
                  ? {
                      lat: Number(pickupWarehouse.coordinates.lat),
                      lng: Number(pickupWarehouse.coordinates.lng),
                    }
                  : undefined,
              }
            : deliveryAddress;
          
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
              shippingAddress: deliveryAddress,
              pickupAddress,
              deliveryAddress,
              items: orderData.items || [],
              requestedAt: new Date()
            };

            const idempotencyKey = `${order.id}-carrier-${carrier.id}-${Date.now()}`;

            const assignment = await CarrierRepository.createCarrierAssignment(
              {
                orderId: order.id,
                carrierId: carrier.id,
                organizationId: orgId || null,
                serviceType,
                status: 'pending',
                pickupAddress,
                deliveryAddress,
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
      // External API calls happen outside transaction.
      // Shipment creation is deferred to bidding-window finalization.
      
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
        const affectedWarehouses = new Set();
        for (const item of items) {
          if (!item.warehouse_id || !item.sku) continue;
          if (status === 'cancelled') {
            // If already in transit, stock has left the warehouse and must return via reverse logistics.
            if (!IN_TRANSIT_CANCEL_STATUSES.has(oldStatus)) {
              await InventoryRepository.releaseStock(item.sku, item.warehouse_id, item.quantity, tx);
            }
          } else {
            // shipped: convert reservation to an actual deduction — stock permanently leaves
            await InventoryRepository.deductStock(item.sku, item.warehouse_id, item.quantity, tx);
            affectedWarehouses.add(item.warehouse_id);
          }
        }
        // Recompute utilization for every warehouse that lost stock
        for (const wid of affectedWarehouses) {
          try {
            await WarehouseRepository.refreshUtilization(wid, tx);
          } catch (e) {
            logger.warn('refreshUtilization failed (non-fatal)', { warehouseId: wid, error: e.message });
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

  /**
   * Deduct stock for all items in an order (call when order physically leaves warehouse).
   * Safe to call inside an existing transaction (pass tx).
   * If deductStock returns null for any item, the item no longer has enough reserved stock —
   * we log a warning but continue rather than aborting the shipment.
   */
  async commitOrderStock(orderId, tx = null) {
    const items = await OrderRepository.findOrderItems(orderId, tx);
    const affectedWarehouses = new Set();
    for (const item of items) {
      if (!item.warehouse_id || !item.sku) continue;
      const result = await InventoryRepository.deductStock(item.sku, item.warehouse_id, item.quantity, tx);
      if (!result) {
        logger.warn('deductStock returned null — possible double-deduction or insufficient qty', {
          orderId, sku: item.sku, warehouseId: item.warehouse_id, qty: item.quantity,
        });
      }
      affectedWarehouses.add(item.warehouse_id);
    }
    for (const wid of affectedWarehouses) {
      try {
        await WarehouseRepository.refreshUtilization(wid, tx);
      } catch (e) {
        logger.warn('refreshUtilization failed (non-fatal)', { warehouseId: wid, error: e.message });
      }
    }
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
          undefined,
          tx
        );
        const toWarehouse = await WarehouseRepository.findByIdWithDetails(
          transferData.to_warehouse_id,
          undefined,
          tx
        );

        assertExists(fromWarehouse, 'Source warehouse');
        assertExists(toWarehouse, 'Destination warehouse');

        const fromWarehouseName = fromWarehouse.name || fromWarehouse.warehouse_name || 'Source Warehouse';
        const toWarehouseName = toWarehouse.name || toWarehouse.warehouse_name || 'Destination Warehouse';
        const fromWarehouseCode = fromWarehouse.code || fromWarehouse.warehouse_code || null;
        const toWarehouseCode = toWarehouse.code || toWarehouse.warehouse_code || null;

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
          customer_name: `Transfer: ${fromWarehouseName} → ${toWarehouseName}`,
          customer_email: toWarehouse.contact_email || 'transfers@system.local',
          customer_phone: toWarehouse.contact_phone || null,
          status: 'created',
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
            originAddress: {
              ...(fromWarehouse.address || {}),
              coordinates: fromWarehouse.coordinates
                ? {
                    lat: Number(fromWarehouse.coordinates.lat),
                    lng: Number(fromWarehouse.coordinates.lng),
                  }
                : undefined,
            },
            destinationAddress: {
              ...(toWarehouse.address || {}),
              coordinates: toWarehouse.coordinates
                ? {
                    lat: Number(toWarehouse.coordinates.lat),
                    lng: Number(toWarehouse.coordinates.lng),
                  }
                : undefined,
            },
            estimatedPickup: pickupDate,
            estimatedDelivery: transferData.expected_delivery_date || deliveryDate,
            notes: `Transfer from ${fromWarehouseName} to ${toWarehouseName}`,
          },
          tx
        );

        // 7. Create a pending assignment for the internal/demo carrier so it appears
        // in the carrier portal flow as well.
        let transferAssignment = null;
        let targetCarrier = await CarrierRepository.findByCode('INTERNAL', organizationId, tx);
        if (!targetCarrier) {
          const fallbackCarriers = await CarrierRepository.findEligibleCarriers(
            transferData.priority || 'standard',
            1,
            tx
          );
          targetCarrier = fallbackCarriers[0] || null;
        }

        if (targetCarrier) {
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 24);

          const requestPayload = {
            orderId: order.id,
            orderNumber: order.order_number,
            orderType: 'transfer',
            serviceType: transferData.priority || 'standard',
            customerName: order.customer_name,
            totalAmount: parseFloat(order.total_amount),
            transfer: {
              fromWarehouseId: fromWarehouse.id,
              fromWarehouseCode: fromWarehouseCode,
              fromWarehouseName: fromWarehouseName,
              toWarehouseId: toWarehouse.id,
              toWarehouseCode: toWarehouseCode,
              toWarehouseName: toWarehouseName,
            },
            shipment: {
              id: shipment.id,
              trackingNumber: shipment.tracking_number,
              estimatedDelivery: shipment.estimated_delivery_date,
            },
            items: transferData.items || [],
            requestedAt: new Date(),
          };

          transferAssignment = await CarrierRepository.createCarrierAssignment(
            {
              orderId: order.id,
              carrierId: targetCarrier.id,
              organizationId: organizationId || null,
              serviceType: transferData.priority || 'standard',
              status: 'pending',
              pickupAddress: {
                ...(fromWarehouse.address || {}),
                coordinates: fromWarehouse.coordinates
                  ? {
                      lat: Number(fromWarehouse.coordinates.lat),
                      lng: Number(fromWarehouse.coordinates.lng),
                    }
                  : undefined,
              },
              deliveryAddress: {
                ...(toWarehouse.address || {}),
                coordinates: toWarehouse.coordinates
                  ? {
                      lat: Number(toWarehouse.coordinates.lat),
                      lng: Number(toWarehouse.coordinates.lng),
                    }
                  : undefined,
              },
              estimatedPickup: pickupDate,
              estimatedDelivery: transferData.expected_delivery_date || deliveryDate,
              requestPayload,
              expiresAt,
              idempotencyKey: `${order.id}-carrier-${targetCarrier.id}-transfer-${Date.now()}`,
            },
            tx
          );
        }

        // Log event
        logger.info('Transfer order created', {
          orderId: order.id,
          orderNumber: order.order_number,
          shipmentId: shipment.id,
          assignmentId: transferAssignment?.id || null,
          fromWarehouse: fromWarehouseName,
          toWarehouse: toWarehouseName,
          itemCount: transferData.items.length,
          totalAmount
        });

        return {
          order,
          shipment,
          assignment: transferAssignment,
          fromWarehouse: {
            id: fromWarehouse.id,
            name: fromWarehouseName,
            code: fromWarehouseCode
          },
          toWarehouse: {
            id: toWarehouse.id,
            name: toWarehouseName,
            code: toWarehouseCode
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
      const order = await OrderRepository.findById(id, tx);
      assertExists(order, 'Order');

      if (organizationId !== undefined && order.organization_id !== organizationId) {
        throw new NotFoundError('Order');
      }

      if (order.status === 'cancelled') {
        throw new BusinessLogicError('Order is already cancelled');
      }
      if (order.status === 'delivered') {
        throw new BusinessLogicError('Delivered orders cannot be cancelled. Initiate a return instead.');
      }
      if (order.status === 'returned') {
        throw new BusinessLogicError('Order is already returned');
      }

      const items = await OrderRepository.findOrderItems(id, tx);
      const shipments = await ShipmentRepository.findByOrderId(id, undefined, tx);
      const latestShipment = shipments[0] || null;

      let reverseShipment = null;
      let returnShippingCost = null;

      if (IN_TRANSIT_CANCEL_STATUSES.has(order.status) && latestShipment) {
        const shipmentDestination = parseJsonValue(latestShipment.destination_address, {});
        const shipmentOrigin = parseJsonValue(latestShipment.origin_address, {});
        const currentLocation = parseJsonValue(latestShipment.current_location, shipmentDestination);
        const reverseDestination = shipmentOrigin;
        const { estimatedCost, distanceKm } = estimateReverseShippingCost(currentLocation, reverseDestination);

        returnShippingCost = { amount: estimatedCost, currency: order.currency || 'INR', distanceKm };
        const eta = new Date();
        eta.setDate(eta.getDate() + 2);

        reverseShipment = await ShipmentRepository.createReverseShipment(
          {
            trackingNumber: `RTN-${Date.now().toString(36).toUpperCase()}-${String(id).slice(0, 6).toUpperCase()}`,
            orderId: id,
            carrierId: latestShipment.carrier_id || null,
            organizationId: order.organization_id || null,
            originAddress: currentLocation,
            destinationAddress: reverseDestination,
            currentLocation,
            shippingCost: estimatedCost,
            deliveryScheduled: eta,
            notes: `Reverse shipment created from current transit location for cancellation of ${order.order_number}`,
          },
          tx
        );

        await ShipmentRepository.addTrackingEvent(
          {
            shipment_id: reverseShipment.id,
            event_type: 'reverse_shipment_created',
            location: currentLocation,
            description: `Return-to-origin started. Estimated reverse logistics cost: ${estimatedCost} ${order.currency || 'INR'}`,
          },
          tx
        );

        await ShipmentRepository.updateStatus(latestShipment.id, 'returned', undefined, currentLocation, tx);
      } else {
        for (const item of items) {
          if (!item.warehouse_id || !item.sku) continue;
          await InventoryRepository.releaseStock(item.sku, item.warehouse_id, item.quantity, tx);
        }
      }

      const cancelledOrder = await OrderRepository.updateStatus(id, 'cancelled', organizationId, tx);

      logEvent('OrderCancelled', {
        orderId: cancelledOrder.id,
        orderNumber: cancelledOrder.order_number,
        itemCount: items.length,
        reverseShipmentId: reverseShipment?.id || null,
        reverseShipmentCost: returnShippingCost?.amount || null,
      });

      return {
        ...cancelledOrder,
        reverse_shipment: reverseShipment,
        return_shipping_cost: returnShippingCost,
      };
    });
  }

  async initiateReturnForDeliveredOrder(orderId, payload = {}, organizationId = undefined) {
    return withTransaction(async (tx) => {
      const order = await OrderRepository.findOrderWithItems(orderId, organizationId, tx);
      assertExists(order, 'Order');

      if (order.status !== 'delivered') {
        throw new BusinessLogicError('Only delivered orders can start a return flow from orders API');
      }

      const existingReturns = await ReturnRepository.findByOrderId(orderId, organizationId, tx);
      const openReturn = existingReturns.find(r => !['rejected', 'cancelled', 'completed', 'refunded', 'restocked'].includes(r.status));
      if (openReturn) {
        throw new BusinessLogicError(`Order already has an active return (${openReturn.rma_number})`);
      }

      const orderItems = Array.isArray(order.items) ? order.items : [];
      const requestedItems = Array.isArray(payload.items) && payload.items.length > 0
        ? payload.items
        : orderItems.map(item => ({
            product_id: item.product_id,
            sku: item.sku,
            product_name: item.product_name,
            quantity: item.quantity,
          }));

      const validatedItems = requestedItems.map((item) => {
        const match = orderItems.find(oi =>
          (item.product_id && oi.product_id === item.product_id) ||
          (item.sku && oi.sku === item.sku)
        );

        if (!match) {
          throw new BusinessLogicError(`Return item not part of order: ${item.sku || item.product_id}`);
        }

        const qty = Number(item.quantity || 0);
        if (!Number.isFinite(qty) || qty <= 0 || qty > Number(match.quantity)) {
          throw new BusinessLogicError(`Invalid return quantity for ${match.sku}. Allowed max: ${match.quantity}`);
        }

        return {
          product_id: match.product_id,
          sku: match.sku,
          product_name: match.product_name,
          quantity: qty,
          condition: item.condition || null,
          reason: payload.reason || 'customer_return',
        };
      });

      const rmaNumber = `RMA-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const createdReturn = await ReturnRepository.createReturnWithItems(
        {
          rma_number: rmaNumber,
          order_id: orderId,
          reason: payload.reason || 'customer_return',
          reason_detail: payload.reason_details || null,
          customer_email: payload.customer_email || order.customer_email || null,
          refund_amount: payload.refund_amount ?? null,
          organization_id: order.organization_id || null,
        },
        validatedItems,
        tx
      );

      logEvent('OrderReturnInitiated', {
        orderId: order.id,
        orderNumber: order.order_number,
        returnId: createdReturn.id,
        rmaNumber,
        itemCount: validatedItems.length,
      });

      return createdReturn;
    });
  }
}

export default new OrderService();
