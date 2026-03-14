// Analytics Repository - thin BaseRepository wrapper giving analytics queries
// a proper domain boundary without duplicating complex SQL into the controller.
import BaseRepository from './BaseRepository.js';

function toDateString(value) {
  return value.toISOString().slice(0, 10);
}

function getRangeWindow(range) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);

  const days = range === 'day' ? 1 : range === 'week' ? 7 : range === 'year' ? 365 : 30;
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(days - 1, 0));

  return {
    startDate: toDateString(start),
    endDate: toDateString(end),
  };
}

function resolveRangeFromArgs(baseArgs) {
  const interval = baseArgs[baseArgs.length - 1];
  if (interval === '1 day') return 'day';
  if (interval === '7 days') return 'week';
  if (interval === '1 year') return 'year';
  return 'month';
}

function buildBucketExpression(range) {
  if (range === 'year') {
    return "DATE_TRUNC('month', stat_date)::date";
  }
  if (range === 'month') {
    return "DATE_TRUNC('week', stat_date)::date";
  }
  return 'stat_date';
}

class AnalyticsRepository extends BaseRepository {
  constructor() {
    // 'orders' is the primary analytics table; query() works for any SQL.
    super('orders');
  }

  /**
   * All analytics methods accept:
   *   - baseArgs: [orgId?, interval] or [interval] depending on org context
   *   - orgClause: ' AND organization_id = $N' or ''
   *   - orgClauseAlias: fn(alias) => ' AND alias.org... = $N' or ''
   *   - intClause: 'NOW() - $N::INTERVAL'
   *   - dateGrouping: SQL date truncation expression (whitelisted by caller)
   *
   * These are safe because all dynamic SQL fragments are whitelisted
   * in the controller before being passed here.
   */

  async getOrdersOverTime({ dateGrouping, intClause, orgClause, baseArgs }) {
    const organizationId = baseArgs.length > 1 ? baseArgs[0] : null;
    const range = resolveRangeFromArgs(baseArgs);
    const bucket = buildBucketExpression(range);
    const { startDate, endDate } = getRangeWindow(range);
    return this.query(`
      SELECT
        ${bucket} as date,
        COALESCE(SUM(orders_total), 0) as count,
        COALESCE(SUM(orders_value), 0) as value,
        COALESCE(SUM(orders_delivered), 0) as delivered,
        COALESCE(SUM(shipments_in_transit + shipments_out_for_delivery), 0) as in_transit,
        COALESCE(SUM(orders_pending + orders_processing), 0) as pending
      FROM analytics_daily_stats
      WHERE organization_id = $1
        AND stat_date BETWEEN $2::date AND $3::date
      GROUP BY 1
      ORDER BY date ASC
    `, [organizationId, startDate, endDate]);
  }

  async getShipmentsByCarrier({ intClause, orgClauseAlias, baseArgs }) {
    const organizationId = baseArgs.length > 1 ? baseArgs[0] : null;
    const range = baseArgs[baseArgs.length - 1] === '1 year' ? 'year' : baseArgs[baseArgs.length - 1] === '7 days' ? 'week' : baseArgs[baseArgs.length - 1] === '1 day' ? 'day' : 'month';
    const { startDate, endDate } = getRangeWindow(range);
    return this.query(`
      SELECT
        c.name as carrier,
        c.id as carrier_id,
        COALESCE(SUM(a.total_shipments), 0) as total_shipments,
        COALESCE(SUM(a.delivered_shipments), 0) as delivered,
        COALESCE(AVG(a.avg_delay_hours) FILTER (WHERE a.total_shipments > 0), 0) as avg_delay_hours,
        COALESCE(SUM(a.on_time_deliveries), 0) as on_time_deliveries,
        COALESCE(SUM(a.total_cost), 0) as total_cost
      FROM analytics_daily_carrier_stats a
      JOIN carriers c ON a.carrier_id = c.id
      WHERE a.organization_id = $1
        AND a.stat_date BETWEEN $2::date AND $3::date
      GROUP BY c.id, c.name
      ORDER BY total_shipments DESC
      LIMIT 10
    `, [organizationId, startDate, endDate]);
  }

  async getTopProducts({ intClause, orgClauseAlias, baseArgs }) {
    return this.query(`
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
    `, baseArgs);
  }

