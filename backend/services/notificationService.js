// Notification Service - Handles in-app, email, and SMS notifications
import pool from '../configs/db.js';
import logger from '../utils/logger.js';

export const notificationService = {
  /**
   * Create a new notification
   */
  async createNotification(userId, type, title, message, link = null, metadata = null) {
    try {
      const result = await pool.query(
        `INSERT INTO notifications 
         (user_id, type, title, message, link, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, type, title, message, link, JSON.stringify(metadata)]
      );
      
      logger.info('Notification created', {
        userId,
        type,
        notificationId: result.rows[0].id
      });
      
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create notification:', error);
      throw error;
    }
  },

  /**
   * Create notifications for multiple users
   */
  async createBulkNotifications(userIds, type, title, message, link = null, metadata = null) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const notifications = [];
      
      for (const userId of userIds) {
        const result = await client.query(
          `INSERT INTO notifications 
           (user_id, type, title, message, link, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [userId, type, title, message, link, JSON.stringify(metadata)]
        );
        
        notifications.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      
      logger.info('Bulk notifications created', {
        count: notifications.length,
        type
      });
      
      return notifications;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create bulk notifications:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Get notifications for a user
   */
  async getUserNotifications(userId, filters = {}, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const conditions = ['user_id = $1'];
    const params = [userId];
    let paramCount = 2;

    if (filters.isRead !== undefined) {
      conditions.push(`is_read = $${paramCount++}`);
      params.push(filters.isRead);
    }

    if (filters.type) {
      conditions.push(`type = $${paramCount++}`);
      params.push(filters.type);
    }

    const whereClause = conditions.join(' AND ');
    params.push(limit, offset);

    const query = `
      SELECT * FROM notifications
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM notifications WHERE ${whereClause}`;
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const totalCount = parseInt(countResult.rows[0].count);

    return {
      notifications: result.rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        unreadCount: await this.getUnreadCount(userId)
      }
    };
  },

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = true 
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Notification not found');
    }

    return result.rows[0];
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId) {
    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = true 
       WHERE user_id = $1 AND is_read = false
       RETURNING id`,
      [userId]
    );

    return result.rowCount;
  },

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId, userId) {
    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );

    if (result.rowCount === 0) {
      throw new Error('Notification not found');
    }

    return true;
  },

  /**
   * Delete all notifications for a user
   */
  async deleteAllNotifications(userId) {
    const result = await pool.query(
      'DELETE FROM notifications WHERE user_id = $1',
      [userId]
    );

    return result.rowCount;
  },

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId) {
    const result = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    return parseInt(result.rows[0].count);
  },

  /**
   * Get notification preferences for a user
   */
  async getPreferences(userId) {
    const result = await pool.query(
      'SELECT notification_preferences FROM user_settings WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Return default preferences
      return {
        email: {
          order_updates: true,
          shipment_updates: true,
          sla_alerts: true,
          exception_alerts: true,
          return_updates: true
        },
        push: {
          order_updates: true,
          shipment_updates: true,
          sla_alerts: true,
          exception_alerts: true,
          return_updates: true
        },
        sms: {
          order_updates: false,
          shipment_updates: false,
          sla_alerts: true,
          exception_alerts: true,
          return_updates: false
        }
      };
    }

    return result.rows[0].notification_preferences || {};
  },

  /**
   * Update notification preferences for a user
   */
  async updatePreferences(userId, preferences) {
    const result = await pool.query(
      `INSERT INTO user_settings (user_id, notification_preferences)
       VALUES ($1, $2)
       ON CONFLICT (user_id) 
       DO UPDATE SET notification_preferences = $2, updated_at = NOW()
       RETURNING notification_preferences`,
      [userId, JSON.stringify(preferences)]
    );

    return result.rows[0].notification_preferences;
  },

  /**
   * Check if user should receive notification based on preferences
   */
  async shouldNotify(userId, notificationType, channel = 'push') {
    const preferences = await this.getPreferences(userId);
    
    if (!preferences[channel]) {
      return true; // Default to sending if no preference set
    }

    return preferences[channel][notificationType] !== false;
  }
};

export default notificationService;
