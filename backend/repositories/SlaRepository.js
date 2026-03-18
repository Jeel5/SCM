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
    const select = `
      SELECT sp.*,
             c.name AS carrier_name
      FROM sla_policies sp
      LEFT JOIN carriers c ON c.id = sp.carrier_id
      WHERE sp.is_active = true`;
    const params = [];
    let sql = select;
    if (organizationId) {
      params.push(organizationId);
      sql += ` AND (sp.organization_id = $1 OR sp.organization_id IS NULL)`;
    }
    sql += ` ORDER BY sp.priority ASC, sp.name ASC`;
    const result = await this.query(sql, params);
    return result.rows;
  }

  /**
   * Find a single policy by id, optionally org-scoped.
   */
  async findPolicyById(id, organizationId = null) {
    const sql = organizationId
      ? `SELECT sp.*, c.name AS carrier_name FROM sla_policies sp LEFT JOIN carriers c ON c.id = sp.carrier_id WHERE sp.id = $1 AND (sp.organization_id = $2 OR sp.organization_id IS NULL)`
      : `SELECT sp.*, c.name AS carrier_name FROM sla_policies sp LEFT JOIN carriers c ON c.id = sp.carrier_id WHERE sp.id = $1`;
    const params = organizationId ? [id, organizationId] : [id];
    const result = await this.query(sql, params);
    return result.rows[0] || null;
  }

  /**
   * Insert a new SLA policy.
   */
  async createPolicy(data) {
    const result = await this.query(
      `INSERT INTO sla_policies
       (organization_id, name, service_type, carrier_id,
        origin_region, destination_region,
        origin_zone_type, destination_zone_type,
        delivery_hours, pickup_hours,
        penalty_per_hour, max_penalty_amount, penalty_type,
        warning_threshold_percent, is_active, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        data.organizationId || null,
        data.name,
        data.serviceType,
        data.carrierId || null,
        data.originZoneType || null,   // using zone as region label too
        data.destinationZoneType || null,
        data.originZoneType || null,
        data.destinationZoneType || null,
        data.deliveryHours,
        data.pickupHours ?? 4,
        data.penaltyPerHour ?? 0,
        data.maxPenaltyAmount || null,
        data.penaltyType || 'fixed',
        data.warningThresholdPercent ?? 80,
        data.isActive !== false,
        data.priority ?? 5,
      ]
    );
    return result.rows[0];
  }

  /**
   * Update an existing SLA policy. Returns updated row or null.
   */
  async updatePolicy(id, data, organizationId = null) {
    const fields = [];
    const params = [];
    let p = 1;

    const fieldMap = {
      name:                    'name',
      serviceType:             'service_type',
      carrierId:               'carrier_id',
      originZoneType:          'origin_zone_type',
      destinationZoneType:     'destination_zone_type',
      deliveryHours:           'delivery_hours',
      pickupHours:             'pickup_hours',
      penaltyPerHour:          'penalty_per_hour',
      maxPenaltyAmount:        'max_penalty_amount',
      penaltyType:             'penalty_type',
      warningThresholdPercent: 'warning_threshold_percent',
      isActive:                'is_active',
      priority:                'priority',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        params.push(data[key]);
        fields.push(`${col} = $${p++}`);
      }
    }

    if (fields.length === 0) return null;

    params.push(id);
    const whereClause = organizationId
      ? `id = $${p++} AND (organization_id = $${p++} OR organization_id IS NULL)`
      : `id = $${p++}`;
    if (organizationId) params.push(organizationId);

    const result = await this.query(
      `UPDATE sla_policies SET ${fields.join(', ')}, updated_at = NOW() WHERE ${whereClause} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Soft-delete (deactivate) a policy.
   */
  async deactivatePolicy(id, organizationId = null) {
    const sql = organizationId
      ? `UPDATE sla_policies SET is_active = false, updated_at = NOW() WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL) RETURNING *`
      : `UPDATE sla_policies SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`;
    const params = organizationId ? [id, organizationId] : [id];
    const result = await this.query(sql, params);
    return result.rows[0] || null;
  }

  /**
   * Find the best matching active SLA policy for a shipment.
   *
   * All criteria are "OR NULL" — a policy with NULL in a field is a wildcard.
   * Tie-breaking order: priority ASC, then specificity DESC.
   *
   * @param {object} opts
   * @param {string|null} opts.organizationId
   * @param {string|null} opts.carrierId
   * @param {string|null} opts.originZone      - classified zone type
   * @param {string|null} opts.destinationZone - classified zone type
   * @param {string|null} opts.serviceType     - normalised service type
   * @param {object}      [opts.client]        - optional tx client
   * @returns {Promise<object|null>}
   */
  async findMatchingPolicy({ organizationId, carrierId, originZone, destinationZone, serviceType, client }) {
    const params = [];
    let p = 1;

    // Always scope to org (or system-wide NULL policies)
    params.push(organizationId || null);
    let sql = `
      SELECT sp.*
      FROM   sla_policies sp
      WHERE  sp.is_active = true
        AND  (sp.organization_id = $${p++} OR sp.organization_id IS NULL)
    `;

    // Carrier: match exact carrier or wildcard (NULL)
    if (carrierId) {
      params.push(carrierId);
      sql += ` AND (sp.carrier_id IS NULL OR sp.carrier_id = $${p++})`;
    } else {
      sql += ` AND sp.carrier_id IS NULL`;
    }

    // Origin zone: match or wildcard
    if (originZone) {
      params.push(originZone);
      sql += ` AND (sp.origin_zone_type IS NULL OR sp.origin_zone_type = $${p++})`;
    }

    // Destination zone: match or wildcard
    if (destinationZone) {
      params.push(destinationZone);
      sql += ` AND (sp.destination_zone_type IS NULL OR sp.destination_zone_type = $${p++})`;
    }

    // Service type: match or wildcard
    if (serviceType) {
      params.push(serviceType);
      sql += ` AND (sp.service_type IS NULL OR sp.service_type = $${p++})`;
    }

    // Specificity ranking: more constrained policies beat generic ones
    sql += `
      ORDER BY
        sp.priority ASC,
        (sp.carrier_id            IS NOT NULL)::int DESC,
        (sp.service_type          IS NOT NULL)::int DESC,
        (sp.origin_zone_type      IS NOT NULL)::int DESC,
        (sp.destination_zone_type IS NOT NULL)::int DESC
      LIMIT 1
    `;

    const result = await this.query(sql, params, client);
    return result.rows[0] || null;
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
         ORDER BY ep.created_at DESC LIMIT 1`
      : `SELECT ep.*, s.tracking_number
         FROM eta_predictions ep
         JOIN shipments s ON ep.shipment_id = s.id
         WHERE ep.shipment_id = $1
         ORDER BY ep.created_at DESC LIMIT 1`;
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
          COUNT(CASE WHEN s.delivery_actual IS NOT NULL AND s.delivery_actual <= s.delivery_scheduled THEN 1 END) AS on_time
        FROM shipments s
        WHERE s.status = 'delivered'
          AND s.sla_policy_id IS NOT NULL
          AND s.delivery_scheduled IS NOT NULL
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
   * Global exception stats (no pagination) for cards/tabs.
   */
  async getExceptionStatusStats({ organizationId } = {}) {
    const params = [];
    let p = 1;
    const where = ['1=1'];

    if (organizationId) {
      params.push(organizationId);
      where.push(`e.organization_id = $${p++}`);
    }

    const result = await this.query(
      `SELECT
         COUNT(*)::int AS total_exceptions,
         COUNT(*) FILTER (WHERE e.status = 'open')::int AS open,
         COUNT(*) FILTER (WHERE e.status = 'in_progress')::int AS in_progress,
         COUNT(*) FILTER (WHERE e.status = 'resolved')::int AS resolved,
         COUNT(*) FILTER (WHERE e.severity = 'critical')::int AS critical
       FROM exceptions e
       WHERE ${where.join(' AND ')}`,
      params
    );

    return result.rows[0] || {
      total_exceptions: 0,
      open: 0,
      in_progress: 0,
      resolved: 0,
      critical: 0,
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
    // Use sla_policy_id FK directly — set at shipment creation by slaPolicyMatchingService.
    // Union with shipments that have no policy (NULL) but are still past their delivery_scheduled.
    const result = await this.query(
      `SELECT s.*,
              sp.id             AS policy_id,
              sp.delivery_hours,
              sp.penalty_per_hour,
              sp.name           AS policy_name,
              sp.max_penalty_amount
       FROM   shipments s
       LEFT   JOIN sla_policies sp ON sp.id = s.sla_policy_id AND sp.is_active = true
       WHERE  s.status NOT IN ('delivered', 'returned', 'cancelled', 'lost')
         AND  s.delivery_scheduled IS NOT NULL
         AND  s.delivery_scheduled < NOW()
         AND  NOT EXISTS (
           SELECT 1 FROM sla_violations sv
           WHERE sv.shipment_id = s.id
             AND sv.status IN ('open', 'investigating')
         )`,
      [],
      client
    );
    return result.rows;
  }

  /**
   * Insert a new SLA violation record.
   * @param {{ organizationId, shipmentId, slaPolicyId, promisedDelivery, delayHours, penaltyAmount, reason, status }} data
   */
  async createViolation(data, client = null) {
    const result = await this.query(
      `INSERT INTO sla_violations
       (organization_id, shipment_id, sla_policy_id, promised_delivery, delay_hours,
        penalty_amount, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.organizationId || null,
        data.shipmentId,
        data.slaPolicyId,
        data.promisedDelivery,
        data.delayHours,
        data.penaltyAmount,
        data.reason,
        data.status,
      ],
      client
    );
    return result.rows[0];
  }

  /**
   * Fetch a single exception by id with shipment and order joins.
   */
  async findExceptionById(id, organizationId) {
    const sql = organizationId
      ? `SELECT e.*, s.tracking_number, o.order_number
         FROM exceptions e
         LEFT JOIN shipments s ON e.shipment_id = s.id
         LEFT JOIN orders o ON e.order_id = o.id
         WHERE e.id = $1 AND e.organization_id = $2`
      : `SELECT e.*, s.tracking_number, o.order_number
         FROM exceptions e
         LEFT JOIN shipments s ON e.shipment_id = s.id
         LEFT JOIN orders o ON e.order_id = o.id
         WHERE e.id = $1`;
    const params = organizationId ? [id, organizationId] : [id];
    const result = await this.query(sql, params);
    return result.rows[0] || null;
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
    // Note: sla_violations has no severity column — group by status only
    const result = await this.query(
      `SELECT
         status,
         COUNT(*)                                         AS total,
         COUNT(*) FILTER (WHERE status = 'open')          AS open,
         COUNT(*) FILTER (WHERE status = 'resolved')      AS resolved,
         COUNT(*) FILTER (WHERE status = 'acknowledged')  AS acknowledged,
         COUNT(*) FILTER (WHERE status = 'waived')        AS waived,
         ROUND(AVG(
           CASE WHEN resolved_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (resolved_at - violated_at)) / 3600
           END
         ), 2) AS avg_resolution_hours
       FROM sla_violations
       WHERE violated_at BETWEEN $1 AND $2
       GROUP BY ROLLUP(status)
       ORDER BY status`,
      [startDate, endDate], client
    );
    return result.rows;
  }
}

export default new SlaRepository();
