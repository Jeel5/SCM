// Alert Service - Manages alert rules, triggers, and escalations
import pool from '../config/db.js';
import notificationService from './notificationService.js';
import { jobsService } from './jobsService.js';
import logger from '../utils/logger.js';

export const alertService = {
  /**
   * Evaluate alert rules and trigger notifications
   */
  async evaluateAlerts() {
    try {
      const rules = await this.getActiveAlertRules();
      const triggeredAlerts = [];

      for (const rule of rules) {
        try {
          const shouldTrigger = await this.evaluateRule(rule);
          
          if (shouldTrigger) {
            const alert = await this.triggerAlert(rule);
            triggeredAlerts.push(alert);
          }
        } catch (error) {
          logger.error(`Failed to evaluate rule ${rule.id}:`, error);
        }
      }

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
    const result = await pool.query(
      `SELECT * FROM alert_rules 
       WHERE is_active = true 
       ORDER BY priority ASC`
    );

    return result.rows;
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
    const client = await pool.connect();
    let alert = null;

    // ── Transactional section: dedup check + alert INSERT ────────────────────
    try {
      await client.query('BEGIN');

      // Dedup / cooldown check — skip if the same rule already fired recently.
      // Parameterize the interval multiplier to avoid INTERVAL interpolation.
      const cooldownMinutes = rule.cooldown_minutes || 60;
      const recentAlert = await client.query(
        `SELECT id FROM alerts
         WHERE rule_id = $1
           AND triggered_at > NOW() - ($2 * INTERVAL '1 minute')
         ORDER BY triggered_at DESC
         LIMIT 1`,
        [rule.id, cooldownMinutes]
      );

      if (recentAlert.rows.length > 0) {
        await client.query('ROLLBACK');
        client.release();
        logger.debug('Alert suppressed by cooldown', {
          ruleId: rule.id,
          ruleName: rule.name,
          cooldownMinutes,
          existingAlertId: recentAlert.rows[0].id
        });
        return recentAlert.rows[0]; // return existing alert without re-notifying
      }

      // Create alert record
      const alertResult = await client.query(
        `INSERT INTO alerts 
         (rule_id, rule_name, alert_type, severity, message, data, triggered_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING *`,
        [
          rule.id,
          rule.name,
          rule.rule_type,
          rule.severity,
          rule.message_template,
          JSON.stringify({}),
        ]
      );

      alert = alertResult.rows[0];

      // Commit BEFORE side-effects so the alert INSERT is durable even if
      // notification/job creation subsequently fails (TASK-R13-004).
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      client.release();
      logger.error('Failed to trigger alert:', error);
      throw error;
    }

    // Transaction committed — release the pooled client before side-effects.
    client.release();

    logger.info('Alert triggered', {
      alertId: alert.id,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
    });

    // ── Post-commit side-effects (notifications + escalation job) ─────────────
    // Running outside the transaction means a notification/job failure cannot
    // roll back the already-committed alert record (TASK-R13-004).
    const recipients = await this.getAlertRecipients(rule);

    for (const userId of recipients) {
      try {
        await notificationService.createNotification(
          userId,
          'alert',
          rule.name,
          rule.message_template,
          null,
          { alertId: alert.id, ruleId: rule.id, severity: rule.severity }
        );
      } catch (notifyErr) {
        logger.error('Failed to create alert notification', {
          userId,
          alertId: alert.id,
          error: notifyErr.message,
        });
      }
    }

    if (rule.severity === 'critical' && rule.escalation_enabled) {
      try {
        await jobsService.createJob(
          'alert_escalation',
          {
            alertId: alert.id,
            ruleId: rule.id,
            escalationLevel: 1
          },
          1, // High priority
          new Date(Date.now() + (rule.escalation_delay_minutes || 15) * 60000)
        );
      } catch (jobErr) {
        logger.error('Failed to create alert escalation job', {
          alertId: alert.id,
          error: jobErr.message,
        });
      }
    }

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
      const result = await pool.query(
        `SELECT id FROM users 
         WHERE role = ANY($1) AND is_active = true`,
        [rule.assigned_roles]
      );
      
      return result.rows.map(r => r.id);
    }

    // Default to admins scoped to the same organization
    const result = await pool.query(
      `SELECT id FROM users 
       WHERE role = 'admin' AND is_active = true${rule.organization_id ? ' AND organization_id = $1' : ''}`,
      rule.organization_id ? [rule.organization_id] : []
    );
    
    return result.rows.map(r => r.id);
  },

  /**
   * Check for SLA breaches
   */
  async checkSLABreach(threshold, conditions) {
    const result = await pool.query(
      `SELECT COUNT(*) 
       FROM sla_violations 
       WHERE status = 'pending' 
       AND created_at > NOW() - INTERVAL '1 hour'`
    );

    const count = parseInt(result.rows[0].count);
    return count >= (threshold || 5);
  },

  /**
   * Check for critical exceptions
   */
  async checkCriticalExceptions(threshold, conditions) {
    const result = await pool.query(
      `SELECT COUNT(*) 
       FROM exceptions 
       WHERE severity = 'critical' 
       AND status IN ('open', 'in_progress')
       AND created_at > NOW() - INTERVAL '1 hour'`
    );

    const count = parseInt(result.rows[0].count);
    return count >= (threshold || 3);
  },

  /**
   * Check for low stock items
   */
  async checkLowStock(threshold, conditions) {
    const result = await pool.query(
      `SELECT COUNT(*) 
       FROM inventory 
       WHERE quantity_available <= reorder_point 
       AND quantity_available > 0`
    );

    const count = parseInt(result.rows[0].count);
    return count >= (threshold || 10);
  },

  /**
   * Check for delayed orders
   */
  async checkDelayedOrders(threshold, conditions) {
    const result = await pool.query(
      `SELECT COUNT(*) 
       FROM orders 
       WHERE status NOT IN ('delivered', 'cancelled') 
       AND expected_delivery_date < CURRENT_DATE`
    );

    const count = parseInt(result.rows[0].count);
    return count >= (threshold || 20);
  },

  /**
   * Check for stuck shipments
   */
  async checkStuckShipments(threshold, conditions) {
    // Aggregate MAX(event_time) per shipment before LEFT JOIN to prevent duplicate
    // COUNT rows when a shipment has multiple tracking events (TASK-R13-005).
    const result = await pool.query(
      `SELECT COUNT(*)
       FROM shipments s
       LEFT JOIN (
         SELECT shipment_id, MAX(event_time) AS last_event_time
         FROM shipment_events
         GROUP BY shipment_id
       ) se ON s.id = se.shipment_id
       WHERE s.status NOT IN ('delivered', 'returned', 'cancelled')
         AND s.created_at < NOW() - INTERVAL '24 hours'
         AND (se.shipment_id IS NULL OR se.last_event_time < NOW() - INTERVAL '48 hours')`
    );

    const count = parseInt(result.rows[0].count);
    return count >= (threshold || 10);
  },

  /**
   * Check carrier performance
   */
  async checkCarrierPerformance(threshold, conditions) {
    const result = await pool.query(
      `SELECT c.id, c.name,
       COUNT(s.id) as total_shipments,
       COUNT(CASE WHEN s.actual_delivery_date > s.expected_delivery_date THEN 1 END) as delayed,
       CAST(COUNT(CASE WHEN s.actual_delivery_date <= s.expected_delivery_date THEN 1 END) AS FLOAT) / 
       NULLIF(COUNT(s.id), 0) * 100 as on_time_rate
       FROM carriers c
       JOIN shipments s ON c.id = s.carrier_id
       WHERE s.status = 'delivered'
       AND s.actual_delivery_date > NOW() - INTERVAL '7 days'
       GROUP BY c.id, c.name
       HAVING CAST(COUNT(CASE WHEN s.actual_delivery_date <= s.expected_delivery_date THEN 1 END) AS FLOAT) / 
              NULLIF(COUNT(s.id), 0) * 100 < $1`,
      [threshold || 85]
    );

    return result.rows.length > 0;
  },

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId, userId, organizationId = undefined) {
    const result = await pool.query(
      `UPDATE alerts 
       SET status = 'acknowledged', 
           acknowledged_by = $2, 
           acknowledged_at = NOW()
       WHERE id = $1${organizationId ? ' AND organization_id = $3' : ''}
       RETURNING *`,
      organizationId ? [alertId, userId, organizationId] : [alertId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Alert not found');
    }

    return result.rows[0];
  },

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId, userId, resolution, organizationId = undefined) {
    const result = await pool.query(
      `UPDATE alerts 
       SET status = 'resolved', 
           resolved_by = $2, 
           resolved_at = NOW(),
           resolution = $3
       WHERE id = $1${organizationId ? ' AND organization_id = $4' : ''}
       RETURNING *`,
      organizationId ? [alertId, userId, resolution, organizationId] : [alertId, userId, resolution]
    );

    if (result.rows.length === 0) {
      throw new Error('Alert not found');
    }

    return result.rows[0];
  },

  /**
   * Get alerts with filtering
   */
  async getAlerts(filters = {}, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
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

    const query = `
      SELECT a.*, ar.name as rule_name
      FROM alerts a
      LEFT JOIN alert_rules ar ON a.rule_id = ar.id
      ${whereClause}
      ORDER BY triggered_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    const result = await pool.query(query, params);

    const countQuery = `SELECT COUNT(*) FROM alerts ${whereClause}`;
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const totalCount = parseInt(countResult.rows[0].count);

    return {
      alerts: result.rows,
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
