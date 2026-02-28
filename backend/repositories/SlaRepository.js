// SLA Repository - thin BaseRepository wrapper for SLA, violation, and exception queries.
import BaseRepository from './BaseRepository.js';

class SlaRepository extends BaseRepository {
  constructor() {
    super('sla_policies');
  }

  /**
   * Returns active SLA policies, optionally scoped to an organization.
   * Rows with organization_id IS NULL are global/system-level policies visible to all.
   *
   * @param {string|null} organizationId
   * @returns {Promise<Array>}
   */
  async findActivePolicies(organizationId = null) {
    let sql    = `SELECT * FROM sla_policies WHERE is_active = true`;
    const params = [];
    if (organizationId) {
      params.push(organizationId);
      sql += ` AND (organization_id = $1 OR organization_id IS NULL)`;
    }
    sql += ` ORDER BY priority ASC, name ASC`;
    const result = await this.query(sql, params);
    return result.rows;
  }

  /**
   * Fetch the most recent ETA prediction for a shipment.
   * Returns null if not found.
   */
  async findLatestEta(shipmentId, organizationId) {
    const sql = organizationId
      ? `SELECT ep.*, s.tracking_number
         FROM eta_predictions ep
         JOIN shipments s ON ep.shipment_id = s.id
         WHERE ep.shipment_id = $1 AND s.organization_id = $2
         ORDER BY ep.predicted_at DESC LIMIT 1`
      : `SELECT ep.*, s.tracking_number
         FROM eta_predictions ep
         JOIN shipments s ON ep.shipment_id = s.id
         WHERE ep.shipment_id = $1
         ORDER BY ep.predicted_at DESC LIMIT 1`;
    const params = organizationId ? [shipmentId, organizationId] : [shipmentId];
    const result = await this.query(sql, params);
    return result.rows[0] || null;
  }

  /**
   * Paginated SLA violations with optional status + org filter.
   * Returns { rows, total }.
   */
  async findViolations({ organizationId, status, page = 1, limit = 20 } = {}) {
    const params = [];
    let p = 1;
    const where = ['1=1'];

    if (organizationId) { params.push(organizationId); where.push(`sv.organization_id = $${p++}`); }
    if (status)          { params.push(status);          where.push(`sv.status = $${p++}`); }

    const baseQuery = `
      SELECT sv.*, s.tracking_number, sp.name AS policy_name
      FROM sla_violations sv
      JOIN shipments s ON sv.shipment_id = s.id
      JOIN sla_policies sp ON sv.sla_policy_id = sp.id
      WHERE ${where.join(' AND ')}
    `;

    const countParams = [...params];
    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const [dataResult, countResult] = await Promise.all([
      this.query(baseQuery + ` ORDER BY sv.violated_at DESC LIMIT $${p++} OFFSET $${p}`, params),
      this.query(`SELECT COUNT(*) FROM (${baseQuery}) AS _cnt`, countParams),
    ]);

    return {
      rows: dataResult.rows,
      total: parseInt(countResult.rows[0]?.count || 0),
    };
  }

  /**
   * SLA dashboard summary: compliance, violations by status, top carriers.
   * Returns { compliance, violations, carriers }.
   */
  async getSlaDashboard(organizationId) {
    const orgClause = organizationId ? ' AND organization_id = $1' : '';
    const orgArgs   = organizationId ? [organizationId] : [];

    const [complianceResult, violationsResult, carrierResult] = await Promise.all([
      this.query(`
        SELECT
          COUNT(*) AS total_shipments,
          COUNT(CASE WHEN s.delivery_actual <= s.delivery_scheduled THEN 1 END) AS on_time
        FROM shipments s
        WHERE s.status = 'delivered'
          AND s.created_at >= NOW() - INTERVAL '30 days'${organizationId ? ' AND s.organization_id = $1' : ''}
      `, orgArgs),
      this.query(`
        SELECT status, COUNT(*) AS count
        FROM sla_violations
        WHERE violated_at >= NOW() - INTERVAL '30 days'${orgClause}
        GROUP BY status
      `, orgArgs),
      this.query(`
        SELECT c.name, c.reliability_score, COUNT(s.id) AS shipment_count
        FROM carriers c
        LEFT JOIN shipments s ON s.carrier_id = c.id
          AND s.created_at >= NOW() - INTERVAL '30 days'
        WHERE c.is_active = true
        GROUP BY c.id, c.name, c.reliability_score
        ORDER BY c.reliability_score DESC
        LIMIT 5
      `),
    ]);

    return {
      compliance: complianceResult.rows[0],
      violations: violationsResult.rows,
      carriers: carrierResult.rows,
    };
  }

