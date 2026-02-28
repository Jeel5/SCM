import BaseRepository from './BaseRepository.js';

class ExceptionRepository extends BaseRepository {
  constructor() {
    super('exceptions');
  }

  /**
   * Insert a new exception record.
   */
  async create(
    { shipmentId, orderId, exceptionType, description, severity, priority, assignedTo, estimatedResolutionTime },
    client = null
  ) {
    const res = await this.query(
      `INSERT INTO exceptions
        (shipment_id, order_id, exception_type, description, severity,
         status, priority, assigned_to, estimated_resolution_time)
       VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, $8)
       RETURNING *`,
      [shipmentId, orderId, exceptionType, description, severity, priority, assignedTo, estimatedResolutionTime],
      client
    );
    return res.rows[0];
  }

  /**
   * Escalate an exception: bump escalation_level, set timestamp/assignee, tighten priority.
   */
  async escalate(exceptionId, escalationLevel, escalatedTo = null, client = null) {
    const res = await this.query(
      `UPDATE exceptions
       SET escalation_level = $1,
           escalated_at     = NOW(),
           escalated_to     = $2,
           priority         = GREATEST(1, priority - 2)
       WHERE id = $3
       RETURNING *`,
      [escalationLevel, escalatedTo, exceptionId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Find open/investigating exceptions past their estimated resolution time
   * that have not yet reached max escalation level.
   */
  async findOverdue(client = null) {
    const res = await this.query(
      `SELECT *
       FROM exceptions
       WHERE status IN ('open', 'investigating')
         AND estimated_resolution_time < NOW()
         AND escalation_level < 3
       ORDER BY priority ASC, created_at ASC`,
      [],
      client
    );
    return res.rows;
  }

  /**
   * Assign (or reassign) an exception to a user.
   * If the exception is 'open', move it to 'investigating'.
   */
  async assign(exceptionId, userId, client = null) {
    const res = await this.query(
      `UPDATE exceptions
       SET assigned_to = $1,
           status = CASE WHEN status = 'open' THEN 'investigating' ELSE status END
       WHERE id = $2
       RETURNING *`,
      [userId, exceptionId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Resolve an exception with root-cause analysis.
   */
  async resolve(exceptionId, { resolution, resolutionNotes, rootCause }, client = null) {
    const res = await this.query(
      `UPDATE exceptions
       SET status           = 'resolved',
           resolution       = $1,
           resolution_notes = $2,
           root_cause       = $3,
           resolved_at      = NOW()
       WHERE id = $4
       RETURNING *`,
      [resolution, resolutionNotes, rootCause, exceptionId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Aggregate statistics within a date range.
   * Returns { overall, bySeverity, byType, byRootCause }.
   */
  async getStatistics(startDate, endDate, organizationId = undefined, client = null) {
    const orgFilter = organizationId ? ' AND organization_id = $3' : '';
    const extraArgs = organizationId ? [organizationId] : [];

    const [overallRes, severityRes, typeRes, rootCauseRes] = await Promise.all([
      this.query(
        `SELECT
           COUNT(*) AS total_exceptions,
           COUNT(CASE WHEN status = 'open'          THEN 1 END) AS open,
           COUNT(CASE WHEN status = 'investigating' THEN 1 END) AS investigating,
           COUNT(CASE WHEN status = 'resolved'      THEN 1 END) AS resolved,
           COUNT(CASE WHEN status = 'escalated'     THEN 1 END) AS escalated,
           AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) AS avg_resolution_hours
         FROM exceptions
         WHERE created_at >= $1 AND created_at < $2${orgFilter}`,
        [startDate, endDate, ...extraArgs],
        client
      ),
      this.query(
        `SELECT severity, COUNT(*) AS count
         FROM exceptions
         WHERE created_at >= $1 AND created_at < $2${orgFilter}
         GROUP BY severity
         ORDER BY
           CASE severity
             WHEN 'critical' THEN 1
             WHEN 'high'     THEN 2
             WHEN 'medium'   THEN 3
             WHEN 'low'      THEN 4
           END`,
        [startDate, endDate, ...extraArgs],
        client
      ),
      this.query(
        `SELECT exception_type, COUNT(*) AS count,
                AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) AS avg_resolution_hours
         FROM exceptions
         WHERE created_at >= $1 AND created_at < $2${orgFilter}
         GROUP BY exception_type
         ORDER BY count DESC`,
        [startDate, endDate, ...extraArgs],
        client
      ),
      this.query(
        `SELECT root_cause, COUNT(*) AS count
         FROM exceptions
         WHERE created_at >= $1 AND created_at < $2${orgFilter}
           AND root_cause IS NOT NULL
         GROUP BY root_cause
         ORDER BY count DESC
         LIMIT 10`,
        [startDate, endDate, ...extraArgs],
        client
      ),
    ]);

    return {
      overall:     overallRes.rows[0],
      bySeverity:  severityRes.rows,
      byType:      typeRes.rows,
      byRootCause: rootCauseRes.rows,
    };
  }

  /**
   * High-priority exceptions needing immediate attention (priority ≤ 3 or critical).
   */
  async findHighPriority(organizationId = undefined, client = null) {
    const orgCondition = organizationId ? 'AND e.organization_id = $1' : '';
    const params = organizationId ? [organizationId] : [];
    const res = await this.query(
      `SELECT e.*,
              s.tracking_number,
              o.order_number,
              u.name AS assigned_to_name
       FROM exceptions e
       LEFT JOIN shipments s ON s.id = e.shipment_id
       LEFT JOIN orders    o ON o.id = e.order_id
       LEFT JOIN users     u ON u.id = e.assigned_to
       WHERE e.status IN ('open', 'investigating')
         AND (e.priority <= 3 OR e.severity = 'critical')
         ${orgCondition}
       ORDER BY e.priority ASC, e.created_at ASC
       LIMIT 20`,
      params,
      client
    );
    return res.rows;
  }

  /**
   * Delayed shipments that do not yet have a 'delay' exception.
   */
  async findDelayedShipmentsWithoutException(client = null) {
    const res = await this.query(
      `SELECT s.*
       FROM shipments s
       WHERE s.status NOT IN ('delivered', 'returned', 'cancelled')
         AND s.delivery_scheduled < NOW() - INTERVAL '24 hours'
         AND NOT EXISTS (
           SELECT 1 FROM exceptions e
           WHERE e.shipment_id = s.id AND e.exception_type = 'delay'
         )
       LIMIT 50`,
      [],
      client
    );
    return res.rows;
  }
}

export default new ExceptionRepository();
