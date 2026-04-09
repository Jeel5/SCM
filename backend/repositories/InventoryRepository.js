// Inventory Repository - handles stock levels, reservations, and movements
// All SQL queries for the inventory and stock_movements tables live here.
import BaseRepository from './BaseRepository.js';
import { ValidationError } from '../errors/AppError.js';

class InventoryRepository extends BaseRepository {
  constructor() {
    super('inventory');
  }

  // ─────────────────────────────────────────────────────────────
  // LIST / FIND
  // ─────────────────────────────────────────────────────────────

  /**
   * Get inventory with pagination, filtering, and warehouse/org scoping.
   * Joins products + warehouses to enrich the response.
   */
  async findInventory({
    page = 1,
    limit = 20,
    warehouse_id = null,
    search = null,
    low_stock = false,
    stock_state = null,
    organizationId = undefined
  }, client = null) {
    const offset = (page - 1) * limit;
    const params = [];
    let paramCount = 1;

    let query = `
      SELECT
        i.id,
        i.organization_id,
        i.warehouse_id,
        i.product_id,
        i.sku,
        i.product_name,
        i.quantity,
        i.available_quantity,
        i.reserved_quantity,
        i.damaged_quantity,
        i.in_transit_quantity,
        i.reorder_point,
        i.max_stock_level,
        i.last_stock_check,
        i.created_at,
        i.updated_at,
        w.name       AS warehouse_name,
        w.code       AS warehouse_code,
        p.name       AS product_display_name,
        p.category   AS product_category,
        p.weight     AS product_weight,
        p.cost_price AS product_cost_price,
        i.unit_cost,
        COUNT(*) OVER() AS total_count
      FROM inventory i
      JOIN warehouses w ON i.warehouse_id = w.id
      LEFT JOIN products p ON i.product_id = p.id
      WHERE 1=1
    `;

    // Multi-tenancy filter
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId, 'i');
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${paramCount}`;
        paramCount += 1;
        params.push(...orgFilter.params);
      }
    }

    if (warehouse_id) {
      query += ` AND i.warehouse_id = $${paramCount}`;
      paramCount += 1;
      params.push(warehouse_id);
    }

    if (search) {
      query += ` AND (
        i.sku ILIKE $${paramCount} OR
        i.product_name ILIKE $${paramCount} OR
        p.name ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount += 1;
    }

    if (stock_state === 'low_stock' || low_stock) {
      query += ` AND i.reorder_point IS NOT NULL AND i.available_quantity > 0 AND i.available_quantity <= i.reorder_point`;
    }

    if (stock_state === 'out_of_stock') {
      query += ` AND i.available_quantity = 0`;
    }

    if (stock_state === 'overstocked') {
      query += ` AND i.max_stock_level IS NOT NULL AND i.quantity > i.max_stock_level`;
    }

    query += ` ORDER BY i.updated_at DESC`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    paramCount += 2;
    params.push(limit, offset);

    const result = await this.query(query, params, client);

