// Analytics Repository - thin BaseRepository wrapper giving analytics queries
// a proper domain boundary without duplicating complex SQL into the controller.
import BaseRepository from './BaseRepository.js';

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
    return this.query(`
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
    `, baseArgs);
  }

  async getShipmentsByCarrier({ intClause, orgClauseAlias, baseArgs }) {
    return this.query(`
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
    `, baseArgs);
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
    return this.query(`
      SELECT
        ${dateGrouping} as date,
        COUNT(*) as violations,
        COALESCE(SUM(penalty_amount), 0) as total_penalties
      FROM sla_violations
      WHERE created_at >= ${intClause}
      ${orgClause}
      GROUP BY ${dateGrouping}
      ORDER BY date ASC
    `, baseArgs);
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
    return this.query(`
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
      ${orgClause.replace('organization_id', 'o.organization_id')}
    `, baseArgs);
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
      LEFT JOIN sla_policies sp ON sv.policy_id = sp.id
      WHERE sv.violated_at >= NOW() - ${intIdx}::INTERVAL
      ${orgParam ? `AND sv.organization_id = $1` : ''}
      ORDER BY sv.violated_at DESC
    `, params);
  }
}

export default new AnalyticsRepository();
