// Analytics Controller - provides comprehensive analytics and reporting
import pool from '../config/db.js';

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

    const organizationId = req.user?.organizationId;

    // Build query param array: [interval, orgId?]
    // Using $N::INTERVAL avoids interpolating user-controlled strings into SQL (TASK-R8-016).
    // interval values are already whitelisted above, but parameterize for hygiene.
    const orgParam = organizationId ? 1 : null;   // index of orgId param when present
    const intParam = organizationId ? 2 : 1;       // index of interval param

    const baseArgs  = organizationId ? [organizationId, interval] : [interval];

    // Convenience helpers so each query below can reference the right param indices
    const orgClause = organizationId ? `AND organization_id = $${orgParam}` : '';
    const orgClauseAlias = (alias) => organizationId ? `AND ${alias}.organization_id = $${orgParam}` : '';
    const intClause = `NOW() - $${intParam}::INTERVAL`;

    // Run all 8 independent queries in parallel for ~6-8x latency improvement
    const [
      ordersOverTime,
      shipmentsByCarrier,
      topProducts,
      warehouseUtil,
      slaViolations,
      exceptionsByType,
      returnsAnalysis,
      financialMetrics,
    ] = await Promise.all([
      pool.query(`
        SELECT 
          ${dateGrouping} as date, 
          COUNT(*) as count, 
          COALESCE(SUM(total_amount), 0) as value,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
          COUNT(CASE WHEN status IN ('shipped','in_transit','out_for_delivery') THEN 1 END) as in_transit,
          COUNT(CASE WHEN status IN ('created','confirmed','allocated','processing') THEN 1 END) as pending
        FROM orders
        WHERE created_at >= ${intClause}
        ${orgClause}
        GROUP BY ${dateGrouping}
        ORDER BY date ASC
      `, baseArgs),

      pool.query(`
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
        WHERE s.created_at >= ${intClause}
        ${orgClauseAlias('s')}
        GROUP BY c.id, c.name
        ORDER BY total_shipments DESC
        LIMIT 10
      `, baseArgs),

      pool.query(`
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
        WHERE o.created_at >= ${intClause}
        ${orgClauseAlias('o')}
        GROUP BY p.id, p.name, p.sku, p.category
        ORDER BY revenue DESC
        LIMIT 10
      `, baseArgs),

      pool.query(`
        SELECT 
          w.name,
          w.code,
          w.capacity,
          COALESCE(SUM(i.available_quantity + i.reserved_quantity), 0) as current_stock,
          COUNT(DISTINCT s.id) as shipments_processed,
          COUNT(DISTINCT oi.order_id) as orders_fulfilled
        FROM warehouses w
        LEFT JOIN inventory i ON i.warehouse_id = w.id
        LEFT JOIN shipments s ON s.warehouse_id = w.id AND s.created_at >= ${intClause}
        LEFT JOIN order_items oi ON oi.warehouse_id = w.id
        LEFT JOIN orders o ON o.id = oi.order_id AND o.created_at >= ${intClause}
        WHERE w.is_active = true${organizationId ? ` AND w.organization_id = $${orgParam}` : ''}
        GROUP BY w.id, w.name, w.code, w.capacity
        ORDER BY w.name
      `, baseArgs),

      pool.query(`
        SELECT 
          ${dateGrouping} as date,
          COUNT(*) as violations,
          COALESCE(SUM(penalty_amount), 0) as total_penalties
        FROM sla_violations
        WHERE created_at >= ${intClause}
        ${orgClause}
        GROUP BY ${dateGrouping}
        ORDER BY date ASC
      `, baseArgs),

      pool.query(`
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
        WHERE created_at >= ${intClause}
        ${orgClause}
        GROUP BY exception_type, severity
        ORDER BY count DESC
      `, baseArgs),

      pool.query(`
        SELECT 
          COUNT(*) as total_returns,
          COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded,
          COALESCE(SUM(refund_amount), 0) as total_refund_amount,
          COALESCE(AVG(refund_amount), 0) as avg_refund_amount,
          COUNT(CASE WHEN quality_check_result = 'passed' THEN 1 END) as quality_passed,
          COUNT(CASE WHEN quality_check_result = 'failed' THEN 1 END) as quality_failed
        FROM returns
        WHERE requested_at >= ${intClause}
        ${orgClause}
      `, baseArgs),

      pool.query(`
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
        WHERE o.created_at >= ${intClause}
        ${orgClause}
      `, baseArgs),
    ]);

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

