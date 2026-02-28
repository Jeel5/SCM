// Alert Repository - named query methods for alert rules, alerts, and check queries
import BaseRepository from './BaseRepository.js';

class AlertRepository extends BaseRepository {
  constructor() {
    super('alerts');
  }

  // ── Alert Rules ───────────────────────────────────────────────────────────

  /**
   * Fetch all active alert rules ordered by priority ascending.
   */
  async getActiveAlertRules(client = null) {
    const result = await this.query(
      `SELECT * FROM alert_rules
       WHERE is_active = true
       ORDER BY priority ASC`,
      [],
      client
    );
    return result.rows;
  }

  // ── Alert Records ─────────────────────────────────────────────────────────

  /**
   * Find the most-recent alert for a rule that fired within the cooldown window.
   * Returns the alert row or null (used for dedup / suppression check).
   */
  async findRecentAlertByRule(ruleId, cooldownMinutes, client = null) {
    const result = await this.query(
      `SELECT id FROM alerts
       WHERE rule_id = $1
         AND triggered_at > NOW() - ($2 * INTERVAL '1 minute')
       ORDER BY triggered_at DESC
       LIMIT 1`,
      [ruleId, cooldownMinutes],
      client
    );
    return result.rows[0] || null;
  }

  /**
   * Insert a new alert record and return it.
   */
  async createAlert(ruleId, ruleName, ruleType, severity, messageTemplate, data, client = null) {
    const result = await this.query(
      `INSERT INTO alerts
         (rule_id, rule_name, alert_type, severity, message, data, triggered_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [ruleId, ruleName, ruleType, severity, messageTemplate, JSON.stringify(data)],
      client
    );
    return result.rows[0];
  }

  /**
   * Acknowledge an alert. Pass organizationId to scope to a specific org.
   */
  async acknowledgeAlert(alertId, userId, organizationId = null, client = null) {
    const params = organizationId
      ? [alertId, userId, organizationId]
      : [alertId, userId];
    const orgClause = organizationId ? ' AND organization_id = $3' : '';
    const result = await this.query(
      `UPDATE alerts
       SET status = 'acknowledged',
           acknowledged_by = $2,
           acknowledged_at = NOW()
       WHERE id = $1${orgClause}
       RETURNING *`,
      params,
      client
    );
    return result.rows[0] || null;
  }

  /**
   * Resolve an alert. Pass organizationId to scope to a specific org.
   */
  async resolveAlert(alertId, userId, resolution, organizationId = null, client = null) {
    const params = organizationId
      ? [alertId, userId, resolution, organizationId]
      : [alertId, userId, resolution];
    const orgClause = organizationId ? ' AND organization_id = $4' : '';
    const result = await this.query(
      `UPDATE alerts
       SET status = 'resolved',
           resolved_by = $2,
           resolved_at = NOW(),
           resolution = $3
       WHERE id = $1${orgClause}
       RETURNING *`,
      params,
      client
    );
    return result.rows[0] || null;
  }

  /**
   * Paginated list of alerts with optional filters.
   * filters: { organizationId?, status?, severity?, alert_type? }
   */
  async findAlerts(filters = {}, limit = 20, offset = 0, client = null) {
    const conditions = [];
    const params = [];
    let paramCount = 1;

    if (filters.organizationId) {
      conditions.push(`organization_id = $${paramCount++}`);
      params.push(filters.organizationId);
    }
    if (filters.status) {
      conditions.push(`status = $${paramCount++}`);
      params.push(filters.status);
    }
    if (filters.severity) {
      conditions.push(`severity = $${paramCount++}`);
      params.push(filters.severity);
    }
    if (filters.alert_type) {
      conditions.push(`alert_type = $${paramCount++}`);
      params.push(filters.alert_type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    const result = await this.query(
      `SELECT a.*, ar.name AS rule_name
       FROM alerts a
       LEFT JOIN alert_rules ar ON a.rule_id = ar.id
       ${whereClause}
       ORDER BY triggered_at DESC
       LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      params,
      client
    );
    return result.rows;
  }

