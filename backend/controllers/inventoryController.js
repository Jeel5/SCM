// Inventory Controller — thin HTTP layer. All business logic + SQL is in
// InventoryRepository and (for transaction ops) in the service layer.
import InventoryRepository from '../repositories/InventoryRepository.js';
import { asyncHandler } from '../errors/errorHandler.js';
import { NotFoundError, BusinessLogicError } from '../errors/index.js';
import logger from '../utils/logger.js';
import { withTransaction } from '../utils/dbTransaction.js';
import pool from '../configs/db.js';

// ─────────────────────────────────────────────────────────────────────────────
// SKU GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a unique SKU scoped to the organization.
 * Format: {PREFIX}-{YYYYMM}-{RAND5}  e.g. USBCAB-202502-K3P9Q
 * Retries up to 5 times on collision.
 */
async function generateUniqueSKU(organizationId, productName) {
  const prefix = (productName || 'ITEM')
    .replace(/[^A-Z0-9\s]/gi, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.slice(0, 3).toUpperCase())
    .join('')
    .slice(0, 6) || 'ITEM';

  const month = new Date().toISOString().slice(0, 7).replace('-', '');

  for (let attempt = 0; attempt < 5; attempt++) {
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    const sku = `${prefix}-${month}-${rand}`;

    const { rows } = await pool.query(
      'SELECT 1 FROM inventory WHERE organization_id IS NOT DISTINCT FROM $1 AND sku = $2 LIMIT 1',
      [organizationId || null, sku]
    );

    if (rows.length === 0) return sku;
  }

  // Fallback: timestamp-based to guarantee uniqueness
  return `${prefix}-${Date.now()}`;
}

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
    unitPrice: row.unit_price ? parseFloat(row.unit_price) : null,
    // Quantities (all integers)
    quantity: parseInt(row.quantity) || 0,
    availableQuantity: parseInt(row.available_quantity) || 0,
    reservedQuantity: parseInt(row.reserved_quantity) || 0,
    damagedQuantity: parseInt(row.damaged_quantity) || 0,
    inTransitQuantity: parseInt(row.in_transit_quantity) || 0,
    // Location
    binLocation: row.bin_location || null,
    zone: row.zone || null,
    // Thresholds
    reorderPoint: row.reorder_point !== null ? parseInt(row.reorder_point) : null,
    maxStockLevel: row.max_stock_level !== null ? parseInt(row.max_stock_level) : null,
    // Derived flags
    isLowStock: row.reorder_point != null
      ? row.available_quantity <= row.reorder_point
      : false,
    isOutOfStock: row.available_quantity === 0,
    // Timestamps
    lastStockCheck: row.last_stock_check || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
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
  const { page, limit, warehouse_id, search, low_stock } = queryParams;
  const organizationId = req.orgContext?.organizationId;

  const { items, totalCount } = await InventoryRepository.findInventory({
    page,
    limit,
    warehouse_id,
    search,
    low_stock,
    organizationId
  });

  res.json({
    success: true,
    data: items.map(formatInventoryItem),
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit)
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

  const stats = await InventoryRepository.getInventoryStats(warehouse_id, organizationId);

  res.json({
    success: true,
    data: {
      totalItems: stats.total_items,
      totalQuantity: stats.total_quantity,
      totalAvailable: stats.total_available,
      totalReserved: stats.total_reserved,
      totalDamaged: stats.total_damaged,
      lowStockItems: stats.low_stock_items,
      outOfStockItems: stats.out_of_stock_items,
      totalInventoryValue: parseFloat(stats.total_inventory_value) || 0
    }
  });
});

/**
 * GET /inventory/low-stock
 * Return all items at or below their reorder_point.
 */
