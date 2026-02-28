// Dashboard Repository - thin BaseRepository wrapper giving dashboard queries
// a proper domain boundary without duplicating complex SQL into the controller.
import BaseRepository from './BaseRepository.js';

class DashboardRepository extends BaseRepository {
  constructor() {
    super('orders');
  }

  // --- internal helpers ---
  /** Build parameterised args [orgId?, intervalString] and return {orgClause, args, intIdx} */
  _buildParams(organizationId, days, alias = '') {
    const prefix = alias ? `${alias}.` : '';
    if (organizationId) {
      return {
        orgClause: ` AND ${prefix}organization_id = $1`,
        args: [organizationId, `${days} days`],
        intIdx: 2,
      };
    }
    return { orgClause: '', args: [`${days} days`], intIdx: 1 };
  }

  /**
   * Aggregate order counts and total value for the given period.
   * Also returns the previous-period totals so the controller can compute % change.
   */
  async getOrderStats(organizationId = null, days = 30, client = null) {
    const { orgClause, args, intIdx } = this._buildParams(organizationId, days);
    const result = await this.query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= NOW() - $${intIdx}::INTERVAL)                                                   AS total,
         COUNT(*) FILTER (WHERE created_at >= NOW() - $${intIdx}::INTERVAL AND status IN ('created','confirmed'))              AS pending,
         COUNT(*) FILTER (WHERE created_at >= NOW() - $${intIdx}::INTERVAL AND status IN ('allocated','processing'))           AS processing,
         COUNT(*) FILTER (WHERE created_at >= NOW() - $${intIdx}::INTERVAL AND status IN ('shipped','in_transit','out_for_delivery')) AS shipped,
         COUNT(*) FILTER (WHERE created_at >= NOW() - $${intIdx}::INTERVAL AND status = 'delivered')                           AS delivered,
         COUNT(*) FILTER (WHERE created_at >= NOW() - $${intIdx}::INTERVAL AND status IN ('cancelled'))                        AS cancelled,
         COUNT(*) FILTER (WHERE created_at >= NOW() - $${intIdx}::INTERVAL AND status IN ('returned'))                         AS returned,
         COALESCE(SUM(total_amount) FILTER (WHERE created_at >= NOW() - $${intIdx}::INTERVAL), 0)                              AS total_value,
         -- previous period
         COUNT(*) FILTER (WHERE created_at >= NOW() - ($${intIdx}::INTERVAL * 2) AND created_at < NOW() - $${intIdx}::INTERVAL) AS prev_total,
         COALESCE(SUM(total_amount) FILTER (WHERE created_at >= NOW() - ($${intIdx}::INTERVAL * 2) AND created_at < NOW() - $${intIdx}::INTERVAL), 0) AS prev_total_value
       FROM orders
       WHERE created_at >= NOW() - ($${intIdx}::INTERVAL * 2)${orgClause}`,
      args, client
    );
    return result.rows[0];
  }

  /**
   * Aggregate shipment counts, on-time delivery stats and avg delivery time.
   * Includes previous period for % change.
   */
  async getShipmentStats(organizationId = null, days = 30, client = null) {
    const { orgClause, args, intIdx } = this._buildParams(organizationId, days, 's');
    const result = await this.query(
      `SELECT
         COUNT(*) FILTER (WHERE s.created_at >= NOW() - $${intIdx}::INTERVAL) AS total,
         COUNT(*) FILTER (WHERE s.created_at >= NOW() - $${intIdx}::INTERVAL AND s.status IN ('picked_up','in_transit','at_hub','out_for_delivery')) AS in_transit,
         COUNT(*) FILTER (WHERE s.created_at >= NOW() - $${intIdx}::INTERVAL AND s.status = 'delivered') AS delivered,
         COUNT(*) FILTER (WHERE s.created_at >= NOW() - $${intIdx}::INTERVAL
           AND o.actual_delivery IS NOT NULL AND o.estimated_delivery IS NOT NULL
           AND o.actual_delivery <= o.estimated_delivery) AS on_time,
         -- avg delivery time in days (only for delivered shipments in current period)
         COALESCE(
           AVG(EXTRACT(EPOCH FROM (o.actual_delivery - s.created_at)) / 86400)
             FILTER (WHERE s.created_at >= NOW() - $${intIdx}::INTERVAL AND s.status = 'delivered' AND o.actual_delivery IS NOT NULL),
           0
         ) AS avg_delivery_days,
         -- previous period
         COUNT(*) FILTER (WHERE s.created_at >= NOW() - ($${intIdx}::INTERVAL * 2) AND s.created_at < NOW() - $${intIdx}::INTERVAL) AS prev_total,
         COUNT(*) FILTER (WHERE s.created_at >= NOW() - ($${intIdx}::INTERVAL * 2) AND s.created_at < NOW() - $${intIdx}::INTERVAL AND s.status = 'delivered') AS prev_delivered,
         COUNT(*) FILTER (WHERE s.created_at >= NOW() - ($${intIdx}::INTERVAL * 2) AND s.created_at < NOW() - $${intIdx}::INTERVAL
           AND o.actual_delivery IS NOT NULL AND o.estimated_delivery IS NOT NULL
           AND o.actual_delivery <= o.estimated_delivery) AS prev_on_time,
         COALESCE(
           AVG(EXTRACT(EPOCH FROM (o.actual_delivery - s.created_at)) / 86400)
             FILTER (WHERE s.created_at >= NOW() - ($${intIdx}::INTERVAL * 2) AND s.created_at < NOW() - $${intIdx}::INTERVAL AND s.status = 'delivered' AND o.actual_delivery IS NOT NULL),
           0
         ) AS prev_avg_delivery_days
       FROM shipments s
       LEFT JOIN orders o ON o.id = s.order_id
       WHERE s.created_at >= NOW() - ($${intIdx}::INTERVAL * 2)${orgClause}`,
      args, client
    );
    return result.rows[0];
  }

  /**
   * Count low-stock inventory items (available_quantity <= 5).
   */
  async getLowStockCount(organizationId = null, _days = 30, client = null) {
    const orgClause = organizationId ? ' AND organization_id = $1' : '';
    const orgArgs   = organizationId ? [organizationId] : [];
    const result = await this.query(
      `SELECT COUNT(*) AS low_stock
       FROM inventory
       WHERE available_quantity <= 5${orgClause}`,
      orgArgs, client
    );
    return parseInt(result.rows[0].low_stock);
  }

  /**
   * Count pending returns (status in pending / approved / processing) + previous period.
   */
  async getPendingReturnsCount(organizationId = null, days = 30, client = null) {
    const { orgClause, args, intIdx } = this._buildParams(organizationId, days);
    const result = await this.query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= NOW() - $${intIdx}::INTERVAL) AS pending_returns,
         COUNT(*) FILTER (WHERE created_at >= NOW() - ($${intIdx}::INTERVAL * 2) AND created_at < NOW() - $${intIdx}::INTERVAL) AS prev_pending_returns
       FROM returns
       WHERE status IN ('pending', 'approved', 'processing')
         AND created_at >= NOW() - ($${intIdx}::INTERVAL * 2)${orgClause}`,
      args, client
    );
    return result.rows[0];
  }

  /**
   * Count active (open) exceptions + previous-period created count.
   */
  async getActiveExceptionsCount(organizationId = null, days = 30, client = null) {
    const { orgClause, args, intIdx } = this._buildParams(organizationId, days);
    const result = await this.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'open') AS active_exceptions,
         COUNT(*) FILTER (WHERE created_at >= NOW() - $${intIdx}::INTERVAL) AS current_created,
         COUNT(*) FILTER (WHERE created_at >= NOW() - ($${intIdx}::INTERVAL * 2) AND created_at < NOW() - $${intIdx}::INTERVAL) AS prev_created
       FROM exceptions
       WHERE (status = 'open' OR created_at >= NOW() - ($${intIdx}::INTERVAL * 2))${orgClause}`,
      args, client
    );
    return result.rows[0];
  }

  /**
   * Daily / hourly order volume for trend chart, scoped to the selected period.
   */
  async getOrdersTrend(organizationId = null, days = 30, client = null) {
    const { orgClause, args, intIdx } = this._buildParams(organizationId, days);
    // For 1-day use hourly buckets, for <=7 use daily, for >7 use daily as well
    const bucket = days <= 1 ? "DATE_TRUNC('hour', created_at)" : "DATE(created_at)";
    const result = await this.query(
      `SELECT ${bucket} AS date, COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS value
       FROM orders
       WHERE created_at >= NOW() - $${intIdx}::INTERVAL${orgClause}
       GROUP BY 1 ORDER BY 1`,
      args, client
    );
    return result.rows;
  }

  /**
   * Revenue trend over the selected period — daily or monthly buckets.
   */
  async getRevenueTrend(organizationId = null, days = 30, client = null) {
    const { orgClause, args, intIdx } = this._buildParams(organizationId, days);
    const bucket = days > 90 ? "DATE_TRUNC('month', created_at)" : "DATE(created_at)";
    const result = await this.query(
      `SELECT ${bucket} AS date,
         COALESCE(SUM(total_amount), 0) AS revenue,
         COUNT(*) AS orders
       FROM orders
       WHERE created_at >= NOW() - $${intIdx}::INTERVAL AND status != 'cancelled'${orgClause}
       GROUP BY 1 ORDER BY 1`,
      args, client
    );
    return result.rows;
  }

  /**
   * Top 5 products by units sold in the period.
   */
  async getTopProducts(organizationId = null, days = 30, client = null) {
    const { orgClause, args, intIdx } = this._buildParams(organizationId, days, 'o');
    const result = await this.query(
      `SELECT oi.product_name AS name, oi.sku,
         SUM(oi.quantity) AS units_sold,
         SUM(oi.quantity * oi.unit_price) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.created_at >= NOW() - $${intIdx}::INTERVAL${orgClause}
       GROUP BY oi.product_name, oi.sku
       ORDER BY units_sold DESC
       LIMIT 5`,
      args, client
    );
    return result.rows;
  }

  /**
   * Per-warehouse inbound / outbound counts from stock_movements within the period.
   * Falls back to shipment-based counts if stock_movements is empty.
   */
  async getWarehouseActivity(organizationId = null, days = 30, client = null) {
    // stock_movements has no organization_id — filter through warehouses table
    const { orgClause, args, intIdx } = this._buildParams(organizationId, days, 'w');
    const result = await this.query(
      `SELECT
         sm.warehouse_id,
         w.name AS warehouse_name,
         COUNT(*) FILTER (WHERE sm.movement_type IN ('inbound','transfer_in','add'))  AS inbound_count,
         COUNT(*) FILTER (WHERE sm.movement_type IN ('outbound','transfer_out','remove')) AS outbound_count,
         COALESCE(SUM(sm.quantity) FILTER (WHERE sm.movement_type IN ('inbound','transfer_in','add')),  0) AS inbound_units,
         COALESCE(SUM(sm.quantity) FILTER (WHERE sm.movement_type IN ('outbound','transfer_out','remove')), 0) AS outbound_units
       FROM stock_movements sm
       JOIN warehouses w ON w.id = sm.warehouse_id
       WHERE sm.created_at >= NOW() - $${intIdx}::INTERVAL${orgClause}
       GROUP BY sm.warehouse_id, w.name`,
      args, client
    );
    return result.rows;
  }
}

export default new DashboardRepository();