  async getWarehouseUtilization({ intClause, orgParam, baseArgs }) {
    return this.query(`
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
      WHERE w.is_active = true${orgParam ? ` AND w.organization_id = $${orgParam}` : ''}
      GROUP BY w.id, w.name, w.code, w.capacity
      ORDER BY w.name
    `, baseArgs);
  }

  async getSlaViolations({ dateGrouping, intClause, orgClause, baseArgs }) {
    const organizationId = baseArgs.length > 1 ? baseArgs[0] : null;
    const range = resolveRangeFromArgs(baseArgs);
    const bucket = buildBucketExpression(range);
    const { startDate, endDate } = getRangeWindow(range);
    return this.query(`
      SELECT
        ${bucket} as date,
        COALESCE(SUM(sla_violations), 0) as violations,
        COALESCE(SUM(penalties_total), 0) as total_penalties
      FROM analytics_daily_stats
      WHERE organization_id = $1
        AND stat_date BETWEEN $2::date AND $3::date
      GROUP BY 1
      ORDER BY date ASC
    `, [organizationId, startDate, endDate]);
  }

  async getExceptionsByType({ intClause, orgClause, baseArgs }) {
    return this.query(`
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
    `, baseArgs);
  }

  async getReturnsAnalysis({ intClause, orgClause, baseArgs }) {
    return this.query(`
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
    `, baseArgs);
  }

  async getFinancialMetrics({ intClause, orgClause, baseArgs }) {
    const organizationId = baseArgs.length > 1 ? baseArgs[0] : null;
    const range = resolveRangeFromArgs(baseArgs);
    const { startDate, endDate } = getRangeWindow(range);
    return this.query(`
      SELECT
        COALESCE(SUM(orders_value), 0) as total_revenue,
        COALESCE(SUM(shipping_cost_total), 0) as total_shipping_cost,
        COALESCE(SUM(penalties_total), 0) as total_penalties,
        COALESCE(SUM(refund_amount), 0) as total_refunds,
        COALESCE(SUM(orders_total), 0) as total_orders,
        COALESCE(SUM(orders_value) / NULLIF(SUM(orders_total), 0), 0) as avg_order_value
      FROM analytics_daily_stats
      WHERE organization_id = $1
        AND stat_date BETWEEN $2::date AND $3::date
    `, [organizationId, startDate, endDate]);
  }

  // ── CSV export queries ─────────────────────────────────────────────────

  async exportOrders({ intIdx, orgClause, params }) {
    return this.query(`
      SELECT order_number, customer_name, customer_email, status,
             total_amount, currency, created_at
      FROM orders
      WHERE created_at >= NOW() - ${intIdx}::INTERVAL
      ${orgClause}
      ORDER BY created_at DESC
    `, params);
  }

  async exportShipments({ intIdx, orgParam, params }) {
    return this.query(`
      SELECT s.id, s.tracking_number, c.name AS carrier_name, s.status,
             s.shipping_cost, s.delivery_scheduled AS estimated_delivery,
             s.delivery_actual, s.created_at
      FROM shipments s
      LEFT JOIN carriers c ON s.carrier_id = c.id
      WHERE s.created_at >= NOW() - ${intIdx}::INTERVAL
      ${orgParam ? `AND s.organization_id = $1` : ''}
      ORDER BY s.created_at DESC
    `, params);
  }

  async exportReturns({ intIdx, orgClause, params }) {
    return this.query(`
      SELECT rma_number, customer_name, status, refund_amount, reason, requested_at
      FROM returns
      WHERE requested_at >= NOW() - ${intIdx}::INTERVAL
      ${orgClause}
      ORDER BY requested_at DESC
    `, params);
  }

  async exportViolations({ intIdx, orgParam, params }) {
    return this.query(`
      SELECT sv.id, sv.shipment_id, sp.name AS policy_name,
             sv.violation_type, sv.penalty_amount, sv.violated_at
      FROM sla_violations sv
      LEFT JOIN sla_policies sp ON sv.sla_policy_id = sp.id
      WHERE sv.violated_at >= NOW() - ${intIdx}::INTERVAL
      ${orgParam ? `AND sv.organization_id = $1` : ''}
      ORDER BY sv.violated_at DESC
    `, params);
  }
}

export default new AnalyticsRepository();
