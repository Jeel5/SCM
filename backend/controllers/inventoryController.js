// Inventory Controller — thin HTTP layer. All business logic + SQL is in
// InventoryRepository and (for transaction ops) in the service layer.
import InventoryRepository from '../repositories/InventoryRepository.js';
import ProductRepository from '../repositories/ProductRepository.js';
import WarehouseRepository from '../repositories/WarehouseRepository.js';
import SupplierRepository from '../repositories/SupplierRepository.js';
import { emitToOrg } from '../sockets/emitter.js';
import { asyncHandler } from '../errors/errorHandler.js';
import { NotFoundError, BusinessLogicError } from '../errors/index.js';
import logger from '../utils/logger.js';
import { withTransaction } from '../utils/dbTransaction.js';
import { cacheWrap, orgSeg, hashParams, invalidatePatterns, invalidationTargets } from '../utils/cache.js';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise an inventory row from the DB into a consistent frontend shape.
 * This is the single source of truth for how inventory data is presented.
 */
function formatInventoryItem(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    warehouseId: row.warehouse_id,
    warehouseName: row.warehouse_name || null,
    warehouseCode: row.warehouse_code || null,
    productId: row.product_id || null,
    productName: row.product_display_name || row.product_name || null,
    sku: row.sku || null,
    productCategory: row.product_category || null,
    unitCost: row.unit_cost != null
      ? parseFloat(row.unit_cost)
      : (row.product_cost_price != null ? parseFloat(row.product_cost_price) : null),
    // Quantities (all integers)
    quantity: parseInt(row.quantity, 10) || 0,
    availableQuantity: parseInt(row.available_quantity, 10) || 0,
    reservedQuantity: parseInt(row.reserved_quantity, 10) || 0,
    damagedQuantity: parseInt(row.damaged_quantity, 10) || 0,
    inTransitQuantity: parseInt(row.in_transit_quantity, 10) || 0,
    // Thresholds
    reorderPoint: row.reorder_point !== null ? parseInt(row.reorder_point, 10) : null,
    maxStockLevel: row.max_stock_level !== null ? parseInt(row.max_stock_level, 10) : null,
    // Derived flags
    isLowStock: row.reorder_point !== null
      ? row.available_quantity <= row.reorder_point
      : false,
    isOutOfStock: row.available_quantity === 0,
    // Timestamps
    lastStockCheck: row.last_stock_check || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function notifySupplierRestockRequest(supplier, restockOrder, item, quantity, reason) {
  if (!supplier?.api_endpoint) return;

  try {
    await fetch(supplier.api_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'restock.requested',
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        restock_order_id: restockOrder.id,
        restock_number: restockOrder.restock_number,
        destination_warehouse_id: restockOrder.destination_warehouse_id,
        sku: item.sku,
        product_name: item.product_name,
        quantity,
        reason,
        tracking_number: restockOrder.tracking_number || null,
      }),
    });
  } catch (error) {
    logger.warn('Failed to notify supplier restock endpoint', {
      supplierId: supplier.id,
      endpoint: supplier.api_endpoint,
      error: error.message,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WAREHOUSE UTILIZATION SYNC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recompute and persist current_utilization for a warehouse.
 * Called after any inventory mutation (create / adjust / transfer).
 * @param {string} warehouseId
 * @param {object} [client] - optional transaction client
 */
async function refreshWarehouseUtilization(warehouseId, client = null) {
  if (!warehouseId) return;
  try {
    await WarehouseRepository.refreshUtilization(warehouseId, client);
  } catch (err) {
    // Non-fatal — log but don't break the request
    logger.warn('Failed to refresh warehouse utilization', { warehouseId, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /inventory
 * List inventory with optional filters. Org-scoped.
 */
export const getInventory = asyncHandler(async (req, res) => {
  const queryParams = req.validatedQuery || req.query;
  const { page, limit, warehouse_id, search, low_stock, stock_state } = queryParams;
  const organizationId = req.orgContext?.organizationId;

  const pageNum  = parseInt(page, 10)  || 1;
  const limitNum = Math.min(parseInt(limit, 10) || 20, 100);

  // Cache filtered paginated list for 30 seconds
  const cacheKey = `inv:list:${orgSeg(organizationId)}:${hashParams({ page: pageNum, limit: limitNum, warehouse_id, search, low_stock, stock_state })}`;
  const cached = await cacheWrap(cacheKey, 30, async () => {
    const { items, totalCount } = await InventoryRepository.findInventory({
      page: pageNum, limit: limitNum, warehouse_id, search, low_stock, stock_state, organizationId
    });
    return { data: items.map(formatInventoryItem), totalCount };
  });

  res.json({
    success: true,
    data: cached.data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: cached.totalCount,
      totalPages: Math.ceil(cached.totalCount / limitNum)
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE ITEM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /inventory/:id
 * Get a single inventory item with full product + warehouse details.
 */
export const getInventoryItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;

  const item = await InventoryRepository.findByIdWithDetails(id, organizationId);
  if (!item) throw new NotFoundError('Inventory item');

  res.json({ success: true, data: formatInventoryItem(item) });
});

// ─────────────────────────────────────────────────────────────────────────────
// STATS & LOW STOCK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /inventory/stats
 * Aggregate inventory statistics for a warehouse or whole org.
 */
export const getInventoryStats = asyncHandler(async (req, res) => {
  const { warehouse_id } = req.query;
  const organizationId = req.orgContext?.organizationId;

  const cacheKey = `inv:stats:${orgSeg(organizationId)}:${warehouse_id || '_all_'}`;
  const data = await cacheWrap(cacheKey, 30, async () => {
    const stats = await InventoryRepository.getInventoryStats(warehouse_id, organizationId);
    return {
      totalItems: stats.total_items,
      totalQuantity: stats.total_quantity,
      totalAvailable: stats.total_available,
      totalReserved: stats.total_reserved,
      totalDamaged: stats.total_damaged,
      lowStockItems: stats.low_stock_items,
      outOfStockItems: stats.out_of_stock_items,
      totalInventoryValue: parseFloat(stats.total_inventory_value) || 0
    };
  });

  res.json({ success: true, data });
});

/**
 * GET /inventory/low-stock
 * Return all items at or below their reorder_point.
 */
export const getLowStockItems = asyncHandler(async (req, res) => {
  const { warehouse_id } = req.query;
  const organizationId = req.orgContext?.organizationId;

  const cacheKey = `inv:lowstock:${orgSeg(organizationId)}:${warehouse_id || '_all_'}`;
  const items = await cacheWrap(cacheKey, 30, async () => {
    const rows = await InventoryRepository.findLowStock(warehouse_id, organizationId);
    return rows.map(formatInventoryItem);
  });

  res.json({ success: true, data: items, count: items.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /inventory
 * Create a new inventory record for an existing product in a warehouse.
 * The product MUST already exist in the catalog — inline product creation
 * is intentionally not supported here (products require their own full form).
 * Org-scoped.
 */
export const createInventoryItem = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  const orgId = organizationId || req.body.organization_id || null;
  const { product_id, ...inventoryFields } = req.body;

  // ── Verify the product exists and pull canonical sku + name ──
  const product = await ProductRepository.findById(product_id);
  if (!product) throw new NotFoundError('Product');

  inventoryFields.sku = product.sku;
  inventoryFields.product_name = product.name;
  if (inventoryFields.unit_cost === undefined || inventoryFields.unit_cost === null) {
    inventoryFields.unit_cost = product.cost_price ?? product.selling_price ?? null;
  }

  const data = {
    ...inventoryFields,
    product_id,
    organization_id: orgId,
  };

  const item = await InventoryRepository.createInventoryItem(data);

  // Keep warehouse utilization in sync
  await refreshWarehouseUtilization(item.warehouse_id);

  logger.info('Inventory item created', {
    inventoryId: item.id,
    warehouseId: item.warehouse_id,
    sku: item.sku,
    quantity: item.quantity,
    userId: req.user?.userId
  });
  await invalidatePatterns(invalidationTargets(orgId, 'inv:list', 'inv:stats', 'inv:lowstock', 'dash', 'analytics'));
  emitToOrg(orgId, 'inventory:updated', formatInventoryItem(item));

  res.status(201).json({ success: true, data: formatInventoryItem(item) });
});

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /inventory/:id
 * Update non-quantity fields (reorder_point, max_stock_level, unit_cost).
 * For quantity changes use the /adjust endpoint.
 */
export const updateInventoryItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;

  // Ensure item exists (and belongs to org)
  const existing = await InventoryRepository.findByIdWithDetails(id, organizationId);
  if (!existing) throw new NotFoundError('Inventory item');

  const updated = await InventoryRepository.updateInventoryItem(id, req.body);

  logger.info('Inventory item updated', {
    inventoryId: id,
    fields: Object.keys(req.body),
    userId: req.user?.userId
  });
  await invalidatePatterns(invalidationTargets(organizationId, 'inv:list', 'inv:stats', 'inv:lowstock'));

  res.json({ success: true, data: formatInventoryItem(updated) });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADJUST STOCK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /inventory/:id/adjust
 * Adjust stock on a specific inventory item.
 *
 * adjustment_type:
 *   add      → inbound stock (new stock arrived)
 *   remove   → outbound / write-off
 *   set      → cycle count (absolute value)
 *   damaged  → mark as damaged (reduces available)
 */
export const adjustStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { adjustment_type, quantity, reason, reference_id, batch_number, supplier_id, expected_arrival } = req.body;
  const organizationId = req.orgContext?.organizationId;
  const userId = req.user?.userId;

  // Fetch current item (validates ownership)
  const item = await InventoryRepository.findByIdWithDetails(id, organizationId);
  if (!item) throw new NotFoundError('Inventory item');

  // TASK-R9-025: return data from transaction callback; send res.json AFTER commit
  const txResult = await withTransaction(async (tx) => {
    let updated;
    let movementType;

    switch (adjustment_type) {
      case 'add':
        if (!supplier_id) {
          throw new BusinessLogicError('Supplier is required to create a restock request');
        }

        const supplier = await SupplierRepository.findByIdScoped(supplier_id, organizationId, tx);
        if (!supplier) {
          throw new NotFoundError('Supplier');
        }

        const totalAmount = Number(item.unit_cost || 0) * Number(quantity);
        const restockOrderRes = await InventoryRepository.query(
          `INSERT INTO restock_orders
             (organization_id, supplier_id, destination_warehouse_id, status, is_auto_generated,
              trigger_reason, total_items, total_amount, currency, requested_at, expected_arrival,
              notes, created_by)
           VALUES ($1, $2, $3, 'submitted', false, $4, $5, $6, 'INR', NOW(), $7, $8, $9)
           RETURNING *`,
          [
            organizationId || item.organization_id,
            supplier.id,
            item.warehouse_id,
            reason,
            quantity,
            totalAmount,
            expected_arrival || null,
            reason,
            userId || null,
          ],
          tx
        );

        const restockOrder = restockOrderRes.rows[0];
        await InventoryRepository.query(
          `INSERT INTO restock_order_items
             (restock_order_id, product_id, sku, product_name, quantity_ordered, unit_cost, total_cost)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            restockOrder.id,
            item.product_id || null,
            item.sku,
            item.product_name,
            quantity,
            item.unit_cost || 0,
            totalAmount,
          ],
          tx
        );

        updated = item;
        movementType = 'inbound';
        return {
          message: 'Restock request created',
          data: formatInventoryItem(updated),
          restockOrder,
          supplier,
        };

      case 'remove':
        if (item.available_quantity < quantity) {
          throw new BusinessLogicError(
            `Cannot remove ${quantity} units — only ${item.available_quantity} available`
          );
        }
        updated = await InventoryRepository.addStock(item.sku, item.warehouse_id, -quantity, tx);
        movementType = 'outbound';
        break;

      case 'set':
        updated = await InventoryRepository.setStock(id, quantity, reason, tx);
        movementType = 'adjustment';
        break;

      case 'damaged':
        if (item.available_quantity < quantity) {
          throw new BusinessLogicError(
            `Cannot mark ${quantity} units as damaged — only ${item.available_quantity} available`
          );
        }
        updated = await InventoryRepository.markDamaged(id, quantity, tx);
        movementType = 'damaged';
        break;

      default:
        throw new BusinessLogicError(`Unknown adjustment_type: ${adjustment_type}`);
    }

    if (!updated) {
      throw new BusinessLogicError('Stock adjustment failed — item may not exist or had insufficient stock');
    }

    // Record audit trail in stock_movements
    await InventoryRepository.recordMovement({
      organization_id: item.organization_id,
      warehouse_id: item.warehouse_id,
      product_id: item.product_id,
      inventory_id: id,
      movement_type: movementType,
      quantity: quantity,
      reference_type: reference_id ? 'adjustment' : null,
      reference_id: reference_id || null,
      notes: reason,
      batch_number: batch_number || null,
      created_by: userId,
      performed_by: req.user?.email || null
    }, tx);

    logger.info('Stock adjusted', {
      inventoryId: id,
      adjustmentType: adjustment_type,
      quantity,
      warehouseId: item.warehouse_id,
      sku: item.sku,
      userId
    });

    // Keep warehouse utilization in sync (runs inside transaction)
    await refreshWarehouseUtilization(item.warehouse_id, tx);

    // Return payload — do NOT call res.json here (transaction not yet committed)
    return { message: `Stock ${adjustment_type} successful`, data: formatInventoryItem(updated) };
  });

  // Transaction committed — now safe to send the HTTP response
  if (adjustment_type === 'add' && txResult.restockOrder && txResult.supplier) {
    await notifySupplierRestockRequest(txResult.supplier, txResult.restockOrder, item, quantity, reason);
  }
  emitToOrg(item.organization_id, 'inventory:updated', txResult.data);
  // Emit low_stock alert if updated item is at or below reorder point
  if (txResult.data?.quantity <= txResult.data?.reorderPoint) {
    emitToOrg(item.organization_id, 'inventory:low_stock', txResult.data);
  }
  await invalidatePatterns(invalidationTargets(item.organization_id, 'inv:list', 'inv:stats', 'inv:lowstock', 'dash', 'analytics'));
  res.json({ success: true, ...txResult });
});

// ─────────────────────────────────────────────────────────────────────────────
// STOCK MOVEMENTS HISTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /inventory/:id/movements
 * Get stock movement history for a specific inventory item.
 */
export const getStockMovements = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const organizationId = req.orgContext?.organizationId;

  // Validate item exists (org-scoped)
  const item = await InventoryRepository.findByIdWithDetails(id, organizationId);
  if (!item) throw new NotFoundError('Inventory item');

  const movements = await InventoryRepository.findMovements(id, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10)
  });

  res.json({ success: true, data: movements });
});

// ─────────────────────────────────────────────────────────────────────────────
// DIRECT TRANSFER (simple, no order created)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /inventory/transfer
 * Directly transfer stock between warehouses within an organisation.
 * For large/tracked transfers use POST /orders/transfer instead.
 */
export const transferInventory = asyncHandler(async (req, res) => {
  const { from_warehouse_id, to_warehouse_id, sku, product_id, quantity, reason } = req.body;
  const organizationId = req.orgContext?.organizationId;
  const userId = req.user?.userId;

  // TASK-R9-025: return data from transaction callback; send res.json AFTER commit
  const txResult = await withTransaction(async (tx) => {
    // Lock source inventory row to prevent concurrent transfers causing oversell
    const source = await InventoryRepository.lockBySku(sku, from_warehouse_id, tx);
    if (!source) throw new NotFoundError(`SKU ${sku} in source warehouse`);

    if (source.available_quantity < quantity) {
      throw new BusinessLogicError(
        `Insufficient stock — available: ${source.available_quantity}, requested: ${quantity}`
      );
    }

    // Deduct from source
    await InventoryRepository.addStock(sku, from_warehouse_id, -quantity, tx);

    // Add to destination (upsert)
    const destExisting = await InventoryRepository.findBySKUAndWarehouse(sku, to_warehouse_id, tx);
    if (destExisting) {
      await InventoryRepository.addStock(sku, to_warehouse_id, quantity, tx);
    } else {
      await InventoryRepository.createInventoryItem({
        organization_id: organizationId || source.organization_id,
        warehouse_id: to_warehouse_id,
        product_id: product_id || source.product_id,
        sku,
        product_name: source.product_name,
        quantity,
        available_quantity: quantity,
        reserved_quantity: 0,
        reorder_point: source.reorder_point,
        max_stock_level: source.max_stock_level
      }, tx);
    }

    // Record outbound movement
    await InventoryRepository.recordMovement({
      organization_id: organizationId || source.organization_id,
      warehouse_id: from_warehouse_id,
      product_id: product_id || source.product_id,
      inventory_id: source.id,
      movement_type: 'transfer_out',
      quantity,
      reference_type: 'transfer',
      notes: reason,
      created_by: userId,
      performed_by: req.user?.email || null
    }, tx);

    // Record inbound movement on destination
    const dest = await InventoryRepository.findBySKUAndWarehouse(sku, to_warehouse_id, tx);
    await InventoryRepository.recordMovement({
      organization_id: organizationId || source.organization_id,
      warehouse_id: to_warehouse_id,
      product_id: product_id || source.product_id,
      inventory_id: dest?.id || null,
      movement_type: 'transfer_in',
      quantity,
      reference_type: 'transfer',
      notes: reason,
      created_by: userId,
      performed_by: req.user?.email || null
    }, tx);

    logger.info('Inventory transfer completed', {
      sku, quantity, fromWarehouse: from_warehouse_id, toWarehouse: to_warehouse_id, userId
    });

    // Keep both warehouses' utilization in sync
    await refreshWarehouseUtilization(from_warehouse_id, tx);
    await refreshWarehouseUtilization(to_warehouse_id, tx);

    // Return payload — do NOT call res.json here (transaction not yet committed)
    return { message: `${quantity} units of ${sku} transferred successfully` };
  });

  // Transaction committed — now safe to send the HTTP response
  emitToOrg(organizationId, 'inventory:updated', null); // triggers refetch in frontend
  await invalidatePatterns(invalidationTargets(organizationId, 'inv:list', 'inv:stats', 'inv:lowstock', 'dash', 'analytics'));
  res.json({ success: true, ...txResult });
});
