import OrderRepository from '../repositories/OrderRepository.js';
import InventoryRepository from '../repositories/InventoryRepository.js';
import WarehouseRepository from '../repositories/WarehouseRepository.js';
import CarrierRepository from '../repositories/CarrierRepository.js';
import ShipmentRepository from '../repositories/ShipmentRepository.js';
import ProductRepository from '../repositories/ProductRepository.js';
import ReturnRepository from '../repositories/ReturnRepository.js';
import { OPEN_RETURN_STATUSES } from '../config/returnStatuses.js';
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

/**
 * Safely parse JSON-like values.
 * @param {string|Object|null|undefined} value
 * @param {Object} fallback
 * @returns {Object}
 */
function parseJsonValue(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Extract normalized coordinates from arbitrary address payloads.
 * @param {Object} address
 * @returns {{lat: number, lon: number}|null}
 */
function toCoordinates(address = {}) {
  const lat = Number(address.lat ?? address.latitude ?? address.coordinates?.lat);
  const lon = Number(address.lon ?? address.lng ?? address.longitude ?? address.coordinates?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

/**
 * Great-circle distance in kilometers between two geo points.
 * @param {{lat: number, lon: number}} a
 * @param {{lat: number, lon: number}} b
 * @returns {number}
 */
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

/**
 * Estimate reverse shipping cost from geo distance.
 * @param {Object} originAddress
 * @param {Object} destinationAddress
 * @returns {{estimatedCost: number, distanceKm: number|null}}
 */
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

/**
 * Merge a raw address with optional warehouse coordinates.
 * @param {Object|null|undefined} address
 * @param {Object|null|undefined} coordinates
 * @param {Object|null} fallback
 * @returns {Object|null}
 */
function buildAddressWithCoordinates(address, coordinates, fallback = null) {
  if (!address && !coordinates) return fallback;
  return {
    ...(address || {}),
    coordinates: coordinates
      ? {
          lat: Number(coordinates.lat),
          lng: Number(coordinates.lng),
        }
      : undefined,
  };
}

/**
 * Execute async work serially for each item while avoiding await-in-loop constructs.
 * @param {Array} items
 * @param {(item: any) => Promise<void>} worker
 * @returns {Promise<void>}
 */
function runSerial(items, worker) {
  return items.reduce(
    (chain, item) => chain.then(() => worker(item)),
    Promise.resolve()
  );
}

/**
 * Resolve order items against product catalog and assign warehouses with stock.
 * @param {Array} items
 * @param {string|null|undefined} orgId
 * @param {object} tx
 * @returns {Promise<Array>}
 */
async function resolveAndEnrichOrderItems(items, orgId, tx) {
  const enrichedItems = [];

  await runSerial(items, async (item) => {
    let product = null;

    if (item.product_id) {
      product = await ProductRepository.findById(item.product_id, orgId, tx);
    } else if (item.sku) {
      product = await ProductRepository.findBySku(item.sku, orgId, tx);
    }

    if (!product) {
      throw new BusinessLogicError(
        item.sku
          ? `Product with SKU "${item.sku}" not found in catalog. Products must be created via the MDM API and assigned inventory before orders can be placed. Use GET /api/webhooks/:orgToken/catalog to list available products.`
          : 'Product not found. Each item must reference a valid product_id or SKU that exists in the catalog with available inventory.'
      );
    }

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

    if (!enrichedItem.warehouse_id && orgId && enrichedItem.sku) {
      const warehouseId = await InventoryRepository.findBestWarehouseForSku(
        enrichedItem.sku,
        orgId,
        enrichedItem.quantity,
        tx
      );
      if (warehouseId) {
        enrichedItem.warehouse_id = warehouseId;
        logger.debug(`Auto-assigned warehouse ${warehouseId} for SKU ${enrichedItem.sku}`);
      } else {
        throw new BusinessLogicError(
          `Insufficient inventory for SKU "${enrichedItem.sku}". Required quantity: ${enrichedItem.quantity}. Add stock via the inventory API before placing orders for this product.`
        );
      }
    } else if (!enrichedItem.warehouse_id) {
      throw new BusinessLogicError(
        `No warehouse assigned for SKU "${enrichedItem.sku || 'unknown'}" and no organization context to look up inventory. Ensure the order includes organization_id and the product has inventory assigned.`
      );
    }

    enrichedItems.push(enrichedItem);
  });

  return enrichedItems;
}

/**
 * Compute server-authoritative order totals from line items and request charges.
 * @param {Array} enrichedItems
 * @param {Object} orderData
 * @returns {{subtotal: number, tax_amount: number, shipping_amount: number, discount_amount: number, total_amount: number}}
 */
function calculateServerOrderTotals(enrichedItems, orderData) {
  const subtotal = enrichedItems.reduce((sum, item) => {
    const lineTotal = (item.unit_price * item.quantity) - (item.discount || 0);
    return sum + lineTotal;
  }, 0);
  const taxAmount = enrichedItems.reduce((sum, item) => sum + (item.tax || 0), 0);
  const shippingAmount = orderData.shipping_amount || 0;
  const discountAmount = orderData.discount_amount || 0;
  const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount;

  return {
    subtotal,
    tax_amount: taxAmount,
    shipping_amount: shippingAmount,
    discount_amount: discountAmount,
    total_amount: totalAmount,
  };
}

/**
 * Reserve inventory for each enriched order item with warehouse assignment.
 * @param {Array} enrichedItems
 * @param {object} tx
 * @returns {Promise<void>}
 */
async function reserveInventoryForItems(enrichedItems, tx) {
  await runSerial(enrichedItems, async (item) => {
    if (!item.warehouse_id || !item.sku) return;

    const reserved = await InventoryRepository.reserveStock(
      item.sku,
      item.warehouse_id,
      item.quantity,
      tx
    );

    if (!reserved) {
      throw new BusinessLogicError(
        `Insufficient stock for SKU "${item.sku}". Required: ${item.quantity}. Check available inventory and try again.`
      );
    }
  });
}

/**
 * Build base order payload before item enrichment and total calculation.
 * Totals are computed server-side afterward.
 */
function buildOrderRecord(orderData, generatedOrderNumber) {
  return {
    order_number: generatedOrderNumber,
    external_order_id: orderData.external_order_id || null,
    platform: orderData.platform || 'api',
    customer_name: orderData.customer_name,
    customer_email: orderData.customer_email,
    customer_phone: orderData.customer_phone || null,
    status: 'created',
    priority: orderData.priority || 'standard',
    order_type: orderData.order_type || 'regular',
    organization_id: orderData.organization_id || null,
    is_cod: orderData.is_cod || false,
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
    tags: orderData.tags ? JSON.stringify(orderData.tags) : null,
  };
}

// Order Service - contains business logic and orchestrates order operations
class OrderService {
  /**
   * Fetch paginated orders and aggregate status counters.
   * @param {Object} params
   * @returns {Promise<{orders: Array, stats: Object, pagination: Object}>}
   */
  async getOrders({ page = 1, limit = 20, status, search, sortBy = 'created_at', sortOrder = 'DESC', organizationId = undefined }) {
    const [{ orders, totalCount }, statsRow] = await Promise.all([
      OrderRepository.findOrders({
        page,
        limit,
        status,
        search,
        sortBy,
        sortOrder,
        organizationId
      }),
      OrderRepository.getOrderStatusStats(organizationId),
    ]);

    return {
      orders,
      stats: {
        totalOrders: parseInt(statsRow.total_orders || 0, 10),
        processing: parseInt(statsRow.processing || 0, 10),
        shipped: parseInt(statsRow.shipped || 0, 10),
        delivered: parseInt(statsRow.delivered || 0, 10),
        returned: parseInt(statsRow.returned || 0, 10),
      },
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  }

  /**
   * Fetch a single order with item details.
   * @param {string} id
   * @param {string|undefined} organizationId
   * @returns {Promise<Object>}
   */
  async getOrderById(id, organizationId = undefined) {
    const order = await OrderRepository.findOrderWithItems(id, organizationId);
    assertExists(order, 'Order');
    return order;
  }

  /**
   * Create pending carrier assignments for a newly created order.
   * @param {Object} order
   * @param {Array} eligibleCarriers
   * @param {Object} baseContext
   * @param {Object} tx
   * @returns {Promise<{assignments: Array, carriersToNotify: Array}>}
   */
  async createCarrierAssignmentsForOrder(order, eligibleCarriers, baseContext, tx) {
    const results = await Promise.all(
      eligibleCarriers.map(async (carrier) => {
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);

        const requestPayload = {
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: order.customer_name,
          customerEmail: order.customer_email,
          customerPhone: order.customer_phone,
          serviceType: baseContext.serviceType,
          totalAmount: parseFloat(order.total_amount),
          shippingAddress: baseContext.deliveryAddress,
          pickupAddress: baseContext.pickupAddress,
          deliveryAddress: baseContext.deliveryAddress,
          items: baseContext.orderItems || [],
          requestedAt: new Date(),
        };

        const idempotencyKey = `${order.id}-carrier-${carrier.id}-${Date.now()}`;
        const assignment = await CarrierRepository.createCarrierAssignment(
          {
            orderId: order.id,
            carrierId: carrier.id,
            organizationId: baseContext.organizationId || null,
            serviceType: baseContext.serviceType,
            status: 'pending',
            pickupAddress: baseContext.pickupAddress,
            deliveryAddress: baseContext.deliveryAddress,
            estimatedPickup: new Date(Date.now() + 2 * 60 * 60 * 1000),
            estimatedDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000),
            requestPayload,
            expiresAt,
            idempotencyKey,
          },
          tx
        );

        logger.info('Created carrier assignment in transaction', {
          assignmentId: assignment.id,
          carrierId: carrier.id,
          orderId: order.id,
          idempotencyKey,
        });

        return { assignment, carrier, requestPayload };
      })
    );

    return {
      assignments: results.map((entry) => entry.assignment),
      carriersToNotify: results,
    };
  }

  /**
   * Prepare carrier assignments for a newly created order when assignment is requested.
   * Returns empty arrays when no eligible carrier is available.
   */
  async maybePrepareCarrierAssignments(order, enrichedItems, orderData, orgId, tx) {
    const serviceType = order.priority || 'standard';
    const primaryWarehouseId = enrichedItems.find((i) => i.warehouse_id)?.warehouse_id || null;
    const pickupWarehouse = primaryWarehouseId
      ? await WarehouseRepository.findByIdWithDetails(primaryWarehouseId, orgId, tx)
      : null;

    const deliveryAddress = typeof order.shipping_address === 'string'
      ? JSON.parse(order.shipping_address)
      : order.shipping_address;

    const pickupAddress = buildAddressWithCoordinates(
      pickupWarehouse?.address,
      pickupWarehouse?.coordinates,
      deliveryAddress
    );

    const eligibleCarriers = await CarrierRepository.findEligibleCarriers(serviceType, 3, tx);
    if (eligibleCarriers.length === 0) {
      logger.warn('No available carriers for new order. Order will remain in pending_carrier_assignment.', {
        orderId: order.id,
        serviceType,
      });
      return { assignments: [], carriersToNotify: [] };
    }

    const assignmentResult = await this.createCarrierAssignmentsForOrder(
      order,
      eligibleCarriers,
      {
        serviceType,
        deliveryAddress,
        pickupAddress,
        orderItems: orderData.items || [],
        organizationId: orgId || null,
      },
      tx
    );

    await OrderRepository.updateStatus(order.id, 'pending_carrier_assignment', tx);
    return assignmentResult;
  }

  /**
   * Create an order, reserve inventory, and optionally open carrier bidding.
   * @param {Object} orderData
   * @param {boolean} requestCarrierAssignment
   * @returns {Promise<Object>}
   */
  async createOrder(orderData, requestCarrierAssignment = true) {
    const startTime = Date.now();
    
    // Validate order has items
    if (!orderData.items || orderData.items.length === 0) {
      throw new BusinessLogicError('Order must have at least one item');
    }

    try {
      const result = await withTransaction(async (tx) => {
        let generatedOrderNumber = orderData.order_number;
        if (!generatedOrderNumber) {
          const now = new Date();
          const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
          const seqPart = await OrderRepository.nextOrderNumberSeq(tx);
          generatedOrderNumber = `ORD-${datePart}-${seqPart}`;
        }
        const orderRecord = buildOrderRecord(orderData, generatedOrderNumber);

        const orgId = orderData.organization_id;
        const enrichedItems = await resolveAndEnrichOrderItems(orderData.items, orgId, tx);
        Object.assign(orderRecord, calculateServerOrderTotals(enrichedItems, orderData));

        // Create order with items in transaction
        const order = await OrderRepository.createOrderWithItems(orderRecord, enrichedItems, tx);

        await reserveInventoryForItems(enrichedItems, tx);

        let assignments = [];
        let carriersToNotify = [];
        if (requestCarrierAssignment) {
          ({ assignments, carriersToNotify } = await this.maybePrepareCarrierAssignments(
            order,
            enrichedItems,
            orderData,
            orgId,
            tx
          ));
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

  /**
   * Update order status with transition validation and inventory side effects.
   * @param {string} id
   * @param {string} status
   * @param {string|undefined} organizationId
   * @returns {Promise<Object>}
   */
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
        await runSerial(items, async (item) => {
          if (!item.warehouse_id || !item.sku) return;
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
        });
        // Recompute utilization for every warehouse that lost stock
        await Promise.all(
          [...affectedWarehouses].map((wid) =>
            WarehouseRepository.refreshUtilization(wid, tx).catch((e) => {
              logger.warn('refreshUtilization failed (non-fatal)', { warehouseId: wid, error: e.message });
            })
          )
        );
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
    await runSerial(items, async (item) => {
      if (!item.warehouse_id || !item.sku) return;
      const result = await InventoryRepository.deductStock(item.sku, item.warehouse_id, item.quantity, tx);
      if (!result) {
        logger.warn('deductStock returned null — possible double-deduction or insufficient qty', {
          orderId, sku: item.sku, warehouseId: item.warehouse_id, qty: item.quantity,
        });
      }
      affectedWarehouses.add(item.warehouse_id);
    });
    await Promise.all(
      [...affectedWarehouses].map((wid) =>
        WarehouseRepository.refreshUtilization(wid, tx).catch((e) => {
          logger.warn('refreshUtilization failed (non-fatal)', { warehouseId: wid, error: e.message });
        })
      )
    );
  }

  /**
   * Update mutable order fields.
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateOrder(id, updates) {
    // Prepare update data
    const updateData = {};
    const allowedFields = [
      'customer_name', 'customer_email', 'customer_phone',
      'status', 'priority', 'total_amount', 
      'estimated_delivery', 'actual_delivery', 'notes'
    ];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });

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
   * Load and validate source/destination warehouses for transfer orders.
   */
  async loadTransferWarehouses(transferData, tx) {
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

    if (!fromWarehouse.is_active) {
      throw new BusinessLogicError('Source warehouse is not active');
    }
    if (!toWarehouse.is_active) {
      throw new BusinessLogicError('Destination warehouse is not active');
    }

    return {
      fromWarehouse,
      toWarehouse,
      fromWarehouseName: fromWarehouse.name || fromWarehouse.warehouse_name || 'Source Warehouse',
      toWarehouseName: toWarehouse.name || toWarehouse.warehouse_name || 'Destination Warehouse',
      fromWarehouseCode: fromWarehouse.code || fromWarehouse.warehouse_code || null,
      toWarehouseCode: toWarehouse.code || toWarehouse.warehouse_code || null,
    };
  }

  /**
   * Resolve transfer items to catalog products and verify source availability.
   */
  async resolveTransferItems(items, fromWarehouseId, organizationId, tx) {
    const resolvedItems = [];

    await runSerial(items, async (item) => {
      let product = null;
      if (item.product_id) {
        product = await ProductRepository.findById(item.product_id, organizationId, tx);
      }
      if (!product && item.sku) {
        product = await ProductRepository.findBySku(item.sku, organizationId, tx);
      }

      if (!product) {
        throw new NotFoundError(`Product not found for transfer item SKU '${item.sku || 'unknown'}'`);
      }

      const inventory = await InventoryRepository.findBySKUAndWarehouse(
        product.sku,
        fromWarehouseId,
        tx
      );

      if (!inventory) {
        throw new NotFoundError(`SKU ${product.sku} not found in source warehouse`);
      }

      if (inventory.quantity_available < item.quantity) {
        throw new BusinessLogicError(
          `Insufficient stock for SKU ${product.sku}. Available: ${inventory.quantity_available}, Requested: ${item.quantity}`
        );
      }

      resolvedItems.push({
        ...item,
        product_id: product.id,
        sku: product.sku,
        product_name: item.product_name || product.name,
      });
    });

    return resolvedItems;
  }

  /**
   * Build canonical transfer-order payload for repository persistence.
   */
  buildTransferOrderPayload(transferData, warehouseContext, resolvedItems, trnSeq) {
    const priority = transferData.priority || 'standard';
    const totalAmount = resolvedItems.reduce(
      (sum, item) => sum + (item.unit_cost || 0) * item.quantity,
      0
    );

    return {
      totalAmount,
      orderData: {
        order_number: `TRF-${trnSeq}`,
        order_type: 'transfer',
        customer_name: `Transfer: ${warehouseContext.fromWarehouseName} → ${warehouseContext.toWarehouseName}`,
        customer_email: warehouseContext.toWarehouse.contact_email || 'transfers@system.local',
        customer_phone: warehouseContext.toWarehouse.contact_phone || null,
        status: 'created',
        priority,
        total_amount: totalAmount,
        currency: 'INR',
        shipping_address: warehouseContext.toWarehouse.address,
        billing_address: warehouseContext.fromWarehouse.address,
        estimated_delivery: transferData.expected_delivery_date || null,
        notes: `TRANSFER ORDER\nReason: ${transferData.reason}\nRequested by: ${transferData.requested_by || 'System'}\nNotes: ${transferData.notes || 'N/A'}`,
        special_instructions: 'INTERNAL TRANSFER - Handle with care',
        tags: JSON.stringify(['transfer', 'internal', priority]),
        items: resolvedItems.map((item) => ({
          product_id: item.product_id,
          sku: item.sku,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_cost || 0,
          total_price: (item.unit_cost || 0) * item.quantity,
          warehouse_id: transferData.from_warehouse_id,
          item_type: 'general',
          package_type: 'box',
        })),
      },
    };
  }

  /**
   * Reserve source inventory for all transfer items.
   */
  async reserveTransferInventory(resolvedItems, fromWarehouseId, tx) {
    await runSerial(resolvedItems, async (item) => {
      const reserved = await InventoryRepository.reserveStock(
        item.sku,
        fromWarehouseId,
        item.quantity,
        tx
      );

      if (!reserved) {
        throw new BusinessLogicError(`Failed to reserve inventory for SKU: ${item.sku}`);
      }
    });
  }

  /**
   * Determine default delivery date based on transfer priority.
   */
  computeTransferDeliveryDate(priority) {
    const deliveryDate = new Date();
    if (priority === 'express') {
      deliveryDate.setDate(deliveryDate.getDate() + 1);
    } else if (priority === 'bulk') {
      deliveryDate.setDate(deliveryDate.getDate() + 5);
    } else {
      deliveryDate.setDate(deliveryDate.getDate() + 3);
    }
    return deliveryDate;
  }

  /**
   * Create shipment record for an internal transfer order.
   */
  async createTransferShipment(order, transferData, warehouseContext, tx) {
    const priority = transferData.priority || 'standard';
    const pickupDate = new Date();
    pickupDate.setHours(pickupDate.getHours() + 2);
    const fallbackDeliveryDate = this.computeTransferDeliveryDate(priority);

    const shipment = await ShipmentRepository.createTransferShipment(
      {
        orderId: order.id,
        warehouseId: transferData.from_warehouse_id,
        originAddress: buildAddressWithCoordinates(
          warehouseContext.fromWarehouse.address,
          warehouseContext.fromWarehouse.coordinates
        ),
        destinationAddress: buildAddressWithCoordinates(
          warehouseContext.toWarehouse.address,
          warehouseContext.toWarehouse.coordinates
        ),
        estimatedPickup: pickupDate,
        estimatedDelivery: transferData.expected_delivery_date || fallbackDeliveryDate,
        notes: `Transfer from ${warehouseContext.fromWarehouseName} to ${warehouseContext.toWarehouseName}`,
      },
      tx
    );

    return {
      shipment,
      pickupDate,
      deliveryDate: transferData.expected_delivery_date || fallbackDeliveryDate,
      priority,
    };
  }

  /**
   * Optionally create pending carrier assignment for transfer visibility in carrier portal.
   */
  async createTransferCarrierAssignment(order, shipment, transferData, warehouseContext, resolvedItems, organizationId, pickupDate, deliveryDate, priority, tx) {
    let targetCarrier = await CarrierRepository.findByCode('INTERNAL', organizationId, tx);
    if (!targetCarrier) {
      const fallbackCarriers = await CarrierRepository.findEligibleCarriers(priority, 1, tx);
      targetCarrier = fallbackCarriers[0] || null;
    }

    if (!targetCarrier) {
      return null;
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const requestPayload = {
      orderId: order.id,
      orderNumber: order.order_number,
      orderType: 'transfer',
      serviceType: priority,
      customerName: order.customer_name,
      totalAmount: parseFloat(order.total_amount),
      transfer: {
        fromWarehouseId: warehouseContext.fromWarehouse.id,
        fromWarehouseCode: warehouseContext.fromWarehouseCode,
        fromWarehouseName: warehouseContext.fromWarehouseName,
        toWarehouseId: warehouseContext.toWarehouse.id,
        toWarehouseCode: warehouseContext.toWarehouseCode,
        toWarehouseName: warehouseContext.toWarehouseName,
      },
      shipment: {
        id: shipment.id,
        trackingNumber: shipment.tracking_number,
        estimatedDelivery: shipment.estimated_delivery_date,
      },
      items: resolvedItems || [],
      requestedAt: new Date(),
    };

    return CarrierRepository.createCarrierAssignment(
      {
        orderId: order.id,
        carrierId: targetCarrier.id,
        organizationId: organizationId || null,
        serviceType: priority,
        status: 'pending',
        pickupAddress: buildAddressWithCoordinates(
          warehouseContext.fromWarehouse.address,
          warehouseContext.fromWarehouse.coordinates
        ),
        deliveryAddress: buildAddressWithCoordinates(
          warehouseContext.toWarehouse.address,
          warehouseContext.toWarehouse.coordinates
        ),
        estimatedPickup: pickupDate,
        estimatedDelivery: deliveryDate,
        requestPayload,
        expiresAt,
        idempotencyKey: `${order.id}-carrier-${targetCarrier.id}-transfer-${Date.now()}`,
      },
      tx
    );
  }

  /**
   * Build transfer-order response shape and emit audit log.
   */
  buildTransferResult(order, shipment, transferAssignment, warehouseContext, resolvedItems, totalAmount) {
    logger.info('Transfer order created', {
      orderId: order.id,
      orderNumber: order.order_number,
      shipmentId: shipment.id,
      assignmentId: transferAssignment?.id || null,
      fromWarehouse: warehouseContext.fromWarehouseName,
      toWarehouse: warehouseContext.toWarehouseName,
      itemCount: resolvedItems.length,
      totalAmount,
    });

    return {
      order,
      shipment,
      assignment: transferAssignment,
      fromWarehouse: {
        id: warehouseContext.fromWarehouse.id,
        name: warehouseContext.fromWarehouseName,
        code: warehouseContext.fromWarehouseCode,
      },
      toWarehouse: {
        id: warehouseContext.toWarehouse.id,
        name: warehouseContext.toWarehouseName,
        code: warehouseContext.toWarehouseCode,
      },
    };
  }

  /**
   * Execute transfer-order creation inside an active transaction.
   */
  async createTransferOrderInTransaction(transferData, organizationId, tx) {
    const warehouseContext = await this.loadTransferWarehouses(transferData, tx);
    const resolvedItems = await this.resolveTransferItems(
      transferData.items,
      transferData.from_warehouse_id,
      organizationId,
      tx
    );
    const trnSeq = await OrderRepository.nextTransferOrderSeq(tx);
    const { orderData, totalAmount } = this.buildTransferOrderPayload(
      transferData,
      warehouseContext,
      resolvedItems,
      trnSeq
    );

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
        tags: orderData.tags,
      },
      orderData.items,
      tx
    );

    await this.reserveTransferInventory(resolvedItems, transferData.from_warehouse_id, tx);

    const { shipment, pickupDate, deliveryDate, priority } = await this.createTransferShipment(
      order,
      transferData,
      warehouseContext,
      tx
    );

    const transferAssignment = await this.createTransferCarrierAssignment(
      order,
      shipment,
      transferData,
      warehouseContext,
      resolvedItems,
      organizationId,
      pickupDate,
      deliveryDate,
      priority,
      tx
    );

    return this.buildTransferResult(
      order,
      shipment,
      transferAssignment,
      warehouseContext,
      resolvedItems,
      totalAmount
    );
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
      const result = await withTransaction((tx) =>
        this.createTransferOrderInTransaction(transferData, organizationId, tx)
      );

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
   * Cancel an order and either release reserved stock or create reverse shipment.
   * @param {string} id
   * @param {string|undefined} organizationId
   * @returns {Promise<Object>}
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
        await runSerial(items, async (item) => {
          if (!item.warehouse_id || !item.sku) return;
          await InventoryRepository.releaseStock(item.sku, item.warehouse_id, item.quantity, tx);
        });
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

  /**
   * Initiate a return record for delivered orders.
   * @param {string} orderId
   * @param {Object} payload
   * @param {string|undefined} organizationId
   * @returns {Promise<Object>}
   */
  async initiateReturnForDeliveredOrder(orderId, payload = {}, organizationId = undefined) {
    return withTransaction(async (tx) => {
      const order = await OrderRepository.findOrderWithItems(orderId, organizationId, tx);
      assertExists(order, 'Order');

      if (order.status !== 'delivered') {
        throw new BusinessLogicError('Only delivered orders can start a return flow from orders API');
      }

      const existingReturns = await ReturnRepository.findByOrderId(orderId, organizationId, tx);
      const openReturn = existingReturns.find((r) => OPEN_RETURN_STATUSES.includes(r.status));
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