  /**
   * Paginated exceptions with optional severity, status, org filter.
   * Returns { rows, total }.
   */
  async findExceptions({ organizationId, severity, status, page = 1, limit = 20 } = {}) {
    const params = [];
    let p = 1;
    const where = ['1=1'];

    if (organizationId) { params.push(organizationId); where.push(`e.organization_id = $${p++}`); }
    if (severity)        { params.push(severity);        where.push(`e.severity = $${p++}`); }
    if (status)          { params.push(status);          where.push(`e.status = $${p++}`); }

    const baseQuery = `
      SELECT e.*, s.tracking_number, o.order_number
      FROM exceptions e
      LEFT JOIN shipments s ON e.shipment_id = s.id
      LEFT JOIN orders o ON e.order_id = o.id
      WHERE ${where.join(' AND ')}
    `;

    const countParams = [...params];
    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const [dataResult, countResult] = await Promise.all([
      this.query(baseQuery + ` ORDER BY e.created_at DESC LIMIT $${p++} OFFSET $${p}`, params),
      this.query(`SELECT COUNT(*) FROM (${baseQuery}) AS _cnt`, countParams),
    ]);

    return {
      rows: dataResult.rows,
      total: parseInt(countResult.rows[0]?.count || 0),
    };
  }

  /**
   * Insert a new exception row.
   * Returns the created row.
   */
  async createException({ organizationId, shipmentId, exceptionType, severity, description }) {
    const result = await this.query(
      `INSERT INTO exceptions (organization_id, shipment_id, exception_type, severity, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [organizationId || null, shipmentId, exceptionType, severity, description]
    );
    return result.rows[0];
  }

  /**
   * Mark an exception as resolved.
   * Returns the updated row or null if not found / org mismatch.
   */
  async resolveException(id, resolution, organizationId) {
    const sql = organizationId
      ? `UPDATE exceptions SET status = 'resolved', resolution = $1, resolved_at = NOW()
         WHERE id = $2 AND organization_id = $3 RETURNING *`
      : `UPDATE exceptions SET status = 'resolved', resolution = $1, resolved_at = NOW()
         WHERE id = $2 RETURNING *`;
    const params = organizationId ? [resolution, id, organizationId] : [resolution, id];
    const result = await this.query(sql, params);
    return result.rows[0] || null;
  }

  // ─────────────────────────────────────────────────────────────
  // SLA VIOLATION DETECTION & MONITORING
  // ─────────────────────────────────────────────────────────────

  /**
   * Return all active (non-terminal) shipments that are past their scheduled
   * delivery time and do not yet have an open SLA violation.
   * Used by the automated monitoring job.
   */
  async findActiveShipmentsForMonitoring(client = null) {
    const result = await this.query(
      `SELECT s.*, sp.id as policy_id, sp.delivery_hours, sp.penalty_per_hour,
              sp.name as policy_name
       FROM shipments s
       JOIN orders o ON o.id = s.order_id
       JOIN sla_policies sp ON (
         sp.service_type = o.priority
         AND sp.is_active = true
       )
       WHERE s.status NOT IN ('delivered', 'returned', 'cancelled')
       AND s.delivery_scheduled < NOW()
       AND NOT EXISTS (
         SELECT 1 FROM sla_violations sv
         WHERE sv.shipment_id = s.id AND sv.status = 'open'
       )`,
      [],
      client
    );
    return result.rows;
  }

  /**
   * Insert a new SLA violation record.
   * @param {{ shipmentId, slaPolicyId, promisedDelivery, delayHours, penaltyAmount, reason, status, detectionMethod }} data
   */
  async createViolation(data, client = null) {
    const result = await this.query(
      `INSERT INTO sla_violations
       (shipment_id, sla_policy_id, promised_delivery, delay_hours, penalty_amount,
        reason, status, detected_at, detection_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
       RETURNING *`,
      [
        data.shipmentId,
        data.slaPolicyId,
        data.promisedDelivery,
        data.delayHours,
        data.penaltyAmount,
        data.reason,
        data.status,
        data.detectionMethod,
      ],
      client
    );
    return result.rows[0];
  }

  // ─────────────────────────────────────────────────────────────
  // CARRIER PERFORMANCE
  // ─────────────────────────────────────────────────────────────

  /**
   * Aggregate shipment delivery stats for a carrier over a date range.
   * Returns a single row: { total_shipments, on_time, late, failed }
   */
  async findCarrierShipmentStats(carrierId, periodStart, periodEnd, client = null) {
    const result = await this.query(
      `SELECT
         COUNT(*) AS total_shipments,
         COUNT(CASE WHEN status = 'delivered' AND delivery_actual <= delivery_scheduled THEN 1 END) AS on_time,
         COUNT(CASE WHEN status = 'delivered' AND delivery_actual > delivery_scheduled THEN 1 END) AS late,
         COUNT(CASE WHEN status = 'failed_delivery' THEN 1 END) AS failed
       FROM shipments
       WHERE carrier_id = $1
         AND created_at >= $2 AND created_at < $3`,
      [carrierId, periodStart, periodEnd],
      client
    );
    return result.rows[0];
  }

  /**
   * Aggregate SLA violation stats for a carrier over a date range.
   * Returns a single row: { violation_count, total_penalties }
   */
  async findCarrierViolationStats(carrierId, periodStart, periodEnd, client = null) {
    const result = await this.query(
      `SELECT COUNT(*) AS violation_count,
              COALESCE(SUM(penalty_amount), 0) AS total_penalties
       FROM sla_violations sv
       JOIN shipments s ON s.id = sv.shipment_id
       WHERE s.carrier_id = $1
         AND sv.created_at >= $2 AND sv.created_at < $3`,
      [carrierId, periodStart, periodEnd],
      client
    );
    return result.rows[0];
  }

  /**
   * Insert or update a carrier_performance_metrics row for the given period.
   */
  async upsertCarrierPerformanceMetrics(data, client = null) {
    await this.query(
      `INSERT INTO carrier_performance_metrics
       (carrier_id, period_start, period_end, total_shipments, on_time_deliveries,
        late_deliveries, failed_deliveries, sla_violations, total_penalties,
        performance_score, reliability_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (carrier_id, period_start, period_end)
       DO UPDATE SET
         total_shipments      = EXCLUDED.total_shipments,
         on_time_deliveries   = EXCLUDED.on_time_deliveries,
         late_deliveries      = EXCLUDED.late_deliveries,
         failed_deliveries    = EXCLUDED.failed_deliveries,
         sla_violations       = EXCLUDED.sla_violations,
         total_penalties      = EXCLUDED.total_penalties,
         performance_score    = EXCLUDED.performance_score,
         reliability_score    = EXCLUDED.reliability_score,
         calculated_at        = NOW()`,
      [
        data.carrierId,
        data.periodStart,
        data.periodEnd,
        data.totalShipments,
        data.onTime,
        data.late,
        data.failed,
        data.violationCount,
        data.totalPenalties,
        data.performanceScore,
        data.reliabilityScore,
      ],
      client
    );
  }

  // ─────────────────────────────────────────────────────────────
  // VIOLATION STATUS UPDATES
  // ─────────────────────────────────────────────────────────────

  /**
   * Apply a penalty to a violation (mark as applied and record approver).
   */
  async applyViolationPenalty(violationId, approvedBy, client = null) {
    const result = await this.query(
      `UPDATE sla_violations
       SET penalty_applied       = true,
           penalty_calculated_at = NOW(),
           penalty_approved_by   = $1
       WHERE id = $2
       RETURNING *`,
      [approvedBy, violationId],
      client
    );
    return result.rows[0] || null;
  }

  /**
   * Waive a violation penalty with a reason.
   */
  async waiveViolationPenalty(violationId, reason, client = null) {
    const result = await this.query(
      `UPDATE sla_violations
       SET status       = 'waived',
           waiver_reason = $1,
           resolved_at  = NOW()
       WHERE id = $2
       RETURNING *`,
      [reason, violationId],
      client
    );
    return result.rows[0] || null;
  }

  /**
   * Mark an SLA violation as resolved.
   */
  async resolveViolation(violationId, client = null) {
    const result = await this.query(
      `UPDATE sla_violations
       SET status      = 'resolved',
           resolved_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [violationId],
      client
    );
    return result.rows[0] || null;
  }

  /**
   * Get SLA compliance report grouped by status and severity for a date range.
   */
  async getComplianceReport(startDate, endDate, client = null) {
    const result = await this.query(
      `SELECT
         status,
         severity,
         COUNT(*)                                      AS total,
         COUNT(*) FILTER (WHERE status = 'open')       AS open,
         COUNT(*) FILTER (WHERE status = 'resolved')   AS resolved,
         COUNT(*) FILTER (WHERE status = 'acknowledged') AS acknowledged,
         ROUND(AVG(
           CASE WHEN resolved_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (resolved_at - violated_at)) / 3600
           END
         ), 2) AS avg_resolution_hours
       FROM sla_violations
       WHERE violated_at BETWEEN $1 AND $2
       GROUP BY ROLLUP(status, severity)
       ORDER BY status, severity`,
      [startDate, endDate], client
    );
    return result.rows;
  }
}

export default new SlaRepository();
