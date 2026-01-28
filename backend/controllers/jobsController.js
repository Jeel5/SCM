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
    const { range = 'month' } = req.query; // day, week, month, year
    
    // Map range to SQL interval
    let interval = '30 days';
    let dateGrouping = "DATE(created_at)";
    
    if (range === 'day') {
      interval = '1 day';
      dateGrouping = "DATE_TRUNC('hour', created_at)";
    } else if (range === 'week') {
      interval = '7 days';
      dateGrouping = "DATE(created_at)";
    } else if (range === 'year') {
      interval = '1 year';
      dateGrouping = "DATE_TRUNC('month', created_at)";
    }
    
    // Orders over time with status breakdown
    const ordersOverTime = await pool.query(`
      SELECT 
        ${dateGrouping} as date, 
        COUNT(*) as count, 
        COALESCE(SUM(total_amount), 0) as value,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN status IN ('shipped','in_transit','out_for_delivery') THEN 1 END) as in_transit,
        COUNT(CASE WHEN status IN ('created','confirmed','allocated','processing') THEN 1 END) as pending
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY ${dateGrouping}
      ORDER BY date ASC
    `);
    
    // Shipments by carrier with performance metrics
    const shipmentsByCarrier = await pool.query(`
      SELECT 
        c.name as carrier,
        c.id as carrier_id,
        COUNT(s.id) as total_shipments,
        COUNT(CASE WHEN s.status = 'delivered' THEN 1 END) as delivered,
        AVG(CASE 
          WHEN s.delivery_actual IS NOT NULL AND s.delivery_scheduled IS NOT NULL
          THEN EXTRACT(EPOCH FROM (s.delivery_actual - s.delivery_scheduled))/3600
        END) as avg_delay_hours,
        COUNT(CASE 
          WHEN s.delivery_actual IS NOT NULL 
          AND s.delivery_scheduled IS NOT NULL
          AND s.delivery_actual <= s.delivery_scheduled
          THEN 1 
        END) as on_time_deliveries,
        COALESCE(SUM(s.shipping_cost), 0) as total_cost
      FROM shipments s
      JOIN carriers c ON s.carrier_id = c.id
      WHERE s.created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY c.id, c.name
      ORDER BY total_shipments DESC
      LIMIT 10
    `);
    
    // Top products by revenue and units
    const topProducts = await pool.query(`
      SELECT 
        p.name,
        p.sku,
        p.category,
        SUM(oi.quantity) as units_sold, 
        SUM(oi.quantity * oi.unit_price) as revenue,
        COUNT(DISTINCT oi.order_id) as order_count
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY p.id, p.name, p.sku, p.category
      ORDER BY revenue DESC
      LIMIT 10
    `);
    
    // Warehouse utilization and activity
    const warehouseUtil = await pool.query(`
      SELECT 
        w.name,
        w.code,
        w.capacity,
        COALESCE(SUM(i.available_quantity + i.reserved_quantity), 0) as current_stock,
        COUNT(DISTINCT s.id) as shipments_processed,
        COUNT(DISTINCT o.id) as orders_fulfilled
      FROM warehouses w
      LEFT JOIN inventory i ON i.warehouse_id = w.id
      LEFT JOIN shipments s ON s.warehouse_id = w.id AND s.created_at >= NOW() - INTERVAL '${interval}'
      LEFT JOIN orders o ON o.warehouse_id = w.id AND o.created_at >= NOW() - INTERVAL '${interval}'
      WHERE w.is_active = true
      GROUP BY w.id, w.name, w.code, w.capacity
      ORDER BY w.name
    `);
    
    // SLA violations over time
    const slaViolations = await pool.query(`
      SELECT 
        ${dateGrouping} as date,
        COUNT(*) as violations,
        COALESCE(SUM(penalty_amount), 0) as total_penalties
      FROM sla_violations
      WHERE created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY ${dateGrouping}
      ORDER BY date ASC
    `);
    
    // Exception trends by type
    const exceptionsByType = await pool.query(`
      SELECT 
        exception_type,
        severity,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
        AVG(CASE 
          WHEN resolved_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 
        END) as avg_resolution_hours
      FROM exceptions
      WHERE created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY exception_type, severity
      ORDER BY count DESC
    `);
    
    // Returns analysis
    const returnsAnalysis = await pool.query(`
      SELECT 
        COUNT(*) as total_returns,
        COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded,
        COALESCE(SUM(refund_amount), 0) as total_refund_amount,
        COALESCE(AVG(refund_amount), 0) as avg_refund_amount,
        COUNT(CASE WHEN quality_check_result = 'passed' THEN 1 END) as quality_passed,
        COUNT(CASE WHEN quality_check_result = 'failed' THEN 1 END) as quality_failed
      FROM returns
      WHERE requested_at >= NOW() - INTERVAL '${interval}'
    `);
    
    // Revenue and cost analysis
    const financialMetrics = await pool.query(`
      SELECT 
        COALESCE(SUM(o.total_amount), 0) as total_revenue,
        COALESCE(SUM(s.shipping_cost), 0) as total_shipping_cost,
        COALESCE(SUM(sv.penalty_amount), 0) as total_penalties,
        COALESCE(SUM(r.refund_amount), 0) as total_refunds,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(AVG(o.total_amount), 0) as avg_order_value
      FROM orders o
      LEFT JOIN shipments s ON s.order_id = o.id
      LEFT JOIN sla_violations sv ON sv.shipment_id = s.id
      LEFT JOIN returns r ON r.order_id = o.id AND r.status = 'refunded'
      WHERE o.created_at >= NOW() - INTERVAL '${interval}'
    `);
    
    // Calculate derived metrics
    const shipmentsByCarrierFormatted = shipmentsByCarrier.rows.map(r => {
      const delivered = parseInt(r.delivered);
      const total = parseInt(r.total_shipments);
      const onTime = parseInt(r.on_time_deliveries);
      
      return {
        carrier: r.carrier,
        carrierId: r.carrier_id,
        totalShipments: total,
        delivered: delivered,
        onTimeRate: delivered > 0 ? ((onTime / delivered) * 100).toFixed(1) : '100.0',
        avgDelayHours: r.avg_delay_hours ? parseFloat(r.avg_delay_hours).toFixed(1) : '0.0',
        totalCost: parseFloat(r.total_cost)
      };
    });
    
    res.json({
      success: true,
      data: {
        timeRange: range,
        ordersOverTime: ordersOverTime.rows.map(r => ({
          date: r.date,
          count: parseInt(r.count),
          value: parseFloat(r.value),
          delivered: parseInt(r.delivered),
          inTransit: parseInt(r.in_transit),
          pending: parseInt(r.pending)
        })),
        shipmentsByCarrier: shipmentsByCarrierFormatted,
        topProducts: topProducts.rows.map(r => ({
          name: r.name,
          sku: r.sku,
          category: r.category,
          unitsSold: parseInt(r.units_sold),
          revenue: parseFloat(r.revenue),
          orderCount: parseInt(r.order_count)
        })),
        warehouseUtilization: warehouseUtil.rows.map(r => ({
          name: r.name,
          code: r.code,
          capacity: r.capacity,
          currentStock: parseInt(r.current_stock),
          utilization: r.capacity > 0 ? Math.round((parseInt(r.current_stock) / r.capacity) * 100) : 0,
          shipmentsProcessed: parseInt(r.shipments_processed),
          ordersFulfilled: parseInt(r.orders_fulfilled)
        })),
        slaViolations: slaViolations.rows.map(r => ({
          date: r.date,
          violations: parseInt(r.violations),
          totalPenalties: parseFloat(r.total_penalties)
        })),
        exceptionsByType: exceptionsByType.rows.map(r => ({
          type: r.exception_type,
          severity: r.severity,
          count: parseInt(r.count),
          resolved: parseInt(r.resolved),
          avgResolutionHours: r.avg_resolution_hours ? parseFloat(r.avg_resolution_hours).toFixed(1) : null
        })),
        returnsAnalysis: {
          totalReturns: parseInt(returnsAnalysis.rows[0].total_returns),
          refunded: parseInt(returnsAnalysis.rows[0].refunded),
          totalRefundAmount: parseFloat(returnsAnalysis.rows[0].total_refund_amount),
          avgRefundAmount: parseFloat(returnsAnalysis.rows[0].avg_refund_amount),
          qualityPassed: parseInt(returnsAnalysis.rows[0].quality_passed),
          qualityFailed: parseInt(returnsAnalysis.rows[0].quality_failed)
        },
        financialMetrics: {
          totalRevenue: parseFloat(financialMetrics.rows[0].total_revenue),
          totalShippingCost: parseFloat(financialMetrics.rows[0].total_shipping_cost),
          totalPenalties: parseFloat(financialMetrics.rows[0].total_penalties),
          totalRefunds: parseFloat(financialMetrics.rows[0].total_refunds),
          totalOrders: parseInt(financialMetrics.rows[0].total_orders),
          avgOrderValue: parseFloat(financialMetrics.rows[0].avg_order_value)
        }
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
}