    return {
      items: result.rows,
      totalCount: result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0
    };
  }

  /**
   * Find a single inventory record by ID (with product + warehouse join)
   */
  async findByIdWithDetails(id, organizationId = undefined, client = null) {
    const params = [id];
    let paramCount = 2;

    let query = `
      SELECT
        i.*,
        w.name       AS warehouse_name,
        w.code       AS warehouse_code,
        p.name       AS product_display_name,
        p.category   AS product_category,
        p.cost_price AS product_cost_price
      FROM inventory i
      JOIN warehouses w ON i.warehouse_id = w.id
      LEFT JOIN products p ON i.product_id = p.id
      WHERE i.id = $1
    `;

    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId, 'i');
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${paramCount}`;
        paramCount += 1;
        params.push(...orgFilter.params);
      }
    }

    const result = await this.query(query, params, client);
    return result.rows[0] || null;
  }

  /**
   * Find inventory by SKU and warehouse (exact match)
   */
  async findBySKUAndWarehouse(sku, warehouseId, client = null) {
    const query = `
      SELECT * FROM inventory
      WHERE sku = $1 AND warehouse_id = $2
    `;
    const result = await this.query(query, [sku, warehouseId], client);
    return result.rows[0] || null;
  }

  /**
   * Get all inventory for a product across all warehouses
   */
  async findByProductId(productId, organizationId = undefined, client = null) {
    let query = `SELECT * FROM inventory WHERE product_id = $1`;
    const params = [productId];
    let paramCount = 2;

    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId);
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${paramCount}`;
        paramCount += 1;
        params.push(...orgFilter.params);
      }
    }

    query += ` ORDER BY warehouse_id`;
    const result = await this.query(query, params, client);
    return result.rows;
  }

  /**
   * Get low stock items (available_quantity <= reorder_point)
   */
  async findLowStock(warehouseId = null, organizationId = undefined, client = null) {
    let query = `
      SELECT
        i.*,
        w.name AS warehouse_name,
        w.code AS warehouse_code
      FROM inventory i
      JOIN warehouses w ON i.warehouse_id = w.id
      WHERE i.available_quantity <= COALESCE(i.reorder_point, 0)
    `;
    const params = [];
    let paramCount = 1;

    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId, 'i');
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${paramCount}`;
        paramCount += 1;
        params.push(...orgFilter.params);
      }
    }

    if (warehouseId) {
      query += ` AND i.warehouse_id = $${paramCount}`;
      paramCount += 1;
      params.push(warehouseId);
    }

    query += ` ORDER BY i.available_quantity ASC`;
    const result = await this.query(query, params, client);
    return result.rows;
  }

  /**
   * Aggregate inventory statistics for dashboard / warehouse views
   */
  async getInventoryStats(warehouseId = null, organizationId = undefined, client = null) {
    let query = `
      SELECT
        COUNT(*)::int                                              AS total_items,
        COALESCE(SUM(i.quantity), 0)::int                         AS total_quantity,
        COALESCE(SUM(i.available_quantity), 0)::int               AS total_available,
        COALESCE(SUM(i.reserved_quantity), 0)::int                AS total_reserved,
        COALESCE(SUM(i.damaged_quantity), 0)::int                 AS total_damaged,
        COUNT(*) FILTER (WHERE i.reorder_point IS NOT NULL AND i.available_quantity > 0 AND i.available_quantity <= i.reorder_point)::int AS low_stock_items,
        COUNT(*) FILTER (WHERE i.available_quantity = 0)::int     AS out_of_stock_items,
        COUNT(*) FILTER (WHERE i.max_stock_level IS NOT NULL AND i.quantity > i.max_stock_level)::int AS overstocked_items,
        COALESCE(SUM(i.quantity * COALESCE(NULLIF(i.unit_cost, 0), p.cost_price, p.selling_price, 0)), 0)::numeric AS total_inventory_value
      FROM inventory i
      LEFT JOIN products p ON i.product_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId, 'i');
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${paramCount}`;
        paramCount += 1;
        params.push(...orgFilter.params);
      }
    }

    if (warehouseId) {
      query += ` AND i.warehouse_id = $${paramCount}`;
      paramCount += 1;
      params.push(warehouseId);
    }

    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  // ─────────────────────────────────────────────────────────────
  // CREATE / UPDATE
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a new inventory record.
   * Uses ON CONFLICT (upsert) to handle the unique constraint on (warehouse_id, sku).
   */
  async createInventoryItem(data, client = null) {
    const available = data.available_quantity !== undefined
      ? data.available_quantity
      : (data.quantity || 0) - (data.reserved_quantity || 0);

    const query = `
      INSERT INTO inventory (
        organization_id, warehouse_id, product_id, sku, product_name,
        quantity, available_quantity, reserved_quantity,
        reorder_point, max_stock_level,
        unit_cost, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      ON CONFLICT (warehouse_id, sku) WHERE sku IS NOT NULL
      DO UPDATE SET
        quantity           = inventory.quantity + EXCLUDED.quantity,
        available_quantity = inventory.available_quantity + EXCLUDED.available_quantity,
        reserved_quantity  = inventory.reserved_quantity + EXCLUDED.reserved_quantity,
        reorder_point      = COALESCE(EXCLUDED.reorder_point, inventory.reorder_point),
        max_stock_level    = COALESCE(EXCLUDED.max_stock_level, inventory.max_stock_level),
        unit_cost          = COALESCE(EXCLUDED.unit_cost, inventory.unit_cost),
        updated_at         = NOW()
      RETURNING *
    `;

    const params = [
      data.organization_id || null,
      data.warehouse_id,
      data.product_id || null,
      data.sku || null,
      data.product_name || null,
      data.quantity || 0,
      available,
      data.reserved_quantity || 0,
      data.reorder_point || null,
      data.max_stock_level || null,
      data.unit_cost ?? null
    ];

    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  /**
   * Update specific fields of an inventory item (dynamic SET clause)
   */
  async updateInventoryItem(id, updates, client = null) {
    const ALLOWED = [
      'quantity', 'available_quantity', 'reserved_quantity',
      'damaged_quantity', 'in_transit_quantity',
      'reorder_point', 'max_stock_level',
      'last_stock_check', 'unit_cost'
    ];

    const setClauses = [];
    const params = [];
    let paramCount = 1;

    ALLOWED.forEach((field) => {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${paramCount}`);
        paramCount += 1;
        params.push(updates[field]);
      }
    });

    if (setClauses.length === 0) throw new ValidationError('No valid fields to update');
    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    const query = `
      UPDATE inventory
      SET ${setClauses.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await this.query(query, params, client);
    return result.rows[0] || null;
  }

  // ─────────────────────────────────────────────────────────────
  // STOCK OPERATIONS (transactional — always pass client)
  // ─────────────────────────────────────────────────────────────

  /**
   * Reserve stock: moves quantity from available → reserved.
   * Returns the updated row, or null if insufficient stock.
   */
  async reserveStock(sku, warehouseId, quantity, client = null) {
    const query = `
      UPDATE inventory
      SET
        reserved_quantity  = reserved_quantity + $1,
        available_quantity = available_quantity - $1,
        updated_at         = NOW()
      WHERE sku = $2 AND warehouse_id = $3 AND available_quantity >= $1
      RETURNING *
    `;
    const result = await this.query(query, [quantity, sku, warehouseId], client);
    return result.rows[0] || null; // null = insufficient stock
  }

  /**
   * Release reserved stock back to available (e.g., order cancelled)
   */
  async releaseStock(sku, warehouseId, quantity, client = null) {
    const query = `
      UPDATE inventory
      SET
        reserved_quantity  = GREATEST(reserved_quantity - $1, 0),
        available_quantity = available_quantity + $1,
        updated_at         = NOW()
      WHERE sku = $2 AND warehouse_id = $3
      RETURNING *
    `;
    const result = await this.query(query, [quantity, sku, warehouseId], client);
    return result.rows[0] || null;
  }

  /**
   * Deduct reserved stock on dispatch (reserved → gone from total)
   */
  async deductStock(sku, warehouseId, quantity, client = null) {
    const query = `
      UPDATE inventory
      SET
        quantity          = quantity - $1,
        reserved_quantity = GREATEST(reserved_quantity - $1, 0),
        updated_at        = NOW()
      WHERE sku = $2 AND warehouse_id = $3
      RETURNING *
    `;
    const result = await this.query(query, [quantity, sku, warehouseId], client);
    return result.rows[0] || null;
  }

  /**
   * Add stock: increases total + available (restocking / inbound)
   */
  async addStock(sku, warehouseId, quantity, client = null) {
    const query = `
      UPDATE inventory
      SET
        quantity           = quantity + $1,
        available_quantity = available_quantity + $1,
        updated_at         = NOW()
      WHERE sku = $2 AND warehouse_id = $3
      RETURNING *
    `;
    const result = await this.query(query, [quantity, sku, warehouseId], client);
    return result.rows[0] || null;
  }

  /**
   * Set absolute stock level (manual correction / cycle count)
   */
  async setStock(id, newQuantity, reason = 'Manual adjustment', client = null) {
    const query = `
      UPDATE inventory
      SET
        quantity           = $1,
        available_quantity = GREATEST($1 - reserved_quantity, 0),
        last_stock_check   = NOW(),
        updated_at         = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await this.query(query, [newQuantity, id], client);
    return result.rows[0] || null;
  }

  /**
   * Mark quantity as damaged
   */
  async markDamaged(id, quantity, client = null) {
    const query = `
      UPDATE inventory
      SET
        quantity           = quantity - $1,
        available_quantity = GREATEST(available_quantity - $1, 0),
        damaged_quantity   = damaged_quantity + $1,
        updated_at         = NOW()
      WHERE id = $2 AND available_quantity >= $1
      RETURNING *
    `;
    const result = await this.query(query, [quantity, id], client);
    return result.rows[0] || null;
  }

  // ─────────────────────────────────────────────────────────────
  // STOCK MOVEMENTS
  // ─────────────────────────────────────────────────────────────

  /**
   * Record a stock movement entry (audit trail).
   * movement_type must match CHECK constraint:
   *   'inbound' | 'outbound' | 'transfer_in' | 'transfer_out'
   *   | 'adjustment' | 'return' | 'damaged' | 'expired'
   */
  async recordMovement(movementData, client = null) {
    const query = `
      INSERT INTO stock_movements (
        warehouse_id, product_id, inventory_id,
        movement_type, quantity,
        reference_type, reference_id,
        notes, batch_number, created_by, performed_by,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *
    `;

    const params = [
      movementData.warehouse_id,
      movementData.product_id     || null,
      movementData.inventory_id   || null,
      movementData.movement_type,
      movementData.quantity,
      movementData.reference_type || null,
      movementData.reference_id   || null,
      movementData.notes          || null,
      movementData.batch_number   || null,
      movementData.created_by     || null,
      movementData.performed_by   || null
    ];

    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  /**
   * Get stock movement history for a specific inventory item
   */
  async findMovements(inventoryId, { page = 1, limit = 50 } = {}, client = null) {
    const offset = (page - 1) * limit;
    const query = `
      SELECT
        sm.*,
        u.name AS created_by_name
      FROM stock_movements sm
      LEFT JOIN users u ON sm.created_by = u.id
      WHERE sm.inventory_id = $1
      ORDER BY sm.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await this.query(query, [inventoryId, limit, offset], client);
    return result.rows;
  }

  /**
   * Get warehouse-level stock movements (for warehouse ops view)
   */
  async findWarehouseMovements(warehouseId, { page = 1, limit = 50, movement_type = null } = {}, client = null) {
    const offset = (page - 1) * limit;
    const params = [warehouseId];
    let paramCount = 2;

    let query = `
      SELECT sm.*, u.name AS created_by_name
      FROM stock_movements sm
      LEFT JOIN users u ON sm.created_by = u.id
      WHERE sm.warehouse_id = $1
    `;

    if (movement_type) {
      query += ` AND sm.movement_type = $${paramCount}`;
      paramCount += 1;
      params.push(movement_type);
    }

    query += ` ORDER BY sm.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    paramCount += 2;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    return result.rows;
  }

  /**
   * Acquire an advisory SELECT … FOR UPDATE lock on an inventory row by SKU + warehouse.
   * Must be called inside a transaction (pass the `tx` client).
   */
  async lockBySku(sku, warehouseId, client) {
    const result = await this.query(
      `SELECT * FROM inventory WHERE sku = $1 AND warehouse_id = $2 FOR UPDATE`,
      [sku, warehouseId], client
    );
    return result.rows[0] || null;
  }

  /**
   * Check whether a SKU already exists (for uniqueness validation before insert).
   * Scoped to an organisation when organizationId is provided.
   *
   * @param {string} sku
   * @param {string|null} organizationId  - pass null for global/system scope
   * @param {object|null} client
   * @returns {Promise<boolean>}
   */
  async skuExists(sku, organizationId, client = null) {
    const result = await this.query(
      'SELECT 1 FROM inventory WHERE organization_id IS NOT DISTINCT FROM $1 AND sku = $2 LIMIT 1',
      [organizationId || null, sku], client
    );
    return result.rows.length > 0;
  }

  /**
   * Count how many warehouses have at least `minQty` available of a given SKU.
   * Used by allocationService to decide whether a split is needed.
   *
   * @param {string} sku
   * @param {number} minQty
   * @param {object|null} client
   * @returns {Promise<number>}
   */
  async countWarehousesWithStock(sku, minQty, client = null) {
    const result = await this.query(
      `SELECT COUNT(*) AS warehouse_count
       FROM inventory i
       JOIN products p ON p.id = i.product_id
       WHERE p.sku = $1 AND i.available_quantity >= $2`,
      [sku, minQty], client
    );
    return parseInt(result.rows[0].warehouse_count, 10);
  }

  /**
   * Return all active warehouses that hold any available stock for a SKU,
   * sorted descending by available quantity.
   * Used by allocationService for order-split allocation.
   *
   * @param {string} sku
   * @param {object|null} client
   * @returns {Promise<Array>}  rows with warehouse fields + available_quantity
   */
  async findWarehousesWithStockBySku(sku, client = null) {
    const result = await this.query(
      `SELECT w.*, i.available_quantity
       FROM warehouses w
       JOIN inventory i ON i.warehouse_id = w.id
       JOIN products p  ON p.id = i.product_id
       WHERE p.sku = $1
         AND i.available_quantity > 0
         AND w.is_active = true
       ORDER BY i.available_quantity DESC`,
      [sku], client
    );
    return result.rows;
  }

  /**
   * Find the best warehouse with stock for a SKU within an organization.
   * Returns the warehouse_id with the highest available_quantity, or null.
   */
  async findBestWarehouseForSku(sku, organizationId, quantity = 1, client = null) {
    const result = await this.query(
      `SELECT i.warehouse_id, i.available_quantity
       FROM inventory i
       JOIN warehouses w ON w.id = i.warehouse_id
       WHERE i.sku = $1
         AND i.organization_id = $2
         AND i.available_quantity >= $3
         AND w.is_active = true
       ORDER BY i.available_quantity DESC
       LIMIT 1`,
      [sku, organizationId, quantity], client
    );
    return result.rows[0]?.warehouse_id || null;
  }

  /**
   * Reconcile available_quantity drift across inventory rows.
   * Sets available = MAX(0, quantity - reserved_quantity) wherever they diverge.
   */
  async reconcileDrift(warehouseId, client = null) {
    const result = await this.query(
      `UPDATE inventory
       SET available_quantity = GREATEST(0, quantity - reserved_quantity),
           updated_at = NOW()
       WHERE ($1::uuid IS NULL OR warehouse_id = $1)
         AND available_quantity <> GREATEST(0, quantity - reserved_quantity)
       RETURNING id`,
      [warehouseId || null], client
    );
    return result.rows;
  }

  /**
   * Get aggregate inventory statistics for a warehouse (or all warehouses).
   */
  async getInventorySyncStats(warehouseId, client = null) {
    const result = await this.query(
      `SELECT
         COUNT(*)                           AS distinct_skus,
         COALESCE(SUM(quantity), 0)         AS total_units,
         COALESCE(SUM(reserved_quantity),0) AS total_reserved,
         COALESCE(SUM(available_quantity),0) AS total_available,
         COUNT(*) FILTER (
           WHERE low_stock_threshold IS NOT NULL
             AND quantity <= low_stock_threshold
         ) AS low_stock_skus
       FROM inventory
       WHERE ($1::uuid IS NULL OR warehouse_id = $1)`,
      [warehouseId || null], client
    );
    return result.rows[0];
  }
}

export default new InventoryRepository();
