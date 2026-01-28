// Inventory Repository - handles stock levels, reservations, and movements
import BaseRepository from './BaseRepository.js';

class InventoryRepository extends BaseRepository {
  constructor() {
    super('inventory');
  }

  // Get inventory with pagination, filtering by warehouse/status/search, optional low stock filter
  async findInventory({ page = 1, limit = 20, warehouse_id = null, status = null, search = null, low_stock = false }, client = null) {
    const offset = (page - 1) * limit;
    const params = [];
    let paramCount = 1;
    
    let query = `
      SELECT i.*,
        COUNT(*) OVER() as total_count
      FROM inventory i
      WHERE 1=1
    `;

    if (warehouse_id) {
      query += ` AND i.warehouse_id = $${paramCount++}`;
      params.push(warehouse_id);
    }

    if (status) {
      query += ` AND i.status = $${paramCount++}`;
      params.push(status);
    }

    if (search) {
      query += ` AND (
        i.sku ILIKE $${paramCount} OR
        i.product_name ILIKE $${paramCount} OR
        i.product_id::text ILIKE $${paramCount}
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

  /**
   * Find inventory by SKU and warehouse
  // Find inventory by SKU and warehouse combination
  async findBySKUAndWarehouse(sku, warehouseId, client = null) {
    const query = `
      SELECT * FROM inventory 
      WHERE sku = $1 AND warehouse_id = $2
    `;
    const result = await this.query(query, [sku, warehouseId], client);
    return result.rows[0] || null;
  }

  // Get all inventory records for a product across warehouses
  async findByProductId(productId, client = null) {
    const query = `
      SELECT * FROM inventory 
      WHERE product_id = $1
      ORDER BY warehouse_id
    `;
    const result = await this.query(query, [productId], client);
    return result.rows;
  }

  // Update inventory quantities (total, reserved, or available)
  async updateQuantities(inventoryId, quantities, client = null) {
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (quantities.quantity !== undefined) {
      updates.push(`quantity = $${paramCount++}`);
      params.push(quantities.quantity);
    }

    if (quantities.reserved_quantity !== undefined) {
      updates.push(`reserved_quantity = $${paramCount++}`);
      params.push(quantities.reserved_quantity);
    }

    if (quantities.available_quantity !== undefined) {
      updates.push(`available_quantity = $${paramCount++}`);
      params.push(quantities.available_quantity);
    }

    if (updates.length === 0) {
      throw new Error('No quantities to update');
    }

    updates.push(`updated_at = NOW()`);
    params.push(inventoryId);

    const query = `
      UPDATE inventory
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  // Reserve stock for order - moves from available to reserved
  async reserveStock(sku, warehouseId, quantity, client) {
    const query = `
      UPDATE inventory
      SET 
        reserved_quantity = reserved_quantity + $1,
        available_quantity = available_quantity - $1,
        updated_at = NOW()
      WHERE sku = $2 AND warehouse_id = $3 AND available_quantity >= $1
      RETURNING *
    `;
    
    const result = await this.query(query, [quantity, sku, warehouseId], client);
    return result.rows[0];
  }

  // Release reserved stock back to available (e.g., cancelled order)
  async releaseStock(sku, warehouseId, quantity, client) {
    const query = `
      UPDATE inventory
      SET 
        reserved_quantity = reserved_quantity - $1,
        available_quantity = available_quantity + $1,
        updated_at = NOW()
      WHERE sku = $2 AND warehouse_id = $3
      RETURNING *
    `;
    
    const result = await this.query(query, [quantity, sku, warehouseId], client);
    return result.rows[0];
  }

  /**
   * Deduct inventory (e.g., order shipped)
   */
  async deductStock(sku, warehouseId, quantity, client) {
    const query = `
      UPDATE inventory
      SET 
        quantity = quantity - $1,
        reserved_quantity = reserved_quantity - $1,
        updated_at = NOW()
      WHERE sku = $2 AND warehouse_id = $3
      RETURNING *
    `;
    
    const result = await this.query(query, [quantity, sku, warehouseId], client);
    return result.rows[0];
  }

  /**
   * Add stock (e.g., restocking)
   */
  async addStock(sku, warehouseId, quantity, client) {
    const query = `
      UPDATE inventory
      SET 
        quantity = quantity + $1,
        available_quantity = available_quantity + $1,
        updated_at = NOW()
      WHERE sku = $2 AND warehouse_id = $3
      RETURNING *
    `;
    
    const result = await this.query(query, [quantity, sku, warehouseId], client);
    return result.rows[0];
  }

  /**
   * Get low stock items
   */
  async findLowStock(warehouseId = null, client = null) {
    let query = `
      SELECT * FROM inventory 
      WHERE available_quantity <= reorder_point
    `;
    const params = [];

    if (warehouseId) {
      query += ` AND warehouse_id = $1`;
      params.push(warehouseId);
    }

    query += ` ORDER BY available_quantity ASC`;

    const result = await this.query(query, params, client);
    return result.rows;
  }

  /**
   * Get inventory statistics
   */
  async getInventoryStats(warehouseId = null, client = null) {
    let query = `
      SELECT 
        COUNT(*) as total_items,
        SUM(quantity) as total_quantity,
        SUM(available_quantity) as total_available,
        SUM(reserved_quantity) as total_reserved,
        COUNT(*) FILTER (WHERE available_quantity <= reorder_point) as low_stock_items,
        COUNT(*) FILTER (WHERE available_quantity = 0) as out_of_stock_items,
        SUM(quantity * unit_cost) as total_inventory_value
      FROM inventory
      WHERE 1=1
    `;
    const params = [];

    if (warehouseId) {
      query += ` AND warehouse_id = $1`;
      params.push(warehouseId);
    }

    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  /**
   * Record stock movement
   */
  async recordMovement(movementData, client) {
    const query = `
      INSERT INTO stock_movements 
      (inventory_id, movement_type, quantity, from_location, to_location, reason, reference_id, performed_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const params = [
      movementData.inventory_id,
      movementData.movement_type,
      movementData.quantity,
      movementData.from_location || null,
      movementData.to_location || null,
      movementData.reason || null,
      movementData.reference_id || null,
      movementData.performed_by || null
    ];

    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  /**
   * Get stock movements for an inventory item
   */
  async findMovements(inventoryId, limit = 50, client = null) {
    const query = `
      SELECT * FROM stock_movements 
      WHERE inventory_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await this.query(query, [inventoryId, limit], client);
    return result.rows;
  }
}

export default new InventoryRepository();
