import pool from '../configs/db.js';

// List shipments
export async function listShipments(req, res) {
  try {
    const { status, carrier_id, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT s.*, c.name as carrier_name, c.code as carrier_code, o.order_number,
             w.name as warehouse_name
      FROM shipments s
      LEFT JOIN carriers c ON s.carrier_id = c.id
      LEFT JOIN orders o ON s.order_id = o.id
      LEFT JOIN warehouses w ON s.warehouse_id = w.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      params.push(status);
      query += ` AND s.status = $${params.length}`;
    }
    
    if (carrier_id) {
      params.push(carrier_id);
      query += ` AND s.carrier_id = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (s.tracking_number ILIKE $${params.length} OR o.order_number ILIKE $${params.length})`;
    }
    
    // Count query
    const countParams = [...params];
    const countResult = await pool.query(
      query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM').split('ORDER BY')[0],
      countParams
    );
    const total = countResult.rows && countResult.rows[0] ? parseInt(countResult.rows[0].count) : 0;
    
    query += ` ORDER BY s.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await pool.query(query, params);
    
    // Get events for each shipment
    const shipments = await Promise.all(result.rows.map(async (row) => {
      const eventsResult = await pool.query(
        `SELECT * FROM shipment_events WHERE shipment_id = $1 ORDER BY event_timestamp ASC`,
        [row.id]
      );
      
      return {
        id: row.id,
        trackingNumber: row.tracking_number,
        orderId: row.order_id,
        orderNumber: row.order_number,
        carrierId: row.carrier_id,
        carrierName: row.carrier_name,
        carrierCode: row.carrier_code,
        warehouseId: row.warehouse_id,
        warehouseName: row.warehouse_name,
        status: row.status,
        origin: row.origin_address,
        destination: row.destination_address,
        currentLocation: row.current_location,
        weight: parseFloat(row.weight || 0),
        cost: parseFloat(row.shipping_cost || 0),
        estimatedDelivery: row.delivery_scheduled,
        slaDeadline: row.delivery_scheduled,
        pickupScheduled: row.pickup_scheduled,
        pickupActual: row.pickup_actual,
        deliveryActual: row.delivery_actual,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        events: eventsResult.rows.map(e => ({
          id: e.id,
          shipmentId: e.shipment_id,
          status: e.event_type,
          location: e.location,
          timestamp: e.event_timestamp,
          description: e.description
        }))
      };
    }));
    
    res.json({
      success: true,
      data: shipments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('List shipments error:', error);
    res.status(500).json({ success: false, error: 'Failed to list shipments' });
  }
}

// Get single shipment
export async function getShipment(req, res) {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT s.*, c.name as carrier_name, o.order_number, w.name as warehouse_name
       FROM shipments s
       LEFT JOIN carriers c ON s.carrier_id = c.id
       LEFT JOIN orders o ON s.order_id = o.id
       LEFT JOIN warehouses w ON s.warehouse_id = w.id
       WHERE s.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    
    const row = result.rows[0];
    
    // Get events
    const eventsResult = await pool.query(
      `SELECT * FROM shipment_events WHERE shipment_id = $1 ORDER BY event_timestamp ASC`,
      [id]
    );
    
    res.json({
      success: true,
      data: {
        id: row.id,
        trackingNumber: row.tracking_number,
        orderId: row.order_id,
        orderNumber: row.order_number,
        carrierId: row.carrier_id,
        carrierName: row.carrier_name,
        status: row.status,
        origin: row.origin_address,
        destination: row.destination_address,
        currentLocation: row.current_location,
        weight: parseFloat(row.weight || 0),
        cost: parseFloat(row.shipping_cost || 0),
        estimatedDelivery: row.delivery_scheduled,
        createdAt: row.created_at,
        events: eventsResult.rows.map(e => ({
          id: e.id,
          status: e.event_type,
          location: e.location,
          timestamp: e.event_timestamp,
          description: e.description
        }))
      }
    });
  } catch (error) {
    console.error('Get shipment error:', error);
    res.status(500).json({ error: 'Failed to get shipment' });
  }
}

// Get shipment timeline
export async function getShipmentTimeline(req, res) {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT se.*, s.tracking_number
       FROM shipment_events se
       JOIN shipments s ON se.shipment_id = s.id
       WHERE se.shipment_id = $1
       ORDER BY se.event_timestamp ASC`,
      [id]
    );
    
    res.json({
      success: true,
      data: result.rows.map(e => ({
        id: e.id,
        shipmentId: e.shipment_id,
        status: e.event_type,
        location: e.location,
        timestamp: e.event_timestamp,
        description: e.description
      }))
    });
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({ error: 'Failed to get timeline' });
  }
}

// Create shipment
export async function createShipment(req, res) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { orderId, carrierId, warehouseId } = req.body;
    
    // Get order details
    const orderResult = await client.query(
      `SELECT o.*, json_agg(oi.*) as items FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.id = $1 GROUP BY o.id`,
      [orderId]
    );
    
    if (orderResult.rows.length === 0) {
      throw new Error('Order not found');
    }
    
    const order = orderResult.rows[0];
    const trackingNumber = `TRK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    // Get warehouse address
    const warehouseResult = await client.query(
      'SELECT address FROM warehouses WHERE id = $1',
      [warehouseId]
    );
    const originAddress = warehouseResult.rows[0]?.address || {};
    
    const shipmentResult = await client.query(
      `INSERT INTO shipments (tracking_number, order_id, carrier_id, warehouse_id, 
                             origin_address, destination_address, status, pickup_scheduled)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW() + INTERVAL '1 day') RETURNING *`,
      [trackingNumber, orderId, carrierId, warehouseId, 
       JSON.stringify(originAddress), JSON.stringify(order.shipping_address)]
    );
    
    const shipment = shipmentResult.rows[0];
    
    // Create initial event
    await client.query(
      `INSERT INTO shipment_events (shipment_id, event_type, description, event_timestamp)
       VALUES ($1, 'created', 'Shipment created and pickup scheduled', NOW())`,
      [shipment.id]
    );
    
    // Update order status
    await client.query(
      `UPDATE orders SET status = 'shipped', updated_at = NOW() WHERE id = $1`,
      [orderId]
    );
    
    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      message: 'Shipment created',
      data: { ...shipment, trackingNumber: shipment.tracking_number }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create shipment error:', error);
    res.status(500).json({ error: error.message || 'Failed to create shipment' });
  } finally {
    client.release();
  }
}

// Update shipment status
export async function updateShipmentStatus(req, res) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { status, location, description } = req.body;
    
    await client.query(
      `UPDATE shipments SET status = $1, current_location = $2, updated_at = NOW() WHERE id = $3`,
      [status, location ? JSON.stringify(location) : null, id]
    );
    
    await client.query(
      `INSERT INTO shipment_events (shipment_id, event_type, location, description, event_timestamp)
       VALUES ($1, $2, $3, $4, NOW())`,
      [id, status, location ? JSON.stringify(location) : null, description]
    );
    
    if (status === 'delivered') {
      await client.query(
        `UPDATE shipments SET delivery_actual = NOW() WHERE id = $1`,
        [id]
      );
      await client.query(
        `UPDATE orders SET status = 'delivered', actual_delivery = NOW() 
         WHERE id = (SELECT order_id FROM shipments WHERE id = $1)`,
        [id]
      );
    }
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'Shipment updated' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update shipment error:', error);
    res.status(500).json({ error: 'Failed to update shipment' });
  } finally {
    client.release();
  }
}
