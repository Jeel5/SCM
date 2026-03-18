// Warehouse Repository - handles warehouse CRUD and statistics
import BaseRepository from './BaseRepository.js';
import { ValidationError } from '../errors/AppError.js';

class WarehouseRepository extends BaseRepository {
  constructor() {
    super('warehouses');
  }

  /**
   * Read window total from paginated rows.
   * @param {Array} rows
   * @returns {number}
   */
  parseTotalCount(rows) {
    return rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
  }

  /**
   * Get warehouses with optional filters and pagination.
   */
  async findWarehouses({ page = 1, limit = 20, is_active = null, warehouse_type = null, search = null, organizationId = undefined }, client = null) {
    const offset = (page - 1) * limit;
    const params = [];
    let paramCount = 1;
    
    let query = `
      SELECT w.*,
        COUNT(*) OVER() as total_count
      FROM warehouses w
      WHERE 1=1
    `;

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId, 'w');
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${paramCount += 1}`;
        params.push(...orgFilter.params);
      }
    }

    if (typeof is_active === 'boolean') {
      query += ` AND w.is_active = $${paramCount += 1}`;
      params.push(is_active);
    }

    if (warehouse_type) {
      query += ` AND w.warehouse_type = $${paramCount += 1}`;
      params.push(warehouse_type);
    }

    if (search) {
      query += ` AND (
        w.name ILIKE $${paramCount} OR
        w.code ILIKE $${paramCount} OR
        w.address->>'city' ILIKE $${paramCount} OR
        w.address->>'state' ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount += 1;
    }

