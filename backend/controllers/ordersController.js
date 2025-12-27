import pool from '../configs/db.js';

// List orders with filters and pagination
export async function listOrders(req, res) {
  try {
    const { status, priority, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT o.*,
             COALESCE(json_agg(
               json_build_object(
                 'id', oi.id,
                 'productId', oi.product_id,
                 'sku', oi.sku,
                 'productName', oi.product_name,
                 'quantity', oi.quantity,
                 'unitPrice', oi.unit_price,
                 'weight', oi.weight,
                 'warehouseId', oi.warehouse_id
               )
             ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      params.push(status);
      query += ` AND o.status = $${params.length}`;
    }
    
    if (priority) {
      params.push(priority);
      query += ` AND o.priority = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (o.order_number ILIKE $${params.length} OR o.customer_name ILIKE $${params.length})`;
    }
    
    query += ` GROUP BY o.id ORDER BY o.created_at DESC`;
    
    // Get total count first
    const countQuery = `SELECT COUNT(DISTINCT o.id) FROM orders o WHERE 1=1` + 
      (status ? ` AND o.status = $1` : '') +
      (priority ? ` AND o.priority = $${status ? 2 : 1}` : '') +
      (search ? ` AND (o.order_number ILIKE $${(status ? 1 : 0) + (priority ? 1 : 0) + 1} OR o.customer_name ILIKE $${(status ? 1 : 0) + (priority ? 1 : 0) + 1})` : '');
    
    const countParams = [];
    if (status) countParams.push(status);
    if (priority) countParams.push(priority);
    if (search) countParams.push(`%${search}%`);
    
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM orders o WHERE 1=1${status ? ' AND o.status = $1' : ''}${priority ? ` AND o.priority = $${countParams.indexOf(priority) + 1}` : ''}${search ? ` AND (o.order_number ILIKE $${countParams.length} OR o.customer_name ILIKE $${countParams.length})` : ''}`,
      countParams
    );
    const total = parseInt(countResult.rows[0].count);
    
    query += ` LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await pool.query(query, params);
    
    // Transform data to match frontend expectations
    const orders = result.rows.map(row => ({
      id: row.id,
      orderNumber: row.order_number,
      customerId: row.customer_id || 'N/A',
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      status: row.status,
      priority: row.priority,
      items: row.items,
      shippingAddress: row.shipping_address,
      billingAddress: row.billing_address,
      totalAmount: parseFloat(row.total_amount),
      currency: row.currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      estimatedDelivery: row.estimated_delivery,
      actualDelivery: row.actual_delivery,
      notes: row.notes
    }));
    
    res.json({
      data: orders,
      total,
      page: parseInt(page),
      pageSize: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('List orders error:', error);
    res.status(500).json({ error: 'Failed to list orders' });
  }
}

// Get single order
export async function getOrder(req, res) {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT o.*,
              COALESCE(json_agg(
                json_build_object(
                  'id', oi.id,
                  'productId', oi.product_id,
                  'sku', oi.sku,
                  'productName', oi.product_name,
                  'quantity', oi.quantity,
                  'unitPrice', oi.unit_price,
                  'weight', oi.weight,
                  'warehouseId', oi.warehouse_id
                )
              ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.id = $1
       GROUP BY o.id`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        id: row.id,
        orderNumber: row.order_number,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        customerPhone: row.customer_phone,
        status: row.status,
        priority: row.priority,
        items: row.items,
        shippingAddress: row.shipping_address,
        billingAddress: row.billing_address,
        totalAmount: parseFloat(row.total_amount),
        currency: row.currency,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        estimatedDelivery: row.estimated_delivery,
        notes: row.notes
      }
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to get order' });
  }
}

// Create order
export async function createOrder(req, res) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { customerName, customerEmail, customerPhone, priority, shippingAddress, billingAddress, items, notes } = req.body;
    
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const totalAmount = items?.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) || 0;
    
    const orderResult = await client.query(
      `INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, 
                          priority, total_amount, shipping_address, billing_address, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'created') RETURNING *`,
      [orderNumber, customerName, customerEmail, customerPhone, priority || 'standard', 
       totalAmount, JSON.stringify(shippingAddress), JSON.stringify(billingAddress || shippingAddress), notes]
    );
    
    const order = orderResult.rows[0];
    
    // Insert order items
    if (items && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, sku, product_name, quantity, unit_price, weight)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [order.id, item.productId, item.sku, item.productName, item.quantity, item.unitPrice, item.weight || 0]
        );
      }
    }
    
    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { ...order, orderNumber: order.order_number }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
}

// Update order status
export async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    const result = await pool.query(
      `UPDATE orders SET status = $1, notes = COALESCE($2, notes), updated_at = NOW() 
       WHERE id = $3 RETURNING *`,
      [status, notes, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({ success: true, message: 'Order updated', data: result.rows[0] });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
}
