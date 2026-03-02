// SLA Monitoring Service - Automated breach detection and penalty calculation
import slaRepository from '../repositories/SlaRepository.js';
import { logEvent } from '../utils/logger.js';

class SLAService {
  /**
   * Monitor all active shipments for SLA violations
   * Run this periodically (every hour recommended)
   */
  async monitorSLAViolations() {
    const violations = [];

    // Get all active shipments that haven't been delivered
    const shipments = await slaRepository.findActiveShipmentsForMonitoring();

    for (const shipment of shipments) {
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
    const violation = await slaRepository.createViolation({
      organizationId: shipment.organization_id,
      shipmentId: shipment.id,
      slaPolicyId: shipment.policy_id,
      promisedDelivery: scheduledDelivery,
      delayHours: delayHours.toFixed(2),
      penaltyAmount: penalty,
      reason: 'Late delivery',
      status: 'open',
    });

    logEvent('SLAViolationCreated', {
      shipmentId: shipment.id,
      trackingNumber: shipment.tracking_number,
      delayHours: delayHours.toFixed(2),
      penalty
    });

    return violation;
  }

  /**
   * Calculate penalty amount for SLA violation
   */
  async calculatePenalty(delayHours, penaltyPerHour, shippingCost) {
    const ratePerHour = parseFloat(penaltyPerHour) || 0;
    const cost        = parseFloat(shippingCost)    || 0;

    if (ratePerHour === 0) return 0; // Policy has no penalty clause

    // Base penalty calculation
    let penalty = delayHours * ratePerHour;

    // Cap penalty at 50% of shipping cost (only when shipping cost is known)
    if (cost > 0) {
      penalty = Math.min(penalty, cost * 0.5);
    }

    // Round to 2 decimal places
    return Math.round(penalty * 100) / 100;
  }

  /**
   * Calculate performance score for a carrier
   * Score: 0-100 based on on-time delivery rate and SLA compliance
   */
  async calculateCarrierPerformance(carrierId, periodStart, periodEnd) {
    // Get shipment statistics
    const stats = await slaRepository.findCarrierShipmentStats(carrierId, periodStart, periodEnd);
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
    const violations = await slaRepository.findCarrierViolationStats(carrierId, periodStart, periodEnd);
    const violationCount = parseInt(violations.violation_count);
    const violationRate = (violationCount / total) * 100;
    const violationPenalty = violationRate * 3; // 3 points per 1% violation rate

    // Final performance score
    let performanceScore = onTimeRate - failurePenalty - violationPenalty;
    performanceScore = Math.max(0, Math.min(100, performanceScore));

    // Reliability score (0.00 to 1.00)
    const reliabilityScore = performanceScore / 100;

    // Store metrics
    await slaRepository.upsertCarrierPerformanceMetrics({
      carrierId,
      periodStart,
      periodEnd,
      totalShipments: total,
      onTime,
      late,
      failed,
      violationCount,
      totalPenalties: violations.total_penalties,
      performanceScore: performanceScore.toFixed(2),
      reliabilityScore: reliabilityScore.toFixed(2),
    });

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
    const row = await slaRepository.applyViolationPenalty(violationId, approvedBy);

    if (row) {
      logEvent('PenaltyApplied', {
        violationId,
        amount: row.penalty_amount,
        approvedBy
      });
    }

    return row;
  }

  /**
   * Waive penalty with reason
   */
  async waivePenalty(violationId, reason, waivedBy) {
    const row = await slaRepository.waiveViolationPenalty(violationId, reason);

    if (row) {
      logEvent('PenaltyWaived', {
        violationId,
        reason,
        waivedBy
      });
    }

    return row;
  }

  /**
   * Resolve SLA violation
   */
  async resolveViolation(violationId, resolution) {
    return slaRepository.resolveViolation(violationId);
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