    query += ` ORDER BY w.name ASC`;
    query += ` LIMIT $${paramCount += 1} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    
    return {
      warehouses: result.rows,
      totalCount: this.parseTotalCount(result.rows)
    };
  }

  /**
   * Find warehouse by id with optional organization scoping.
   */
  async findByIdWithDetails(id, organizationId = undefined, client = null) {
    let query = `
      SELECT w.*
      FROM warehouses w
      WHERE w.id = $1
    `;
    const params = [id];

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId, 'w');
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$2`;
        params.push(...orgFilter.params);
      }
    }

    const result = await this.query(query, params, client);
    return result.rows[0] || null;
  }

  /**
   * Find warehouse by code with optional organization scoping.
   */
  async findByCode(code, organizationId = undefined, client = null) {
    let query = `SELECT * FROM warehouses WHERE code = $1`;
    const params = [code];
    if (organizationId !== undefined) {
      query += ` AND organization_id = $2`;
      params.push(organizationId);
    }
    const result = await this.query(query, params, client);
    return result.rows[0] || null;
  }

  /**
   * Generate unique warehouse code from DB sequence.
   */
  async generateWarehouseCode(client = null) {
    const prefix = 'WH';
    const year = new Date().getFullYear().toString().slice(-2);
    // NEXTVAL is atomic — two concurrent calls always get different values.
    const result = await this.query(
      `SELECT nextval('wh_code_seq') AS seq`,
      [],
      client
    );
    const sequence = result.rows[0].seq.toString().padStart(3, '0');
    return `${prefix}-${year}-${sequence}`;
  }

  /**
   * Create warehouse record.
   */
  async createWarehouse(warehouseData, client = null) {
    // Auto-generate code if not provided
    const code = warehouseData.code || await this.generateWarehouseCode(client);
    
    const query = `
      INSERT INTO warehouses (
        organization_id, code, name, warehouse_type,
        address, coordinates, capacity, current_utilization,
        contact_email, contact_phone,
        is_active,
        gstin, has_cold_storage,
        temperature_min_celsius, temperature_max_celsius,
        customs_bonded_warehouse, certifications,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                $12, $13, $14, $15, $16, $17, NOW(), NOW())
      RETURNING *
    `;
    
    const params = [
      warehouseData.organization_id,
      code,
      warehouseData.name,
      warehouseData.warehouse_type || 'standard',
      JSON.stringify(warehouseData.address),
      warehouseData.coordinates ? JSON.stringify(warehouseData.coordinates) : null,
      warehouseData.capacity || 10000,
      0,
      warehouseData.contact_email,
      warehouseData.contact_phone || null,
      warehouseData.is_active !== false,
      // SCM-scoped fields
      warehouseData.gstin || null,
      warehouseData.has_cold_storage || false,
      warehouseData.temperature_min_celsius ?? null,
      warehouseData.temperature_max_celsius ?? null,
      warehouseData.customs_bonded_warehouse || false,
      warehouseData.certifications ? warehouseData.certifications : [],
    ];

    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  /**
   * Update mutable warehouse fields.
   * @param {string} id
   * @param {Object} warehouseData
   * @param {Object|null} client
   * @returns {Promise<Object>}
   */
  async updateWarehouse(id, warehouseData, client = null) {
    const updates = [];
    const params = [];
    let paramCount = 1;

    const fieldSerializers = {
      address: (v) => JSON.stringify(v),
      coordinates: (v) => (v ? JSON.stringify(v) : null),
      gstin: (v) => v || null,
    };

    const mutableFields = [
      'name',
      'warehouse_type',
      'address',
      'coordinates',
      'capacity',
      'current_utilization',
      'contact_email',
      'contact_phone',
      'is_active',
      'gstin',
      'has_cold_storage',
      'temperature_min_celsius',
      'temperature_max_celsius',
      'customs_bonded_warehouse',
      'certifications',
    ];

    mutableFields.forEach((field) => {
      if (warehouseData[field] !== undefined) {
        updates.push(`${field} = $${paramCount += 1}`);
        const serializer = fieldSerializers[field];
        params.push(serializer ? serializer(warehouseData[field]) : warehouseData[field]);
      }
    });

    if (updates.length === 0) {
      throw new ValidationError('No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const query = `
      UPDATE warehouses 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  /**
   * Soft delete warehouse (deactivate) when no live inventory exists.
   */
  async deactivateWarehouse(id, client = null) {
    // Pre-check: refuse to deactivate a warehouse that still holds live inventory
    const hasLiveStock = await this.hasInventory(id, client);
    if (hasLiveStock) {
      const err = new Error('Cannot deactivate warehouse with live inventory. Transfer or deplete stock first.');
      err.statusCode = 409;
      throw err;
    }

    const query = `
      UPDATE warehouses 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await this.query(query, [id], client);
    return result.rows[0];
  }

  /**
   * Check whether warehouse has positive on-hand inventory.
   */
  async hasInventory(id, client = null) {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM inventory 
        WHERE warehouse_id = $1 AND quantity > 0
      ) as has_inventory
    `;
    const result = await this.query(query, [id], client);
    return result.rows[0].has_inventory;
  }

  /**
   * Get warehouse inventory and pick-list statistics.
   */
  async getWarehouseStats(id, client = null) {
    const query = `
      SELECT
        w.id,
        w.name,
        w.capacity,
        w.current_utilization,
        COUNT(DISTINCT i.id) as total_items,
        COALESCE(SUM(i.quantity), 0) as total_quantity,
        COALESCE(SUM(i.available_quantity), 0) as available_quantity,
        COALESCE(SUM(i.reserved_quantity), 0) as reserved_quantity,
        COUNT(DISTINCT CASE WHEN i.available_quantity <= i.reorder_point THEN i.id END) as low_stock_items,
        0::bigint as total_pick_lists,
        0::bigint as pending_pick_lists,
        0::bigint as active_pick_lists,
        0::bigint as completed_pick_lists
      FROM warehouses w
      LEFT JOIN inventory i ON w.id = i.warehouse_id
      WHERE w.id = $1
      GROUP BY w.id, w.name, w.capacity, w.current_utilization
    `;
    const result = await this.query(query, [id], client);
    return result.rows[0] || null;
  }

  /**
   * Get warehouse inventory with filters and pagination.
   */
  async getWarehouseInventory(warehouseId, { page = 1, limit = 20, search = null, low_stock = false }, client = null) {
    const offset = (page - 1) * limit;
    const params = [warehouseId];
    let paramCount = 2;
    
    let query = `
      SELECT i.*,
        COUNT(*) OVER() as total_count
      FROM inventory i
      WHERE i.warehouse_id = $1
    `;

    if (search) {
      query += ` AND (
        i.sku ILIKE $${paramCount} OR
        i.product_name ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount += 1;
    }

    if (low_stock) {
      query += ` AND i.available_quantity <= i.reorder_point`;
    }

    query += ` ORDER BY i.product_name ASC`;
    query += ` LIMIT $${paramCount += 1} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    
    return {
      items: result.rows,
      totalCount: this.parseTotalCount(result.rows)
    };
  }

  /**
   * Persist current utilization value for a warehouse.
   */
  async updateUtilization(id, utilization, client = null) {
    const query = `
      UPDATE warehouses 
      SET current_utilization = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await this.query(query, [utilization, id], client);
    return result.rows[0];
  }

  /**
   * List active warehouses for UI dropdowns.
   */
  async getActiveWarehouses(organizationId = undefined, client = null) {
    let query = `
      SELECT id, code, name, warehouse_type, address, coordinates
      FROM warehouses 
      WHERE is_active = true
    `;
    const params = [];
    if (organizationId !== undefined) {
      query += ` AND organization_id = $1`;
      params.push(organizationId);
    }
    query += ` ORDER BY name ASC`;
    const result = await this.query(query, params, client);
    return result.rows;
  }

  /**
   * Get aggregate inventory stats (count + total qty) for a single warehouse.
   */
  async getInventoryStats(warehouseId, client = null) {
    const result = await this.query(
      `SELECT COUNT(*) AS inventory_count,
              COALESCE(SUM(available_quantity + reserved_quantity + damaged_quantity + in_transit_quantity), 0) AS total_qty
       FROM inventory WHERE warehouse_id = $1`,
      [warehouseId], client
    );
    return result.rows[0] || { inventory_count: 0, total_qty: 0 };
  }

  /**
   * Batch aggregate inventory stats for multiple warehouses.
   * Returns a map of { warehouseId → { inventory_count, total_qty } }
   */
  async getInventoryStatsBatch(warehouseIds, client = null) {
    if (!warehouseIds.length) return {};
    const result = await this.query(
      `SELECT warehouse_id,
              COUNT(*) AS inventory_count,
              COALESCE(SUM(available_quantity + reserved_quantity + damaged_quantity + in_transit_quantity), 0) AS total_qty
       FROM inventory WHERE warehouse_id = ANY($1) GROUP BY warehouse_id`,
      [warehouseIds], client
    );
    return result.rows.reduce((acc, row) => {
      acc[row.warehouse_id] = {
        inventory_count: parseInt(row.inventory_count, 10),
        total_qty: parseInt(row.total_qty, 10),
      };
      return acc;
    }, {});
  }

  /**
   * Lightweight warehouse lookup returning only coordinates and basic info.
   * Used by shipping-quote controller to resolve a warehouse_id → lat/lon origin.
   *
   * @param {string} id
   * @param {object|null} client
   * @returns {Promise<object|null>}
   */
  async findByIdSimple(id, client = null) {
    const result = await this.query(
      `SELECT id, name, address, postal_code,
              latitude  AS lat,
              longitude AS lon
       FROM warehouses WHERE id = $1`,
      [id], client
    );
    return result.rows[0] || null;
  }

  /**
   * Recompute and persist current_utilization for a single warehouse.
   * Called after any inventory mutation (create / adjust / transfer).
   * Non-fatal: errors are swallowed at the call site.
   *
   * @param {string} warehouseId
   * @param {object|null} client
   */
  async refreshUtilization(warehouseId, client = null) {
    await this.query(
      `UPDATE warehouses
       SET current_utilization = LEAST(
         ROUND(
           COALESCE(
             (SELECT SUM(available_quantity + reserved_quantity + damaged_quantity + in_transit_quantity)
              FROM inventory
              WHERE warehouse_id = $1),
             0
           ) * 100.0 / NULLIF(capacity, 0),
           100
         ), 2
       ),
       updated_at = NOW()
       WHERE id = $1`,
      [warehouseId], client
    );
  }

  /**
   * Upsert a placeholder warehouse entry by code.
   * Used when a webhook references a warehouse that doesn't exist yet.
   */
  async upsertPlaceholder(code, name, address, client = null) {
    const result = await this.query(
      `INSERT INTO warehouses (code, name, address, is_active, created_at)
       VALUES ($1, $2, $3, true, NOW())
       ON CONFLICT (code) DO UPDATE SET code = EXCLUDED.code
       RETURNING id`,
      [code, name, address], client
    );
    return result.rows[0];
  }

  /**
   * Get inventory snapshot report per warehouse.
   */
  async getInventorySnapshotReport(warehouseId, client = null) {
    const result = await this.query(
      `SELECT
         w.id AS warehouse_id,
         w.code AS warehouse_code,
         w.name AS warehouse_name,
         COUNT(i.id)                              AS distinct_skus,
         COALESCE(SUM(i.quantity), 0)             AS total_units,
         COALESCE(SUM(i.reserved_quantity), 0)    AS reserved_units,
         COALESCE(SUM(i.available_quantity), 0)   AS available_units,
         COUNT(i.id) FILTER (
           WHERE i.low_stock_threshold IS NOT NULL
             AND i.quantity <= i.low_stock_threshold
         ) AS low_stock_skus
       FROM warehouses w
       LEFT JOIN inventory i ON i.warehouse_id = w.id
       WHERE w.is_active = true
         AND ($1::uuid IS NULL OR w.id = $1)
       GROUP BY w.id, w.code, w.name
       ORDER BY w.name`,
      [warehouseId || null], client
    );
    return result.rows;
  }
}

export default new WarehouseRepository();
