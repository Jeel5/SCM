// Warehouse Repository - handles warehouse CRUD and statistics
import BaseRepository from './BaseRepository.js';

class WarehouseRepository extends BaseRepository {
  constructor() {
    super('warehouses');
  }

  // Get warehouses with pagination and filtering
  async findWarehouses({ page = 1, limit = 20, is_active = null, warehouse_type = null, search = null, organizationId = undefined }, client = null) {
    const offset = (page - 1) * limit;
    const params = [];
    let paramCount = 1;
    
    let query = `
      SELECT w.*,
        u.name as manager_name,
        COUNT(*) OVER() as total_count
      FROM warehouses w
      LEFT JOIN users u ON w.manager_id = u.id
      WHERE 1=1
    `;

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId, 'w');
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${paramCount++}`;
        params.push(...orgFilter.params);
      }
    }

    if (is_active !== null) {
      query += ` AND w.is_active = $${paramCount++}`;
      params.push(is_active);
    }

    if (warehouse_type) {
      query += ` AND w.warehouse_type = $${paramCount++}`;
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
      paramCount++;
    }

    query += ` ORDER BY w.name ASC`;
    query += ` LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    
    return {
      warehouses: result.rows,
      totalCount: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0
    };
  }

  // Find warehouse by ID with manager details, with optional organization filter
  async findByIdWithDetails(id, organizationId = undefined, client = null) {
    let query = `
      SELECT w.*,
        u.name as manager_name,
        u.email as manager_email,
        u.phone as manager_phone
      FROM warehouses w
      LEFT JOIN users u ON w.manager_id = u.id
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

  // Find warehouse by code
  async findByCode(code, client = null) {
    const query = `SELECT * FROM warehouses WHERE code = $1`;
    const result = await this.query(query, [code], client);
    return result.rows[0] || null;
  }

  // Create warehouse
  // Generate unique warehouse code
  async generateWarehouseCode(client = null) {
    const prefix = 'WH';
    const year = new Date().getFullYear().toString().slice(-2);
    
    // Get the count of warehouses created this year
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM warehouses 
      WHERE code LIKE $1
    `;
    const result = await this.query(countQuery, [`${prefix}-${year}%`], client);
    const count = parseInt(result.rows[0].count) + 1;
    
    // Generate code like WH-26-001, WH-26-002, etc.
    const sequence = count.toString().padStart(3, '0');
    return `${prefix}-${year}-${sequence}`;
  }

  async createWarehouse(warehouseData, client = null) {
    // Auto-generate code if not provided
    const code = warehouseData.code || await this.generateWarehouseCode(client);
    
    const query = `
      INSERT INTO warehouses (
        organization_id, code, name, warehouse_type,
        address, coordinates, capacity, current_utilization,
        manager_id, contact_email, contact_phone,
        is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *
    `;
    
    const params = [
      warehouseData.organization_id, // From user's organization
      code,
      warehouseData.name,
      warehouseData.warehouse_type || 'standard',
      JSON.stringify(warehouseData.address),
      warehouseData.coordinates ? JSON.stringify(warehouseData.coordinates) : null,
      warehouseData.capacity || 10000,
      warehouseData.current_utilization || 0,
      warehouseData.manager_id || null,
      warehouseData.contact_email,
      warehouseData.contact_phone || null,
      warehouseData.is_active !== false // Default to true
    ];

    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  // Update warehouse
  async updateWarehouse(id, warehouseData, client = null) {
    const updates = [];
    const params = [];
    let paramCount = 1;

    // Build dynamic SET clause based on provided fields
    if (warehouseData.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      params.push(warehouseData.name);
    }

    if (warehouseData.warehouse_type !== undefined) {
      updates.push(`warehouse_type = $${paramCount++}`);
      params.push(warehouseData.warehouse_type);
    }

    if (warehouseData.address !== undefined) {
      updates.push(`address = $${paramCount++}`);
      params.push(JSON.stringify(warehouseData.address));
    }

    if (warehouseData.coordinates !== undefined) {
      updates.push(`coordinates = $${paramCount++}`);
      params.push(warehouseData.coordinates ? JSON.stringify(warehouseData.coordinates) : null);
    }

    if (warehouseData.capacity !== undefined) {
      updates.push(`capacity = $${paramCount++}`);
      params.push(warehouseData.capacity);
    }

    if (warehouseData.current_utilization !== undefined) {
      updates.push(`current_utilization = $${paramCount++}`);
      params.push(warehouseData.current_utilization);
    }

    if (warehouseData.manager_id !== undefined) {
      updates.push(`manager_id = $${paramCount++}`);
      params.push(warehouseData.manager_id);
    }

    if (warehouseData.contact_email !== undefined) {
      updates.push(`contact_email = $${paramCount++}`);
      params.push(warehouseData.contact_email);
    }

    if (warehouseData.contact_phone !== undefined) {
      updates.push(`contact_phone = $${paramCount++}`);
      params.push(warehouseData.contact_phone);
    }

    if (warehouseData.is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      params.push(warehouseData.is_active);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
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

  // Soft delete warehouse (deactivate)
  async deactivateWarehouse(id, client = null) {
    const query = `
      UPDATE warehouses 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await this.query(query, [id], client);
    return result.rows[0];
  }

  // Check if warehouse has inventory
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

  // Get warehouse statistics
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
        COUNT(DISTINCT pl.id) as total_pick_lists,
        COUNT(DISTINCT CASE WHEN pl.status = 'pending' THEN pl.id END) as pending_pick_lists,
        COUNT(DISTINCT CASE WHEN pl.status = 'in_progress' THEN pl.id END) as active_pick_lists,
        COUNT(DISTINCT CASE WHEN pl.status = 'completed' THEN pl.id END) as completed_pick_lists
      FROM warehouses w
      LEFT JOIN inventory i ON w.id = i.warehouse_id
      LEFT JOIN pick_lists pl ON w.id = pl.warehouse_id
      WHERE w.id = $1
      GROUP BY w.id, w.name, w.capacity, w.current_utilization
    `;
    const result = await this.query(query, [id], client);
    return result.rows[0] || null;
  }

  // Get inventory for a specific warehouse
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
      paramCount++;
    }

    if (low_stock) {
      query += ` AND i.available_quantity <= i.reorder_point`;
    }

    query += ` ORDER BY i.product_name ASC`;
    query += ` LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    
    return {
      items: result.rows,
      totalCount: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0
    };
  }

  // Update warehouse utilization
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

  // Get all active warehouses (for dropdowns)
  async getActiveWarehouses(client = null) {
    const query = `
      SELECT id, code, name, warehouse_type, address, coordinates
      FROM warehouses 
      WHERE is_active = true
      ORDER BY name ASC
    `;
    const result = await this.query(query, [], client);
    return result.rows;
  }
}

export default new WarehouseRepository();
