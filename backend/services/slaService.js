// SLA Monitoring Service - Automated breach detection and penalty calculation
import pool from '../configs/db.js';
import { logEvent } from '../utils/logger.js';

class SLAService {
  /**
   * Monitor all active shipments for SLA violations
   * Run this periodically (every hour recommended)
   */
  async monitorSLAViolations() {
    const violations = [];

    // Get all active shipments that haven't been delivered
    const shipmentsResult = await pool.query(
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
       )`
    );

    for (const shipment of shipmentsResult.rows) {
      const violation = await this.detectViolation(shipment);
      if (violation) {
        violations.push(violation);
      }
    }

    if (violations.length > 0) {
      logEvent('SLAViolationsDetected', { count: violations.length });
    }

    return violations;
  }

  /**
   * Detect if a shipment has violated SLA
   */
  async detectViolation(shipment) {
    const now = new Date();
    const scheduledDelivery = new Date(shipment.delivery_scheduled);

    if (now <= scheduledDelivery) {
      return null; // Not violated yet
    }

    const delayHours = (now - scheduledDelivery) / (1000 * 60 * 60);

    // Calculate penalty
    const penalty = await this.calculatePenalty(
      delayHours,
      shipment.penalty_per_hour,
      shipment.shipping_cost
    );

    // Create SLA violation record
    const result = await pool.query(
      `INSERT INTO sla_violations 
      (shipment_id, sla_policy_id, promised_delivery, delay_hours, penalty_amount, reason, status, detected_at, detection_method)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
      RETURNING *`,
      [
        shipment.id,
        shipment.policy_id,
        scheduledDelivery,
        delayHours.toFixed(2),
        penalty,
        'Late delivery',
        'open',
        'automated'
      ]
    );

    logEvent('SLAViolationCreated', {
      shipmentId: shipment.id,
      trackingNumber: shipment.tracking_number,
      delayHours: delayHours.toFixed(2),
      penalty
    });

    return result.rows[0];
  }

  /**
   * Calculate penalty amount for SLA violation
   */
  async calculatePenalty(delayHours, penaltyPerHour, shippingCost) {
    // Base penalty calculation
    let penalty = delayHours * penaltyPerHour;

    // Cap penalty at shipping cost (configurable business rule)
    penalty = Math.min(penalty, shippingCost * 0.5); // Max 50% of shipping cost

    // Round to 2 decimal places
    return Math.round(penalty * 100) / 100;
  }

  /**
   * Calculate performance score for a carrier
   * Score: 0-100 based on on-time delivery rate and SLA compliance
   */
  async calculateCarrierPerformance(carrierId, periodStart, periodEnd) {
    // Get shipment statistics
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as total_shipments,
        COUNT(CASE WHEN status = 'delivered' AND delivery_actual <= delivery_scheduled THEN 1 END) as on_time,
        COUNT(CASE WHEN status = 'delivered' AND delivery_actual > delivery_scheduled THEN 1 END) as late,
        COUNT(CASE WHEN status = 'failed_delivery' THEN 1 END) as failed
       FROM shipments
       WHERE carrier_id = $1
       AND created_at >= $2 AND created_at < $3`,
      [carrierId, periodStart, periodEnd]
    );

    const stats = statsResult.rows[0];
    const total = parseInt(stats.total_shipments);

    if (total === 0) {
      return { score: 75, reliability: 0.75 }; // Default for new carriers
    }

    const onTime = parseInt(stats.on_time);
    const late = parseInt(stats.late);
    const failed = parseInt(stats.failed);

    // Calculate on-time delivery rate (0-100)
    const onTimeRate = (onTime / total) * 100;

    // Calculate failure penalty
    const failureRate = (failed / total) * 100;
    const failurePenalty = failureRate * 5; // 5 points per 1% failure rate