  /**
   * Total count of alerts matching the same optional filters (for pagination).
   */
  async countAlerts(filters = {}, client = null) {
    const conditions = [];
    const params = [];
    let paramCount = 1;

    if (filters.organizationId) {
      conditions.push(`organization_id = $${paramCount++}`);
      params.push(filters.organizationId);
    }
    if (filters.status) {
      conditions.push(`status = $${paramCount++}`);
      params.push(filters.status);
    }
    if (filters.severity) {
      conditions.push(`severity = $${paramCount++}`);
      params.push(filters.severity);
    }
    if (filters.alert_type) {
      conditions.push(`alert_type = $${paramCount++}`);
      params.push(filters.alert_type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.query(
      `SELECT COUNT(*) FROM alerts ${whereClause}`,
      params,
      client
    );
    return parseInt(result.rows[0].count);
  }

  // ── Recipient Lookups ─────────────────────────────────────────────────────

  /**
   * Fetch user IDs that belong to any of the given roles and are active.
   */
  async getUsersByRoles(roles, client = null) {
    const result = await this.query(
      `SELECT id FROM users
       WHERE role = ANY($1) AND is_active = true`,
      [roles],
      client
    );
    return result.rows.map(r => r.id);
  }

  /**
   * Fetch active admin user IDs, optionally scoped to an organization.
   */
  async getAdminUsers(organizationId = null, client = null) {
    const params = [];
    const orgClause = organizationId
      ? ` AND organization_id = $${params.push(organizationId)}`
      : '';
    const result = await this.query(
      `SELECT id FROM users
       WHERE role = 'admin' AND is_active = true${orgClause}`,
      params,
      client
    );
    return result.rows.map(r => r.id);
  }

  // ── Threshold / Count Checks ─────────────────────────────────────────────

  /**
   * Count pending SLA violations created in the last hour.
   */
  async countPendingSlaViolations(client = null) {
    const result = await this.query(
      `SELECT COUNT(*)
       FROM sla_violations
       WHERE status = 'pending'
         AND created_at > NOW() - INTERVAL '1 hour'`,
      [],
      client
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Count open/in-progress critical exceptions created in the last hour.
   */
  async countCriticalExceptions(client = null) {
    const result = await this.query(
      `SELECT COUNT(*)
       FROM exceptions
       WHERE severity = 'critical'
         AND status IN ('open', 'in_progress')
         AND created_at > NOW() - INTERVAL '1 hour'`,
      [],
      client
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Count inventory items at or below their reorder point (but still in stock).
   */
  async countLowStockItems(client = null) {
    const result = await this.query(
      `SELECT COUNT(*)
       FROM inventory
       WHERE quantity_available <= reorder_point
         AND quantity_available > 0`,
      [],
      client
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Count orders that are past their expected delivery date and not yet done.
   */
  async countDelayedOrders(client = null) {
    const result = await this.query(
      `SELECT COUNT(*)
       FROM orders
       WHERE status NOT IN ('delivered', 'cancelled')
         AND expected_delivery_date < CURRENT_DATE`,
      [],
      client
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Count shipments that are active but have had no tracking activity for ≥ 48 h
   * (and were created more than 24 h ago).
   * Uses a subquery to avoid duplicate rows from multiple tracking events.
   */
  async countStuckShipments(client = null) {
    const result = await this.query(
      `SELECT COUNT(*)
       FROM shipments s
       LEFT JOIN (
         SELECT shipment_id, MAX(event_time) AS last_event_time
         FROM shipment_events
         GROUP BY shipment_id
       ) se ON s.id = se.shipment_id
       WHERE s.status NOT IN ('delivered', 'returned', 'cancelled')
         AND s.created_at < NOW() - INTERVAL '24 hours'
         AND (se.shipment_id IS NULL OR se.last_event_time < NOW() - INTERVAL '48 hours')`,
      [],
      client
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Return carriers whose on-time delivery rate (last 7 days) is below the
   * given threshold percentage.
   */
  async getUnderperformingCarriers(threshold, client = null) {
    const result = await this.query(
      `SELECT c.id, c.name,
              COUNT(s.id) AS total_shipments,
              COUNT(CASE WHEN s.actual_delivery_date > s.expected_delivery_date THEN 1 END) AS delayed,
              CAST(COUNT(CASE WHEN s.actual_delivery_date <= s.expected_delivery_date THEN 1 END) AS FLOAT) /
              NULLIF(COUNT(s.id), 0) * 100 AS on_time_rate
       FROM carriers c
       JOIN shipments s ON c.id = s.carrier_id
       WHERE s.status = 'delivered'
         AND s.actual_delivery_date > NOW() - INTERVAL '7 days'
       GROUP BY c.id, c.name
       HAVING CAST(COUNT(CASE WHEN s.actual_delivery_date <= s.expected_delivery_date THEN 1 END) AS FLOAT) /
              NULLIF(COUNT(s.id), 0) * 100 < $1`,
      [threshold],
      client
    );
    return result.rows;
  }
}

export default new AlertRepository();
