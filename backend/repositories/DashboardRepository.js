// Dashboard Repository - thin BaseRepository wrapper giving dashboard queries
// a proper domain boundary without duplicating complex SQL into the controller.
import BaseRepository from './BaseRepository.js';

class DashboardRepository extends BaseRepository {
  constructor() {
    super('orders');
  }

  /**
   * Aggregate order counts and total value for the last 30 days.
   * @param {string|null} organizationId
   */
  async getOrderStats(organizationId = null, client = null) {
    const orgClause = organizationId ? ' AND organization_id = $1' : '';
    const orgArgs   = organizationId ? [organizationId] : [];
    const result = await this.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(CASE WHEN status IN ('created','confirmed')                               THEN 1 END) AS pending,
         COUNT(CASE WHEN status IN ('allocated','processing')                            THEN 1 END) AS processing,
         COUNT(CASE WHEN status IN ('shipped','in_transit','out_for_delivery')           THEN 1 END) AS shipped,
         COUNT(CASE WHEN status = 'delivered'                                            THEN 1 END) AS delivered,
         COALESCE(SUM(total_amount), 0)                                                             AS total_value
       FROM orders
       WHERE created_at >= NOW() - INTERVAL '30 days'${orgClause}`,
      orgArgs, client
    );
    return result.rows[0];
  }

  /**
   * Aggregate shipment counts and on-time delivery stats for the last 30 days.
   * @param {string|null} organizationId
   */
  async getShipmentStats(organizationId = null, client = null) {
    const orgClause = organizationId ? ' AND s.organization_id = $1' : '';
    const orgArgs   = organizationId ? [organizationId] : [];
    const result = await this.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(CASE WHEN s.status IN ('picked_up','in_transit','at_hub','out_for_delivery') THEN 1 END) AS in_transit,
         COUNT(CASE WHEN s.status = 'delivered'                                             THEN 1 END) AS delivered,
         COUNT(CASE
           WHEN o.actual_delivery   IS NOT NULL
            AND o.estimated_delivery IS NOT NULL
            AND o.actual_delivery <= o.estimated_delivery
           THEN 1 END) AS on_time
       FROM shipments s
       LEFT JOIN orders o ON o.id = s.order_id
       WHERE s.created_at >= NOW() - INTERVAL '30 days'${orgClause}`,
      orgArgs, client
    );
    return result.rows[0];
  }

  /**
   * Count low-stock inventory items (available_quantity <= 5).
   * @param {string|null} organizationId
   */
  async getLowStockCount(organizationId = null, client = null) {
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
   * Count pending returns (status in pending / approved / processing).
   * @param {string|null} organizationId
   */
  async getPendingReturnsCount(organizationId = null, client = null) {
    const orgClause = organizationId ? ' AND organization_id = $1' : '';
    const orgArgs   = organizationId ? [organizationId] : [];
    const result = await this.query(
      `SELECT COUNT(*) AS pending_returns
       FROM returns
       WHERE status IN ('pending', 'approved', 'processing')${orgClause}`,
      orgArgs, client
    );
    return parseInt(result.rows[0].pending_returns);
  }

  /**
   * Count active (open) exceptions.
   * @param {string|null} organizationId
   */
  async getActiveExceptionsCount(organizationId = null, client = null) {
    const orgClause = organizationId ? ' AND organization_id = $1' : '';
    const orgArgs   = organizationId ? [organizationId] : [];
    const result = await this.query(
      `SELECT COUNT(*) AS active_exceptions
       FROM exceptions
       WHERE status = 'open'${orgClause}`,
      orgArgs, client
    );
    return parseInt(result.rows[0].active_exceptions);
  }
}

export default new DashboardRepository();
