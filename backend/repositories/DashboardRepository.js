// Dashboard Repository - thin BaseRepository wrapper giving dashboard queries
// a proper domain boundary without duplicating complex SQL into the controller.
import BaseRepository from './BaseRepository.js';

function toDateString(value) {
  return value.toISOString().slice(0, 10);
}

function getDateWindow(days) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);

  const currentStart = new Date(end);
  currentStart.setUTCDate(currentStart.getUTCDate() - Math.max(days - 1, 0));

  const prevEnd = new Date(currentStart);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);

  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - Math.max(days - 1, 0));

  return {
    currentStart: toDateString(currentStart),
    currentEnd: toDateString(end),
    prevStart: toDateString(prevStart),
    prevEnd: toDateString(prevEnd),
  };
}

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
    const { currentStart, currentEnd, prevStart, prevEnd } = getDateWindow(days);
    const result = await this.query(
      `SELECT
         COALESCE(SUM(orders_total) FILTER (WHERE stat_date BETWEEN $2::date AND $3::date), 0) AS total,
         COALESCE(SUM(orders_pending) FILTER (WHERE stat_date BETWEEN $2::date AND $3::date), 0) AS pending,
         COALESCE(SUM(orders_processing) FILTER (WHERE stat_date BETWEEN $2::date AND $3::date), 0) AS processing,
         COALESCE(SUM(orders_shipped) FILTER (WHERE stat_date BETWEEN $2::date AND $3::date), 0) AS shipped,
         COALESCE(SUM(orders_delivered) FILTER (WHERE stat_date BETWEEN $2::date AND $3::date), 0) AS delivered,
         COALESCE(SUM(orders_cancelled) FILTER (WHERE stat_date BETWEEN $2::date AND $3::date), 0) AS cancelled,
         COALESCE(SUM(orders_returned) FILTER (WHERE stat_date BETWEEN $2::date AND $3::date), 0) AS returned,
         COALESCE(SUM(orders_value) FILTER (WHERE stat_date BETWEEN $2::date AND $3::date), 0) AS total_value,
         COALESCE(SUM(orders_total) FILTER (WHERE stat_date BETWEEN $4::date AND $5::date), 0) AS prev_total,
         COALESCE(SUM(orders_value) FILTER (WHERE stat_date BETWEEN $4::date AND $5::date), 0) AS prev_total_value
       FROM analytics_daily_stats
       WHERE organization_id = $1 AND stat_date BETWEEN $4::date AND $3::date`,
      [organizationId, currentStart, currentEnd, prevStart, prevEnd], client
    );
    return result.rows[0];
  }

  /**
   * Aggregate shipment counts, on-time delivery stats and avg delivery time.
   * Includes previous period for % change.
   */
  async getShipmentStats(organizationId = null, days = 30, client = null) {
    const { currentStart, currentEnd, prevStart, prevEnd } = getDateWindow(days);
    const result = await this.query(
      `SELECT
         COALESCE(SUM(shipments_total) FILTER (WHERE stat_date BETWEEN $2::date AND $3::date), 0) AS total,
         COALESCE(SUM(shipments_in_transit + shipments_out_for_delivery) FILTER (WHERE stat_date BETWEEN $2::date AND $3::date), 0) AS in_transit,
         COALESCE(SUM(shipments_delivered) FILTER (WHERE stat_date BETWEEN $2::date AND $3::date), 0) AS delivered,
         COALESCE(SUM(shipments_on_time) FILTER (WHERE stat_date BETWEEN $2::date AND $3::date), 0) AS on_time,
         COALESCE(AVG(avg_delivery_days) FILTER (WHERE stat_date BETWEEN $2::date AND $3::date AND shipments_delivered > 0), 0) AS avg_delivery_days,
         COALESCE(SUM(shipments_total) FILTER (WHERE stat_date BETWEEN $4::date AND $5::date), 0) AS prev_total,
         COALESCE(SUM(shipments_delivered) FILTER (WHERE stat_date BETWEEN $4::date AND $5::date), 0) AS prev_delivered,
         COALESCE(SUM(shipments_on_time) FILTER (WHERE stat_date BETWEEN $4::date AND $5::date), 0) AS prev_on_time,
         COALESCE(AVG(avg_delivery_days) FILTER (WHERE stat_date BETWEEN $4::date AND $5::date AND shipments_delivered > 0), 0) AS prev_avg_delivery_days
       FROM analytics_daily_stats
       WHERE organization_id = $1 AND stat_date BETWEEN $4::date AND $3::date`,
      [organizationId, currentStart, currentEnd, prevStart, prevEnd], client
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
    const { currentStart, currentEnd, prevStart, prevEnd } = getDateWindow(days);
    const result = await this.query(
      `SELECT
         COALESCE(SUM(returns_pending) FILTER (WHERE stat_date BETWEEN $2::date AND $3::date), 0) AS pending_returns,
         COALESCE(SUM(returns_pending) FILTER (WHERE stat_date BETWEEN $4::date AND $5::date), 0) AS prev_pending_returns
       FROM analytics_daily_stats
       WHERE organization_id = $1 AND stat_date BETWEEN $4::date AND $3::date`,
      [organizationId, currentStart, currentEnd, prevStart, prevEnd], client
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
    const { currentStart, currentEnd } = getDateWindow(days);
    const result = await this.query(
      `SELECT stat_date AS date, orders_total AS count, orders_value AS value
       FROM analytics_daily_stats
       WHERE organization_id = $1 AND stat_date BETWEEN $2::date AND $3::date
       ORDER BY stat_date ASC`,
      [organizationId, currentStart, currentEnd], client
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
    const { currentStart, currentEnd } = getDateWindow(days);
    const result = await this.query(
      `SELECT
         a.warehouse_id,
         w.name AS warehouse_name,
         COALESCE(SUM(a.inbound_count), 0) AS inbound_count,
         COALESCE(SUM(a.outbound_count), 0) AS outbound_count,
         COALESCE(SUM(a.inbound_units), 0) AS inbound_units,
         COALESCE(SUM(a.outbound_units), 0) AS outbound_units
       FROM analytics_daily_warehouse_activity a
       JOIN warehouses w ON w.id = a.warehouse_id
       WHERE a.organization_id = $1 AND a.stat_date BETWEEN $2::date AND $3::date
       GROUP BY a.warehouse_id, w.name`,
      [organizationId, currentStart, currentEnd], client
    );
    return result.rows;
  }
}

export default new DashboardRepository();
