import pool from '../configs/db.js';

// List inventory
export async function getInventory(req, res) {
  try {
    const { warehouse_id, product_id, low_stock, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT i.*, w.name as warehouse_name, w.code as warehouse_code,
             p.name as product_name, p.sku, p.category, p.unit_price
      FROM inventory i
      JOIN warehouses w ON i.warehouse_id = w.id
      JOIN products p ON i.product_id = p.id
      WHERE 1=1
    `;
    const params = [];
    
    if (warehouse_id) {
      params.push(warehouse_id);
      query += ` AND i.warehouse_id = $${params.length}`;
    }
    
    if (product_id) {
      params.push(product_id);
      query += ` AND i.product_id = $${params.length}`;
    }
    
    if (low_stock === 'true') {
      query += ` AND i.available_quantity < 50`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`;
    }
    
    // Count
    const countResult = await pool.query(
      query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM'),
      params
    );
    const total = parseInt(countResult.rows[0].count);
    
    query += ` ORDER BY i.updated_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await pool.query(query, params);
    
    const inventory = result.rows.map(row => ({
      id: row.id,
      productId: row.product_id,
      productName: row.product_name,
      name: row.product_name,
      sku: row.sku,
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      quantity: row.available_quantity + row.reserved_quantity,
      reservedQuantity: row.reserved_quantity,
      availableQuantity: row.available_quantity,
      damagedQuantity: row.damaged_quantity,
      minQuantity: 50,
      maxQuantity: 500,
      reorderPoint: 50,
      reorderQuantity: 200,
      unitCost: parseFloat(row.unit_price || 0),
      category: row.category,
      unit: 'pieces',
      location: 'Warehouse',
      lastRestocked: row.last_stock_check,
      updatedAt: row.updated_at
    }));
    
    res.json({
      data: inventory,
      total,
      page: parseInt(page),
      pageSize: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Failed to get inventory' });
  }
}

// Get inventory by ID
export async function getInventoryItem(req, res) {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT i.*, w.name as warehouse_name, p.name as product_name, p.sku, p.category
       FROM inventory i
       JOIN warehouses w ON i.warehouse_id = w.id
       JOIN products p ON i.product_id = p.id
       WHERE i.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get inventory item error:', error);
    res.status(500).json({ error: 'Failed to get inventory item' });
  }
}

// Adjust stock
export async function adjustStock(req, res) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { warehouseId, productId, adjustment, reason } = req.body;
    
    // Update inventory
    await client.query(
      `UPDATE inventory 
       SET available_quantity = available_quantity + $1, updated_at = NOW()
       WHERE warehouse_id = $2 AND product_id = $3`,
      [adjustment, warehouseId, productId]
    );
    
    // Log stock movement
    await client.query(
      `INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity, reference_type, notes, created_by)
       VALUES ($1, $2, 'adjustment', $3, 'adjustment', $4, $5)`,
      [warehouseId, productId, adjustment, reason, req.user?.userId]
    );
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'Stock adjusted' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Adjust stock error:', error);
    res.status(500).json({ error: 'Failed to adjust stock' });
  } finally {
    client.release();
  }
}

// Get stock movements
export async function getStockMovements(req, res) {
  try {
    const { warehouse_id, product_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT sm.*, w.name as warehouse_name, p.name as product_name, p.sku,
             u.name as created_by_name
      FROM stock_movements sm
      JOIN warehouses w ON sm.warehouse_id = w.id
      JOIN products p ON sm.product_id = p.id
      LEFT JOIN users u ON sm.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (warehouse_id) {
      params.push(warehouse_id);
      query += ` AND sm.warehouse_id = $${params.length}`;
    }
    
    if (product_id) {
      params.push(product_id);
      query += ` AND sm.product_id = $${params.length}`;
    }
    
    query += ` ORDER BY sm.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await pool.query(query, params);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get stock movements error:', error);
    res.status(500).json({ error: 'Failed to get stock movements' });
  }
}