    // Get SLA violations count
    const violationsResult = await pool.query(
      `SELECT COUNT(*) as violation_count, COALESCE(SUM(penalty_amount), 0) as total_penalties
       FROM sla_violations sv
       JOIN shipments s ON s.id = sv.shipment_id
       WHERE s.carrier_id = $1
       AND sv.created_at >= $2 AND sv.created_at < $3`,
      [carrierId, periodStart, periodEnd]
    );

    const violations = violationsResult.rows[0];
    const violationCount = parseInt(violations.violation_count);
    const violationRate = (violationCount / total) * 100;
    const violationPenalty = violationRate * 3; // 3 points per 1% violation rate

    // Final performance score
    let performanceScore = onTimeRate - failurePenalty - violationPenalty;
    performanceScore = Math.max(0, Math.min(100, performanceScore));

    // Reliability score (0.00 to 1.00)
    const reliabilityScore = performanceScore / 100;

    // Store metrics
    await pool.query(
      `INSERT INTO carrier_performance_metrics 
      (carrier_id, period_start, period_end, total_shipments, on_time_deliveries, 
       late_deliveries, failed_deliveries, sla_violations, total_penalties, 
       performance_score, reliability_score)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (carrier_id, period_start, period_end)
      DO UPDATE SET
        total_shipments = EXCLUDED.total_shipments,
        on_time_deliveries = EXCLUDED.on_time_deliveries,
        late_deliveries = EXCLUDED.late_deliveries,
        failed_deliveries = EXCLUDED.failed_deliveries,
        sla_violations = EXCLUDED.sla_violations,
        total_penalties = EXCLUDED.total_penalties,
        performance_score = EXCLUDED.performance_score,
        reliability_score = EXCLUDED.reliability_score,
        calculated_at = NOW()`,
      [
        carrierId,
        periodStart,
        periodEnd,
        total,
        onTime,
        late,
        failed,
        violationCount,
        violations.total_penalties,
        performanceScore.toFixed(2),
        reliabilityScore.toFixed(2)
      ]
    );

    logEvent('CarrierPerformanceCalculated', {
      carrierId,
      score: performanceScore.toFixed(2),
      onTimeRate: ((onTime / total) * 100).toFixed(1) + '%'
    });

    return {
      score: performanceScore,
      reliability: reliabilityScore,
      stats: {
        total,
        onTime,
        late,
        failed,
        violations: violationCount
      }
    };
  }

  /**
   * Apply penalty to invoice
   */
  async applyPenalty(violationId, approvedBy) {
    const result = await pool.query(
      `UPDATE sla_violations
       SET penalty_applied = true,
           penalty_calculated_at = NOW(),
           penalty_approved_by = $1
       WHERE id = $2
       RETURNING *`,
      [approvedBy, violationId]
    );

    if (result.rows.length > 0) {
      logEvent('PenaltyApplied', {
        violationId,
        amount: result.rows[0].penalty_amount,
        approvedBy
      });
    }

    return result.rows[0];
  }

  /**
   * Waive penalty with reason
   */
  async waivePenalty(violationId, reason, waivedBy) {
    const result = await pool.query(
      `UPDATE sla_violations
       SET status = 'waived',
           waiver_reason = $1,
           resolved_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [reason, violationId]
    );

    if (result.rows.length > 0) {
      logEvent('PenaltyWaived', {
        violationId,
        reason,
        waivedBy
      });
    }

    return result.rows[0];
  }

  /**
   * Resolve SLA violation
   */
  async resolveViolation(violationId, resolution) {
    const result = await pool.query(
      `UPDATE sla_violations
       SET status = 'resolved',
           resolved_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [violationId]
    );

    return result.rows[0];
  }

  /**
   * Get carrier performance summary
   */
  async getCarrierPerformanceSummary(carrierId, days = 30) {
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);

    return await this.calculateCarrierPerformance(
      carrierId,
      periodStart.toISOString(),
      new Date().toISOString()
    );
  }
}

export default new SLAService();
