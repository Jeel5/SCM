// Analytics Controller - provides comprehensive analytics and reporting
import pool from '../configs/db.js';

// Get analytics data with time-series trends and breakdowns
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
        COUNT(DISTINCT oi.order_id) as orders_fulfilled
      FROM warehouses w
      LEFT JOIN inventory i ON i.warehouse_id = w.id
      LEFT JOIN shipments s ON s.warehouse_id = w.id AND s.created_at >= NOW() - INTERVAL '${interval}'
      LEFT JOIN order_items oi ON oi.warehouse_id = w.id
      LEFT JOIN orders o ON o.id = oi.order_id AND o.created_at >= NOW() - INTERVAL '${interval}'
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