// ─── Analytics CSV Export ──────────────────────────────────────────────────
// GET /api/analytics/export?type=orders|shipments|returns|violations&range=day|week|month|year
// Returns a CSV file download scoped to the authenticated org.
export async function getAnalyticsExport(req, res) {
  try {
    const { type = 'orders', range = 'month' } = req.query;

    const VALID_TYPES = ['orders', 'shipments', 'returns', 'violations'];
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid export type. Must be one of: ${VALID_TYPES.join(', ')}` });
    }

    // Map range to interval (same whitelist as getAnalytics — no interpolation)
    const RANGE_MAP = { day: '1 day', week: '7 days', month: '30 days', year: '1 year' };
    const interval = RANGE_MAP[range] || '30 days';

    const organizationId = req.user?.organizationId;
    const params = organizationId ? [organizationId, interval] : [interval];
    const orgClause = organizationId ? 'AND organization_id = $1' : '';
    const intIdx   = organizationId ? '$2' : '$1';

    let rows = [];
    let columns = [];

    if (type === 'orders') {
      columns = ['order_number', 'customer_name', 'customer_email', 'status', 'total_amount', 'currency', 'created_at'];
      const result = await pool.query(`
        SELECT order_number, customer_name, customer_email, status,
               total_amount, currency, created_at
        FROM orders
        WHERE created_at >= NOW() - ${intIdx}::INTERVAL
        ${orgClause}
        ORDER BY created_at DESC
      `, params);
      rows = result.rows;

    } else if (type === 'shipments') {
      columns = ['id', 'tracking_number', 'carrier_name', 'status', 'shipping_cost', 'estimated_delivery', 'delivery_actual', 'created_at'];
      const result = await pool.query(`
        SELECT s.id, s.tracking_number, c.name AS carrier_name, s.status,
               s.shipping_cost, s.delivery_scheduled AS estimated_delivery,
               s.delivery_actual, s.created_at
        FROM shipments s
        LEFT JOIN carriers c ON s.carrier_id = c.id
        WHERE s.created_at >= NOW() - ${intIdx}::INTERVAL
        ${organizationId ? `AND s.organization_id = $1` : ''}
        ORDER BY s.created_at DESC
      `, params);
      rows = result.rows;

    } else if (type === 'returns') {
      columns = ['rma_number', 'customer_name', 'status', 'refund_amount', 'reason', 'requested_at'];
      const result = await pool.query(`
        SELECT rma_number, customer_name, status, refund_amount, reason, requested_at
        FROM returns
        WHERE requested_at >= NOW() - ${intIdx}::INTERVAL
        ${orgClause}
        ORDER BY requested_at DESC
      `, params);
      rows = result.rows;

    } else if (type === 'violations') {
      columns = ['id', 'shipment_id', 'policy_name', 'violation_type', 'penalty_amount', 'violated_at'];
      const result = await pool.query(`
        SELECT sv.id, sv.shipment_id, sp.name AS policy_name,
               sv.violation_type, sv.penalty_amount, sv.violated_at
        FROM sla_violations sv
        LEFT JOIN sla_policies sp ON sv.policy_id = sp.id
        WHERE sv.violated_at >= NOW() - ${intIdx}::INTERVAL
        ${organizationId ? `AND sv.organization_id = $1` : ''}
        ORDER BY sv.violated_at DESC
      `, params);
      rows = result.rows;
    }

    // Serialize to CSV
    const escapeCell = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      // Wrap in quotes if value contains comma, quote, or newline
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const csvLines = [
      columns.join(','),
      ...rows.map(row => columns.map(col => escapeCell(row[col])).join(','))
    ];
    const csv = csvLines.join('\r\n');

    const filename = `${type}-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);

  } catch (error) {
    console.error('Analytics export error:', error);
    res.status(500).json({ error: 'Failed to export analytics data' });
  }
}
