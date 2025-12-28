import pool from '../configs/db.js';

export async function listJobs(req, res) {
  try {
    const { page = 1, limit = 20, status, jobType } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM jobs WHERE 1=1';
    const params = [];
    
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    if (jobType) {
      params.push(jobType);
      query += ` AND job_type = $${params.length}`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await pool.query(query, params);
    
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM jobs WHERE 1=1' + 
      (status ? ' AND status = $1' : '') +
      (jobType ? ` AND job_type = $${status ? '2' : '1'}` : ''),
      [status, jobType].filter(Boolean)
    );
    
    res.json({
      success: true,
      data: result.rows.map(j => ({
        id: j.id,
        jobType: j.job_type,
        status: j.status,
        priority: j.priority,
        payload: j.payload,
        result: j.result,
        error: j.error,
        attempts: j.attempts,
        maxAttempts: j.max_attempts,
        scheduledAt: j.scheduled_at,
        startedAt: j.started_at,
        completedAt: j.completed_at,
        createdAt: j.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count)
      }
    });
  } catch (error) {
    console.error('List jobs error:', error);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
}

export async function getJob(req, res) {
  try {
    const { id } = req.params;
    
    const result = await pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const j = result.rows[0];
    res.json({
      success: true,
      data: {
        id: j.id,
        jobType: j.job_type,
        status: j.status,
        priority: j.priority,
        payload: j.payload,
        result: j.result,
        error: j.error,
        attempts: j.attempts,
        maxAttempts: j.max_attempts,
        scheduledAt: j.scheduled_at,
        startedAt: j.started_at,
        completedAt: j.completed_at,
        createdAt: j.created_at
      }
    });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Failed to get job' });
  }
}

export async function createJob(req, res) {
  try {
    const { jobType, priority = 'normal', payload, scheduledAt } = req.body;
    
    const result = await pool.query(
      `INSERT INTO jobs (job_type, priority, payload, scheduled_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [jobType, priority, JSON.stringify(payload), scheduledAt || null]
    );
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
}

export async function cancelJob(req, res) {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE jobs SET status = 'cancelled' WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found or cannot be cancelled' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Cancel job error:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
}

export async function retryJob(req, res) {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE jobs SET status = 'pending', attempts = 0, error = NULL 
       WHERE id = $1 AND status = 'failed' RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found or cannot be retried' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Retry job error:', error);
    res.status(500).json({ error: 'Failed to retry job' });
  }
}

export async function getJobStats(req, res) {
  try {
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
      FROM jobs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);
    
    const byTypeResult = await pool.query(`
      SELECT job_type, COUNT(*) as count
      FROM jobs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY job_type
    `);
    
    const stats = statsResult.rows[0];
    
    res.json({
      success: true,
      data: {
        total: parseInt(stats.total_jobs),
        byStatus: {
          pending: parseInt(stats.pending),
          processing: parseInt(stats.processing),
          completed: parseInt(stats.completed),
          failed: parseInt(stats.failed),
          cancelled: parseInt(stats.cancelled)
        },
        byType: byTypeResult.rows.map(t => ({
          type: t.job_type,
          count: parseInt(t.count)
        }))
      }
    });
  } catch (error) {
    console.error('Get job stats error:', error);
    res.status(500).json({ error: 'Failed to get job stats' });
  }
}

// Dashboard / Analytics
export async function getDashboardStats(req, res) {
  try {
    // Orders stats
    const ordersResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status IN ('created','confirmed') THEN 1 END) as pending,
        COUNT(CASE WHEN status IN ('allocated','processing') THEN 1 END) as processing,
        COUNT(CASE WHEN status IN ('shipped','in_transit','out_for_delivery') THEN 1 END) as shipped,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
        COALESCE(SUM(total_amount), 0) as total_value
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);
    
    // Shipments stats
    const shipmentsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN s.status IN ('picked_up','in_transit','at_hub','out_for_delivery') THEN 1 END) as in_transit,
        COUNT(CASE WHEN s.status = 'delivered' THEN 1 END) as delivered,
        COUNT(
          CASE 
            WHEN o.actual_delivery IS NOT NULL 
             AND o.estimated_delivery IS NOT NULL
             AND o.actual_delivery <= o.estimated_delivery
            THEN 1 
          END
        ) as on_time
      FROM shipments s
      LEFT JOIN orders o ON o.id = s.order_id
      WHERE s.created_at >= NOW() - INTERVAL '30 days'
    `);
    
    // Inventory alerts
    const inventoryResult = await pool.query(`
      SELECT COUNT(*) as low_stock
      FROM inventory
      WHERE available_quantity <= 5
    `);
    
    // Returns stats
    const returnsResult = await pool.query(`
      SELECT COUNT(*) as pending_returns
      FROM returns
      WHERE status IN ('pending', 'approved', 'processing')
    `);
    
    // Exceptions
    const exceptionsResult = await pool.query(`
      SELECT COUNT(*) as active_exceptions
      FROM exceptions
      WHERE status = 'open'
    `);
    
    const orders = ordersResult.rows[0];
    const shipments = shipmentsResult.rows[0];
    
    const onTimeRate = parseInt(shipments.delivered) > 0
      ? (parseInt(shipments.on_time) / parseInt(shipments.delivered) * 100).toFixed(1)
      : 100;
    
    res.json({
      success: true,
      data: {
        orders: {
          total: parseInt(orders.total),
          pending: parseInt(orders.pending),
          processing: parseInt(orders.processing),
          shipped: parseInt(orders.shipped),
          delivered: parseInt(orders.delivered),
          totalValue: parseFloat(orders.total_value)
        },
        shipments: {
          total: parseInt(shipments.total),
          inTransit: parseInt(shipments.in_transit),
          delivered: parseInt(shipments.delivered),
          onTimeRate: parseFloat(onTimeRate)
        },
        inventory: {
          lowStockAlerts: parseInt(inventoryResult.rows[0].low_stock)
        },
        returns: {
          pending: parseInt(returnsResult.rows[0].pending_returns)
        },
        exceptions: {
          active: parseInt(exceptionsResult.rows[0].active_exceptions)
        }
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
}

export async function getAnalytics(req, res) {
  try {
    const { period = '30d' } = req.query;
    
    let interval = '30 days';
    if (period === '7d') interval = '7 days';
    else if (period === '90d') interval = '90 days';
    
    // Orders over time
    const ordersOverTime = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as value
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    
    // Shipments by carrier
    const shipmentsByCarrier = await pool.query(`
      SELECT c.name as carrier, COUNT(s.id) as count
      FROM shipments s
      JOIN carriers c ON s.carrier_id = c.id
      WHERE s.created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY c.id, c.name
      ORDER BY count DESC
      LIMIT 5
    `);
    
    // Top products
    const topProducts = await pool.query(`
      SELECT p.name, SUM(oi.quantity) as units_sold, SUM(oi.quantity * oi.unit_price) as revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY p.id, p.name
      ORDER BY revenue DESC
      LIMIT 10
    `);
    
    // Warehouse utilization
    const warehouseUtil = await pool.query(`
      SELECT w.name, w.capacity, COALESCE(SUM(i.available_quantity + i.reserved_quantity), 0) as current_stock
      FROM warehouses w
      LEFT JOIN inventory i ON i.warehouse_id = w.id
      WHERE w.is_active = true
      GROUP BY w.id, w.name, w.capacity
    `);
    
    res.json({
      success: true,
      data: {
        ordersOverTime: ordersOverTime.rows.map(r => ({
          date: r.date,
          count: parseInt(r.count),
          value: parseFloat(r.value)
        })),
        shipmentsByCarrier: shipmentsByCarrier.rows.map(r => ({
          carrier: r.carrier,
          count: parseInt(r.count)
        })),
        topProducts: topProducts.rows.map(r => ({
          name: r.name,
          unitsSold: parseInt(r.units_sold),
          revenue: parseFloat(r.revenue)
        })),
        warehouseUtilization: warehouseUtil.rows.map(r => ({
          name: r.name,
          capacity: r.capacity,
          currentStock: parseInt(r.current_stock),
          utilization: r.capacity > 0 ? Math.round((parseInt(r.current_stock) / r.capacity) * 100) : 0
        }))
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
}
