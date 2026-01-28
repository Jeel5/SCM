// Exception Management Service - Priority handling and escalation
import pool from '../configs/db.js';
import { NotFoundError } from '../errors/index.js';
import { logEvent } from '../utils/logger.js';

class ExceptionService {
  /**
   * Create exception with automatic priority calculation
   */
  async createException(exceptionData) {
    const {
      shipmentId,
      orderId,
      exceptionType,
      description,
      severity,
      assignedTo
    } = exceptionData;

    // Calculate priority based on severity and type
    const priority = this.calculatePriority(severity, exceptionType);

    // Calculate estimated resolution time
    const estimatedResolution = this.calculateEstimatedResolution(severity, exceptionType);

    const result = await pool.query(
      `INSERT INTO exceptions 
      (shipment_id, order_id, exception_type, description, severity, 
       status, priority, assigned_to, estimated_resolution_time)
      VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, $8)
      RETURNING *`,
      [
        shipmentId,
        orderId,
        exceptionType,
        description,
        severity,
        priority,
        assignedTo,
        estimatedResolution
      ]
    );

    const exception = result.rows[0];

    logEvent('ExceptionCreated', {
      exceptionId: exception.id,
      exceptionType,
      severity,
      priority,
      shipmentId,
      orderId
    });

    // Check if auto-escalation is needed
    if (priority <= 2 || severity === 'critical') {
      await this.escalateException(exception.id, 1, 'Auto-escalated due to high priority/severity');
    }

    return exception;
  }

  /**
   * Calculate priority (1-10) based on severity and type
   * Lower number = higher priority
   */
  calculatePriority(severity, exceptionType) {
    const severityScores = {
      'critical': 1,
      'high': 3,
      'medium': 5,
      'low': 7
    };

    const typeScores = {
      'lost_shipment': 0,
      'damage': 0,
      'delay': 1,
      'address_issue': 2,
      'carrier_issue': 1
    };

    const basePriority = severityScores[severity] || 5;
    const typeAdjustment = typeScores[exceptionType] || 0;

    return Math.max(1, Math.min(10, basePriority + typeAdjustment));
  }

  /**
   * Calculate estimated resolution time based on exception characteristics
   */
  calculateEstimatedResolution(severity, exceptionType) {
    const resolutionHours = {
      'critical': 4,
      'high': 24,
      'medium': 48,
      'low': 72
    };

    const hours = resolutionHours[severity] || 48;
    const estimatedTime = new Date();
    estimatedTime.setHours(estimatedTime.getHours() + hours);

    return estimatedTime;
  }

