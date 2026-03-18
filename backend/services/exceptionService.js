// Exception Management Service - Priority handling and escalation
import { withTransaction } from '../utils/dbTransaction.js';
import { NotFoundError } from '../errors/index.js';
import logger, { logEvent } from '../utils/logger.js';
import exceptionRepo from '../repositories/ExceptionRepository.js';

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

    const exception = await exceptionRepo.create({
      shipmentId,
      orderId,
      exceptionType,
      description,
      severity,
      priority,
      assignedTo,
      estimatedResolutionTime: estimatedResolution
    });

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
    const result = await exceptionRepo.escalate(exceptionId, escalationLevel, escalatedTo);

    if (!result) {
      throw new NotFoundError('Exception not found');
    }

    logEvent('ExceptionEscalated', {
      exceptionId,
      escalationLevel,
      reason,
      escalatedTo
    });

    return result;
  }

  /**
   * Auto-escalate overdue exceptions
   * Run this periodically (every hour recommended)
   */
  async autoEscalateOverdueExceptions() {
    // Find exceptions that are past their estimated resolution time
    const overdueResult = await exceptionRepo.findOverdue();

    const outcomes = await Promise.allSettled(
      overdueResult.map((exception) => {
        const newLevel = exception.escalation_level + 1;
        return this.escalateException(
          exception.id,
          newLevel,
          'Auto-escalated: Exceeded estimated resolution time'
        );
      })
    );

    const escalated = [];
    outcomes.forEach((outcome, idx) => {
      if (outcome.status === 'fulfilled') {
        escalated.push(outcome.value);
        return;
      }
      logger.error('Failed to auto-escalate exception', {
        exceptionId: overdueResult[idx]?.id,
        error: outcome.reason?.message || String(outcome.reason),
      });
    });

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
    const result = await exceptionRepo.assign(exceptionId, userId);

    if (!result) {
      throw new NotFoundError('Exception not found');
    }

    logEvent('ExceptionAssigned', {
      exceptionId,
      assignedTo: userId
    });

    return result;
  }

  /**
   * Resolve exception with root cause and resolution
   */
  async resolveException(exceptionId, resolution, resolutionNotes, rootCause, resolvedBy) {
    return withTransaction(async (tx) => {

      const result = await exceptionRepo.resolve(exceptionId, { resolution, resolutionNotes, rootCause }, tx);

      if (!result) {
        throw new NotFoundError('Exception not found');
      }

      const exception = result;

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


      logEvent('ExceptionResolved', {
        exceptionId,
        resolution,
        rootCause,
        resolvedBy
      });

      return exception;

    });
  }

  /**
   * Get exception statistics by type and severity
   */
  async getExceptionStatistics(startDate, endDate, organizationId = undefined) {
    return exceptionRepo.getStatistics(startDate, endDate, organizationId);
  }

  /**
   * Get high priority exceptions requiring immediate attention
   */
  async getHighPriorityExceptions(organizationId = undefined) {
    return exceptionRepo.findHighPriority(organizationId);
  }

  /**
   * Auto-detect potential exceptions from shipment delays
   * Run this periodically
   */
  async autoDetectDelayExceptions() {
    // Find shipments that are significantly delayed but no exception exists
    const delayedResult = await exceptionRepo.findDelayedShipmentsWithoutException();

    const delayOutcomes = await Promise.allSettled(
      delayedResult.map((shipment) => {
        const now = new Date();
        const scheduled = new Date(shipment.delivery_scheduled);
        const delayHours = (now - scheduled) / (1000 * 60 * 60);

        let severity = 'low';
        if (delayHours > 72) severity = 'critical';
        else if (delayHours > 48) severity = 'high';
        else if (delayHours > 24) severity = 'medium';

        return this.createException({
          shipmentId: shipment.id,
          orderId: shipment.order_id,
          exceptionType: 'delay',
          description: `Shipment delayed by ${Math.round(delayHours)} hours`,
          severity
        });
      })
    );

    const createdExceptions = [];
    delayOutcomes.forEach((outcome, idx) => {
      if (outcome.status === 'fulfilled') {
        createdExceptions.push(outcome.value);
        return;
      }
      logger.error('Failed to create delay exception for shipment', {
        shipmentId: delayedResult[idx]?.id,
        error: outcome.reason?.message || String(outcome.reason),
      });
    });

    if (createdExceptions.length > 0) {
      logEvent('DelayExceptionsAutoDetected', {
        count: createdExceptions.length
      });
    }

    return createdExceptions;
  }
}

export default new ExceptionService();
