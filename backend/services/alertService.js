// Alert Service - Manages alert rules, triggers, and escalations
import pool from '../configs/db.js';
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
   */
  async triggerAlert(rule) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

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
          JSON.stringify({}), // Additional data can be passed
        ]
      );

      const alert = alertResult.rows[0];

      // Get recipients based on rule
      const recipients = await this.getAlertRecipients(rule);

      // Create notifications for recipients
      for (const userId of recipients) {
        await notificationService.createNotification(
          userId,
          'alert',
          rule.name,
          rule.message_template,
          null,
          { alertId: alert.id, ruleId: rule.id, severity: rule.severity }
        );
      }

      // If critical, create escalation job
      if (rule.severity === 'critical' && rule.escalation_enabled) {
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
      }

      await client.query('COMMIT');

      logger.info('Alert triggered', {
        alertId: alert.id,
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        recipients: recipients.length
      });

      return alert;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to trigger alert:', error);
      throw error;
    } finally {
      client.release();
    }
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

    // Default to all admins
    const result = await pool.query(
      `SELECT id FROM users 
       WHERE role = 'admin' AND is_active = true`
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
    const result = await pool.query(
      `SELECT COUNT(*) 
       FROM shipments s
       LEFT JOIN shipment_events se ON s.id = se.shipment_id
       WHERE s.status NOT IN ('delivered', 'returned', 'cancelled')
       AND s.created_at < NOW() - INTERVAL '24 hours'
       AND (se.id IS NULL OR se.event_time < NOW() - INTERVAL '48 hours')`
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
  async acknowledgeAlert(alertId, userId) {
    const result = await pool.query(
      `UPDATE alerts 
       SET status = 'acknowledged', 
           acknowledged_by = $2, 
           acknowledged_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [alertId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Alert not found');
    }

    return result.rows[0];
  },

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId, userId, resolution) {
    const result = await pool.query(
      `UPDATE alerts 
       SET status = 'resolved', 
           resolved_by = $2, 
           resolved_at = NOW(),
           resolution = $3
       WHERE id = $1
       RETURNING *`,
      [alertId, userId, resolution]
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
