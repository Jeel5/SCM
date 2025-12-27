import pool from '../configs/db.js';

// ========== WAREHOUSES ==========
export async function listWarehouses(req, res) {
  try {
    const { is_active, search } = req.query;
    
    let query = `
      SELECT w.*, u.name as manager_name,
             (SELECT COUNT(*) FROM inventory i WHERE i.warehouse_id = w.id) as inventory_count
      FROM warehouses w
      LEFT JOIN users u ON w.manager_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (is_active !== undefined) {
      params.push(is_active === 'true');
      query += ` AND w.is_active = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (w.name ILIKE $${params.length} OR w.code ILIKE $${params.length})`;
    }
    
    query += ' ORDER BY w.created_at DESC';
    
    const result = await pool.query(query, params);
    
    const warehouses = result.rows.map(w => ({
      id: w.id,
      code: w.code,
      name: w.name,
      type: 'fulfillment',
      address: w.address,
      capacity: w.capacity,
      currentUtilization: Math.floor(Math.random() * 40) + 50,
      utilizationPercentage: Math.floor(Math.random() * 40) + 50,
      inventoryCount: parseInt(w.inventory_count) || 0,
      zones: Math.floor(Math.random() * 6) + 3,
      location: w.address?.coordinates || { lat: 0, lng: 0 },
      status: w.is_active ? 'active' : 'inactive',
      contactEmail: `${w.code.toLowerCase()}@logitower.com`,
      contactPhone: '+1-555-0100',
      operatingHours: { open: '06:00', close: '22:00', timezone: 'America/Los_Angeles' },
      managerId: w.manager_id,
      managerName: w.manager_name,
      createdAt: w.created_at
    }));
    
    res.json({ success: true, data: warehouses });
  } catch (error) {
    console.error('List warehouses error:', error);
    res.status(500).json({ error: 'Failed to list warehouses' });
  }
}

export async function getWarehouse(req, res) {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT w.*, u.name as manager_name FROM warehouses w
       LEFT JOIN users u ON w.manager_id = u.id WHERE w.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get warehouse error:', error);
    res.status(500).json({ error: 'Failed to get warehouse' });
  }
}

export async function createWarehouse(req, res) {
  try {
    const { code, name, address, capacity, managerId } = req.body;
    
    const result = await pool.query(
      `INSERT INTO warehouses (code, name, address, capacity, manager_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [code, name, JSON.stringify(address), capacity, managerId]
    );
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Create warehouse error:', error);
    res.status(500).json({ error: 'Failed to create warehouse' });
  }
}

// ========== CARRIERS ==========
export async function listCarriers(req, res) {
  try {
    const { is_active, search } = req.query;
    
    let query = `
      SELECT c.*,
             (SELECT COUNT(*) FROM shipments s WHERE s.carrier_id = c.id) as total_shipments,
             (SELECT COUNT(*) FROM shipments s WHERE s.carrier_id = c.id AND s.status NOT IN ('delivered', 'returned')) as active_shipments
      FROM carriers c
      WHERE 1=1
    `;
    const params = [];
    
    if (is_active !== undefined) {
      params.push(is_active === 'true');
      query += ` AND c.is_active = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (c.name ILIKE $${params.length} OR c.code ILIKE $${params.length})`;
    }
    
    query += ' ORDER BY c.name ASC';
    
    const result = await pool.query(query, params);
    
    const carriers = result.rows.map(c => ({
      id: c.id,
      code: c.code,
      name: c.name,
      type: c.service_type === 'express' ? 'multimodal' : 'ground',
      status: c.is_active ? 'active' : 'inactive',
      rating: parseFloat(c.reliability_score) * 5 || 4.0,
      onTimeDeliveryRate: parseFloat(c.reliability_score) * 100 || 90,
      damageRate: 1.0,
      lossRate: 0.2,
      averageDeliveryTime: 2.5,
      activeShipments: parseInt(c.active_shipments) || 0,
      totalShipments: parseInt(c.total_shipments) || 0,
      services: ['Express', 'Standard'],
      serviceAreas: ['North America'],
      rateCard: [],
      contactEmail: c.contact_email,
      contactPhone: c.contact_phone,
      createdAt: c.created_at
    }));
    
    res.json({ success: true, data: carriers });
  } catch (error) {
    console.error('List carriers error:', error);
    res.status(500).json({ error: 'Failed to list carriers' });
  }
}

export async function getCarrier(req, res) {
  try {
    const { id } = req.params;
    
    const result = await pool.query('SELECT * FROM carriers WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Carrier not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get carrier error:', error);
    res.status(500).json({ error: 'Failed to get carrier' });
  }
}

export async function createCarrier(req, res) {
  try {
    const { code, name, serviceType, contactEmail, contactPhone, reliabilityScore } = req.body;
    
    const result = await pool.query(
      `INSERT INTO carriers (code, name, service_type, contact_email, contact_phone, reliability_score)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [code, name, serviceType, contactEmail, contactPhone, reliabilityScore || 0.85]
    );
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Create carrier error:', error);
    res.status(500).json({ error: 'Failed to create carrier' });
  }
}

// ========== PRODUCTS ==========
export async function listProducts(req, res) {
  try {
    const { category, is_active, search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    
    if (is_active !== undefined) {
      params.push(is_active === 'true');
      query += ` AND is_active = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR sku ILIKE $${params.length})`;
    }
    
    query += ` ORDER BY name ASC LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await pool.query(query, params);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('List products error:', error);
    res.status(500).json({ error: 'Failed to list products' });
  }
}

export async function createProduct(req, res) {
  try {
    const { sku, name, category, weight, dimensions, unitPrice } = req.body;
    
    const result = await pool.query(
      `INSERT INTO products (sku, name, category, weight, dimensions, unit_price)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [sku, name, category, weight, JSON.stringify(dimensions), unitPrice]
    );
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
}

// ========== SLA POLICIES ==========
export async function listSlaPolicies(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM sla_policies WHERE is_active = true ORDER BY name ASC'
    );
    
    const policies = result.rows.map(p => ({
      id: p.id,
      name: p.name,
      serviceType: p.service_type,
      region: p.origin_region || 'Nationwide',
      targetDeliveryHours: p.delivery_hours,
      warningThresholdHours: Math.floor(p.delivery_hours * 0.8),
      penaltyAmount: parseFloat(p.penalty_per_hour) || 10,
      penaltyType: 'fixed',
      isActive: p.is_active,
      createdAt: p.created_at
    }));
    
    res.json({ success: true, data: policies });
  } catch (error) {
    console.error('List SLA policies error:', error);
    res.status(500).json({ error: 'Failed to list SLA policies' });
  }
}

// ========== RATE CARDS ==========
export async function listRateCards(req, res) {
  try {
    const { carrierId } = req.params;
    
    const result = await pool.query(
      `SELECT rc.*, c.name as carrier_name FROM rate_cards rc
       JOIN carriers c ON rc.carrier_id = c.id
       WHERE rc.carrier_id = $1
       ORDER BY rc.origin_state, rc.destination_state`,
      [carrierId]
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('List rate cards error:', error);
    res.status(500).json({ error: 'Failed to list rate cards' });
  }
}