export const getLowStockItems = asyncHandler(async (req, res) => {
  const { warehouse_id } = req.query;
  const organizationId = req.orgContext?.organizationId;

  const items = await InventoryRepository.findLowStock(warehouse_id, organizationId);

  res.json({
    success: true,
    data: items.map(formatInventoryItem),
    count: items.length
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /inventory
 * Combined product + inventory creation.
 * If product fields (product_name, category, unit_price) are provided without a product_id,
 * a product record is created first, then inventory is linked to it.
 * Org-scoped.
 */
export const createInventoryItem = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  const orgId = organizationId || req.body.organization_id || null;
  const { product_id, product_name, category, unit_price, ...inventoryFields } = req.body;

  let resolvedProductId = product_id || null;

  // ── If product_id supplied, pull sku + name from products table ──
  if (resolvedProductId) {
    const { rows } = await pool.query(
      `SELECT sku, name FROM products WHERE id = $1 LIMIT 1`,
      [resolvedProductId]
    );
    if (rows.length > 0) {
      // Only set if not already provided by the caller
      if (!inventoryFields.sku) inventoryFields.sku = rows[0].sku;
      if (!inventoryFields.product_name) inventoryFields.product_name = rows[0].name;
    }
  }

  // ── If no product_id provided, create the product catalog entry first ──
  if (!resolvedProductId && product_name) {
    const sku = await generateUniqueSKU(orgId, product_name);

    const productResult = await pool.query(
      `INSERT INTO products (
         organization_id, sku, name, category,
         unit_price, currency, is_active
       ) VALUES ($1,$2,$3,$4,$5,'INR',true)
       ON CONFLICT (organization_id, sku) DO NOTHING
       RETURNING id`,
      [
        orgId,
        sku,
        product_name.trim(),
        category || null,
        unit_price || null
      ]
    );

    resolvedProductId = productResult.rows[0]?.id || null;

    // Denormalized copy on inventory row
    inventoryFields.sku = sku;
    inventoryFields.product_name = product_name.trim();
  }

  const data = {
    ...inventoryFields,
    product_id: resolvedProductId,
    organization_id: orgId,
  };

  // Fallback: auto-generate SKU for inventory row if still without one
  if (!data.sku && !resolvedProductId) {
    data.sku = await generateUniqueSKU(orgId, data.product_name);
  }

  const item = await InventoryRepository.createInventoryItem(data);

  logger.info('Inventory item created', {
    inventoryId: item.id,
    warehouseId: item.warehouse_id,
    sku: item.sku,
    quantity: item.quantity,
    userId: req.user?.userId
  });

  res.status(201).json({ success: true, data: formatInventoryItem(item) });
});

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /inventory/:id
 * Update non-quantity fields (bin_location, zone, reorder_point, max_stock_level).
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
  const { adjustment_type, quantity, reason, reference_id, batch_number } = req.body;
  const organizationId = req.orgContext?.organizationId;
  const userId = req.user?.userId;

  // Fetch current item (validates ownership)
  const item = await InventoryRepository.findByIdWithDetails(id, organizationId);
  if (!item) throw new NotFoundError('Inventory item');

  await withTransaction(async (tx) => {
    let updated;
    let movementType;

    switch (adjustment_type) {
      case 'add':
        updated = await InventoryRepository.addStock(item.sku, item.warehouse_id, quantity, tx);
        movementType = 'inbound';
        break;

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
      created_by: userId
    }, tx);

    logger.info('Stock adjusted', {
      inventoryId: id,
      adjustmentType: adjustment_type,
      quantity,
      warehouseId: item.warehouse_id,
      sku: item.sku,
      userId
    });

    res.json({
      success: true,
      message: `Stock ${adjustment_type} successful`,
      data: formatInventoryItem(updated)
    });
  });
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
    page: parseInt(page),
    limit: parseInt(limit)
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

  await withTransaction(async (tx) => {
    // Check source stock
    const source = await InventoryRepository.findBySKUAndWarehouse(sku, from_warehouse_id, tx);
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
      created_by: userId
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
      created_by: userId
    }, tx);

    logger.info('Inventory transfer completed', {
      sku, quantity, fromWarehouse: from_warehouse_id, toWarehouse: to_warehouse_id, userId
    });

    res.json({
      success: true,
      message: `${quantity} units of ${sku} transferred successfully`
    });
  });
});