  /**
   * Escalate exception to higher level
   */
  async escalateException(exceptionId, escalationLevel, reason, escalatedTo = null) {
    const result = await pool.query(
      `UPDATE exceptions
       SET escalation_level = $1,
           escalated_at = NOW(),
           escalated_to = $2,
           priority = GREATEST(1, priority - 2)
       WHERE id = $3
       RETURNING *`,
      [escalationLevel, escalatedTo, exceptionId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Exception not found');
    }

    logEvent('ExceptionEscalated', {
      exceptionId,
      escalationLevel,
      reason,
      escalatedTo
    });

    return result.rows[0];
  }

  /**
   * Auto-escalate overdue exceptions
   * Run this periodically (every hour recommended)
   */
  async autoEscalateOverdueExceptions() {
    // Find exceptions that are past their estimated resolution time
    const overdueResult = await pool.query(
      `SELECT *
       FROM exceptions
       WHERE status IN ('open', 'investigating')
       AND estimated_resolution_time < NOW()
       AND escalation_level < 3
       ORDER BY priority ASC, created_at ASC`
    );

    const escalated = [];

    for (const exception of overdueResult.rows) {
      const newLevel = exception.escalation_level + 1;
      
      try {
        const escalatedEx = await this.escalateException(
          exception.id,
          newLevel,
          `Auto-escalated: Exceeded estimated resolution time`
        );
        escalated.push(escalatedEx);
      } catch (error) {
        console.error(`Failed to escalate exception ${exception.id}:`, error);
      }
    }

    if (escalated.length > 0) {
      logEvent('AutoEscalationCompleted', {
        count: escalated.length,
        exceptions: escalated.map(e => e.id)
      });
    }

    return escalated;
  }

  /**
   * Assign or reassign exception to user
   */
  async assignException(exceptionId, userId) {
    const result = await pool.query(
      `UPDATE exceptions
       SET assigned_to = $1,
           status = CASE WHEN status = 'open' THEN 'investigating' ELSE status END
       WHERE id = $2
       RETURNING *`,
      [userId, exceptionId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Exception not found');
    }

    logEvent('ExceptionAssigned', {
      exceptionId,
      assignedTo: userId
    });

    return result.rows[0];
  }

  /**
   * Resolve exception with root cause and resolution
   */
  async resolveException(exceptionId, resolution, resolutionNotes, rootCause, resolvedBy) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE exceptions
         SET status = 'resolved',
             resolution = $1,
             resolution_notes = $2,
             root_cause = $3,
             resolved_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [resolution, resolutionNotes, rootCause, exceptionId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Exception not found');
      }

      const exception = result.rows[0];

      // If resolution is 'reship', create new shipment
      if (resolution === 'reship' && exception.order_id) {
        // Logic to create replacement shipment would go here
        logEvent('ExceptionResolved_Reship', {
          exceptionId,
          orderId: exception.order_id
        });
      }

      // If resolution is 'refund', initiate refund process
      if (resolution === 'refund' && exception.order_id) {
        // Logic to initiate refund would go here
        logEvent('ExceptionResolved_Refund', {
          exceptionId,
          orderId: exception.order_id
        });
      }

      await client.query('COMMIT');

      logEvent('ExceptionResolved', {
        exceptionId,
        resolution,
        rootCause,
        resolvedBy
      });

      return exception;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get exception statistics by type and severity
   */
  async getExceptionStatistics(startDate, endDate) {
    // Overall statistics
    const overallResult = await pool.query(
      `SELECT 
        COUNT(*) as total_exceptions,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open,
        COUNT(CASE WHEN status = 'investigating' THEN 1 END) as investigating,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
        COUNT(CASE WHEN status = 'escalated' THEN 1 END) as escalated,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours
       FROM exceptions
       WHERE created_at >= $1 AND created_at < $2`,
      [startDate, endDate]
    );

    // By severity
    const severityResult = await pool.query(
      `SELECT severity, COUNT(*) as count
       FROM exceptions
       WHERE created_at >= $1 AND created_at < $2
       GROUP BY severity
       ORDER BY 
         CASE severity 
           WHEN 'critical' THEN 1 
           WHEN 'high' THEN 2 
           WHEN 'medium' THEN 3 
           WHEN 'low' THEN 4 
         END`,
      [startDate, endDate]
    );

    // By type
    const typeResult = await pool.query(
      `SELECT exception_type, COUNT(*) as count,
              AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours
       FROM exceptions
       WHERE created_at >= $1 AND created_at < $2
       GROUP BY exception_type
       ORDER BY count DESC`,
      [startDate, endDate]
    );

    // By root cause
    const rootCauseResult = await pool.query(
      `SELECT root_cause, COUNT(*) as count
       FROM exceptions
       WHERE created_at >= $1 AND created_at < $2
       AND root_cause IS NOT NULL
       GROUP BY root_cause
       ORDER BY count DESC
       LIMIT 10`,
      [startDate, endDate]
    );

    return {
      overall: overallResult.rows[0],
      bySeverity: severityResult.rows,
      byType: typeResult.rows,
      byRootCause: rootCauseResult.rows
    };
  }

  /**
   * Get high priority exceptions requiring immediate attention
   */
  async getHighPriorityExceptions() {
    const result = await pool.query(
      `SELECT e.*, 
              s.tracking_number,
              o.order_number,
              u.name as assigned_to_name
       FROM exceptions e
       LEFT JOIN shipments s ON s.id = e.shipment_id
       LEFT JOIN orders o ON o.id = e.order_id
       LEFT JOIN users u ON u.id = e.assigned_to
       WHERE e.status IN ('open', 'investigating')
       AND (e.priority <= 3 OR e.severity = 'critical')
       ORDER BY e.priority ASC, e.created_at ASC
       LIMIT 20`
    );

    return result.rows;
  }

  /**
   * Auto-detect potential exceptions from shipment delays
   * Run this periodically
   */
  async autoDetectDelayExceptions() {
    // Find shipments that are significantly delayed but no exception exists
    const delayedResult = await pool.query(
      `SELECT s.*
       FROM shipments s
       WHERE s.status NOT IN ('delivered', 'returned', 'cancelled')
       AND s.delivery_scheduled < NOW() - INTERVAL '24 hours'
       AND NOT EXISTS (
         SELECT 1 FROM exceptions e 
         WHERE e.shipment_id = s.id AND e.exception_type = 'delay'
       )
       LIMIT 50`
    );

    const createdExceptions = [];

    for (const shipment of delayedResult.rows) {
      const now = new Date();
      const scheduled = new Date(shipment.delivery_scheduled);
      const delayHours = (now - scheduled) / (1000 * 60 * 60);

      // Determine severity based on delay
      let severity = 'low';
      if (delayHours > 72) severity = 'critical';
      else if (delayHours > 48) severity = 'high';
      else if (delayHours > 24) severity = 'medium';

      try {
        const exception = await this.createException({
          shipmentId: shipment.id,
          orderId: shipment.order_id,
          exceptionType: 'delay',
          description: `Shipment delayed by ${Math.round(delayHours)} hours`,
          severity
        });

        createdExceptions.push(exception);
      } catch (error) {
        console.error(`Failed to create delay exception for shipment ${shipment.id}:`, error);
      }
    }

    if (createdExceptions.length > 0) {
      logEvent('DelayExceptionsAutoDetected', {
        count: createdExceptions.length
      });
    }

    return createdExceptions;
  }
}

export default new ExceptionService();
