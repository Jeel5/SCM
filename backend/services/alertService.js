// Alert Service - Manages alert rules, triggers, and escalations
import alertRepo from '../repositories/AlertRepository.js';
import notificationService from './notificationService.js';
import { jobsService } from './jobsService.js';
import { withTransaction } from '../utils/dbTransaction.js';
import logger from '../utils/logger.js';
import { NotFoundError } from '../errors/AppError.js';

export const alertService = {
  /**
   * Create a new alert unless a recent one exists inside cooldown window.
   */
  async createAlertWithCooldown(rule) {
    const cooldownMinutes = rule.cooldown_minutes || 60;

    const txResult = await withTransaction(async (tx) => {
      const recentAlertRow = await alertRepo.findRecentAlertByRule(rule.id, cooldownMinutes, tx);
      if (recentAlertRow) {
        return { suppressed: true, alert: recentAlertRow, cooldownMinutes };
      }

      const newAlert = await alertRepo.createAlert(
        rule.id,
        rule.name,
        rule.rule_type,
        rule.severity,
        rule.message_template,
        {},
        tx
      );

      return { suppressed: false, alert: newAlert, cooldownMinutes };
    });

    return txResult;
  },

  /**
   * Send alert notifications to recipients and log individual failures.
   */
  async dispatchAlertNotifications(rule, alert, recipients) {
    const notifyOutcomes = await Promise.allSettled(
      recipients.map((userId) =>
        notificationService.createNotification(
          userId,
          'alert',
          rule.name,
          rule.message_template,
          null,
          { alertId: alert.id, ruleId: rule.id, severity: rule.severity }
        )
      )
    );

    notifyOutcomes.forEach((outcome, idx) => {
      if (outcome.status === 'fulfilled') return;
      logger.error('Failed to create alert notification', {
        userId: recipients[idx],
        alertId: alert.id,
        error: outcome.reason?.message || String(outcome.reason),
      });
    });
  },

  /**
   * Enqueue escalation follow-up for critical alerts when enabled.
   */
  async maybeScheduleEscalation(rule, alert) {
    if (rule.severity !== 'critical' || !rule.escalation_enabled) {
      return;
    }

    try {
      await jobsService.createJob(
        'alert_escalation',
        {
          alertId: alert.id,
          ruleId: rule.id,
          escalationLevel: 1
        },
        1,
        new Date(Date.now() + (rule.escalation_delay_minutes || 15) * 60000)
      );
    } catch (jobErr) {
      logger.error('Failed to create alert escalation job', {
        alertId: alert.id,
        error: jobErr.message,
      });
    }
  },

  /**
   * Evaluate alert rules and trigger notifications
   */
  async evaluateAlerts() {
    try {
      const rules = await this.getActiveAlertRules();
      const outcomes = await Promise.allSettled(
        rules.map(async (rule) => {
          const shouldTrigger = await this.evaluateRule(rule);
          if (!shouldTrigger) return null;
          return this.triggerAlert(rule);
        })
      );

      const triggeredAlerts = [];
      outcomes.forEach((outcome, idx) => {
        if (outcome.status === 'fulfilled') {
          if (outcome.value) triggeredAlerts.push(outcome.value);
          return;
        }
        logger.error(`Failed to evaluate rule ${rules[idx].id}:`, outcome.reason);
      });

      logger.info(`Evaluated ${rules.length} rules, triggered ${triggeredAlerts.length} alerts`);
      
      return triggeredAlerts;
    } catch (error) {
      logger.error('Failed to evaluate alerts:', error);
      throw error;
    }
  },

  /**
   * Get all active alert rules
   */
  async getActiveAlertRules() {
    return await alertRepo.getActiveAlertRules();
  },

  /**
   * Evaluate a single alert rule
   */
  async evaluateRule(rule) {
    const { rule_type, threshold, conditions } = rule;
    
    switch (rule_type) {
      case 'sla_breach':
        return await this.checkSLABreach(threshold, conditions);
      
      case 'exception_critical':
        return await this.checkCriticalExceptions(threshold, conditions);
      
      case 'inventory_low_stock':
        return await this.checkLowStock(threshold, conditions);
      
      case 'order_delayed':
        return await this.checkDelayedOrders(threshold, conditions);
      
      case 'shipment_stuck':
        return await this.checkStuckShipments(threshold, conditions);
      
      case 'carrier_performance':
        return await this.checkCarrierPerformance(threshold, conditions);
      
      default:
        logger.warn(`Unknown rule type: ${rule_type}`);
        return false;
    }
  },

  /**
   * Trigger an alert and create notifications
   * Includes cooldown deduplication: if the same rule fired within the cooldown window,
   * the existing alert is returned and no new notifications are sent.
   */
  async triggerAlert(rule) {
    const txResult = await this.createAlertWithCooldown(rule);

    if (txResult.suppressed) {
      logger.debug('Alert suppressed by cooldown', {
        ruleId: rule.id,
        ruleName: rule.name,
        cooldownMinutes: txResult.cooldownMinutes,
        existingAlertId: txResult.alert.id
      });
      return txResult.alert;
    }

    const alert = txResult.alert;

    logger.info('Alert triggered', {
      alertId: alert.id,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
    });

    const recipients = await this.getAlertRecipients(rule);
    await this.dispatchAlertNotifications(rule, alert, recipients);
    await this.maybeScheduleEscalation(rule, alert);

    logger.info('Alert dispatched', {
      alertId: alert.id,
      ruleId: rule.id,
      recipients: recipients.length,
    });

    return alert;
  },

  /**
   * Get recipients for an alert rule
   */
  async getAlertRecipients(rule) {
    // If specific users are assigned
    if (rule.assigned_users && rule.assigned_users.length > 0) {
      return rule.assigned_users;
    }

    // If specific roles are assigned
    if (rule.assigned_roles && rule.assigned_roles.length > 0) {
      return await alertRepo.getUsersByRoles(rule.assigned_roles);
    }

    // Default to admins scoped to the same organization
    return await alertRepo.getAdminUsers(rule.organization_id || null);
  },

  /**
   * Check for SLA breaches
   */
  async checkSLABreach(threshold, conditions) {
    const count = await alertRepo.countPendingSlaViolations();
    return count >= (threshold || 5);
  },

  /**
   * Check for critical exceptions
   */
  async checkCriticalExceptions(threshold, conditions) {
    const count = await alertRepo.countCriticalExceptions();
    return count >= (threshold || 3);
  },

  /**
   * Check for low stock items
   */
  async checkLowStock(threshold, conditions) {
    const count = await alertRepo.countLowStockItems();
    return count >= (threshold || 10);
  },

  /**
   * Check for delayed orders
   */
  async checkDelayedOrders(threshold, conditions) {
    const count = await alertRepo.countDelayedOrders();
    return count >= (threshold || 20);
  },

  /**
   * Check for stuck shipments
   */
  async checkStuckShipments(threshold, conditions) {
    const count = await alertRepo.countStuckShipments();
    return count >= (threshold || 10);
  },

  /**
   * Check carrier performance
   */
  async checkCarrierPerformance(threshold, conditions) {
    const rows = await alertRepo.getUnderperformingCarriers(threshold || 85);
    return rows.length > 0;
  },

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId, userId, organizationId = undefined) {
    const row = await alertRepo.acknowledgeAlert(alertId, userId, organizationId || null);
    if (!row) {
      throw new NotFoundError('Alert');
    }
    return row;
  },

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId, userId, resolution, organizationId = undefined) {
    const row = await alertRepo.resolveAlert(alertId, userId, resolution, organizationId || null);
    if (!row) {
      throw new NotFoundError('Alert');
    }
    return row;
  },

  /**
   * Get alerts with filtering
   */
  async getAlerts(filters = {}, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const [alerts, totalCount] = await Promise.all([
      alertRepo.findAlerts(filters, limit, offset),
      alertRepo.countAlerts(filters),
    ]);

    return {
      alerts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  }
};

export default alertService;
