// Notification Service - Handles in-app, email, and SMS notifications
import notificationRepository from '../repositories/NotificationRepository.js';
import { withTransaction } from '../utils/dbTransaction.js';
import logger from '../utils/logger.js';
import { NotFoundError } from '../errors/AppError.js';
import { emitToUser } from '../sockets/emitter.js';

export const notificationService = {
  /**
   * Create a new notification
   */
  async createNotification(userId, type, title, message, link = null, metadata = null) {
    try {
      const notification = await notificationRepository.create(userId, type, title, message, link, metadata);

      // Push the new notification to the recipient in realtime.
      emitToUser(userId, 'notification:new', {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        created_at: notification.created_at,
      });

      logger.info('Notification created', {
        userId,
        type,
        notificationId: notification.id
      });

      return notification;
    } catch (error) {
      logger.error('Failed to create notification:', error);
      throw error;
    }
  },

  /**
   * Create notifications for multiple users
   */
  async createBulkNotifications(userIds, type, title, message, link = null, metadata = null) {
    return withTransaction(async (tx) => {
      
      const notifications = [];

      for (const userId of userIds) {
        const notification = await notificationRepository.create(userId, type, title, message, link, metadata, tx);
        notifications.push(notification);
      }

      logger.info('Bulk notifications created', {
        count: notifications.length,
        type
      });

      return notifications;
    });
  },

  /**
   * Get notifications for a user
   */
  async getUserNotifications(userId, filters = {}, page = 1, limit = 20) {
    const [rows, totalCount] = await Promise.all([
      notificationRepository.findByUser(userId, filters, page, limit),
      notificationRepository.countByUser(userId, filters),
    ]);

    return {
      notifications: rows,
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
    const row = await notificationRepository.markAsRead(notificationId, userId);

    if (!row) {
      throw new NotFoundError('Notification');
    }

    return row;
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId) {
    return notificationRepository.markAllAsRead(userId);
  },

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId, userId) {
    const count = await notificationRepository.deleteById(notificationId, userId);

    if (count === 0) {
      throw new NotFoundError('Notification');
    }

    return true;
  },

  /**
   * Delete all notifications for a user
   */
  async deleteAllNotifications(userId) {
    return notificationRepository.deleteAllByUser(userId);
  },

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId) {
    return notificationRepository.countUnread(userId);
  },

  /**
   * Get notification preferences for a user
   */
  async getPreferences(userId) {
    const row = await notificationRepository.findPreferences(userId);

    if (!row) {
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

    return row.notification_preferences || {};
  },

  /**
   * Update notification preferences for a user
   */
  async updatePreferences(userId, preferences) {
    return notificationRepository.upsertPreferences(userId, preferences);
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
