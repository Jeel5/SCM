// Notification Repository - SQL for notifications and user_settings tables
import BaseRepository from './BaseRepository.js';

class NotificationRepository extends BaseRepository {
  constructor() {
    super('notifications');
  }

  /**
   * Insert a new notification row.
   */
  async create(userId, type, title, message, link = null, metadata = null, client = null) {
    try {
      const result = await this.query(
        `INSERT INTO notifications
         (user_id, type, title, message, link, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, type, title, message, link, JSON.stringify(metadata)],
        client
      );
      return result.rows[0];
    } catch (error) {
      // Backward compatibility: some databases use an older notifications schema
      // without the metadata column.
      if (error?.code === '42703' && /metadata/i.test(error?.message || '')) {
        const fallback = await this.query(
          `INSERT INTO notifications
           (user_id, type, title, message, link)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [userId, type, title, message, link],
          client
        );
        return fallback.rows[0];
      }
      throw error;
    }
  }

  /**
   * Fetch a paginated list of notifications for a user, with optional filters.
   * @param {string} userId
   * @param {{ isRead?: boolean, type?: string }} filters
   * @param {number} page  - 1-based
   * @param {number} limit
   * @param {*} client
   */
  async findByUser(userId, filters = {}, page = 1, limit = 20, client = null) {
    const offset = (page - 1) * limit;
    const conditions = ['user_id = $1'];
    const params = [userId];
    let paramCount = 2;

    if (filters.isRead !== undefined) {
      conditions.push(`is_read = $${paramCount}`);
      paramCount += 1;
      params.push(filters.isRead);
    }
    if (filters.type) {
      conditions.push(`type = $${paramCount}`);
      paramCount += 1;
      params.push(filters.type);
    }

    const whereClause = conditions.join(' AND ');
    params.push(limit, offset);

    const result = await this.query(
      `SELECT * FROM notifications
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params,
      client
    );
    return result.rows;
  }

  /**
   * Count notifications for a user matching the same optional filters.
   */
  async countByUser(userId, filters = {}, client = null) {
    const conditions = ['user_id = $1'];
    const params = [userId];
    let paramCount = 2;

    if (filters.isRead !== undefined) {
      conditions.push(`is_read = $${paramCount}`);
      paramCount += 1;
      params.push(filters.isRead);
    }
    if (filters.type) {
      conditions.push(`type = $${paramCount}`);
      paramCount += 1;
      params.push(filters.type);
    }

    const whereClause = conditions.join(' AND ');
    const result = await this.query(
      `SELECT COUNT(*) FROM notifications WHERE ${whereClause}`,
      params,
      client
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Mark a single notification as read, scoped to the owning user.
   * Returns the updated row or null if not found / not owned.
   */
  async markAsRead(id, userId, client = null) {
    const result = await this.query(
      `UPDATE notifications
       SET is_read = true
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId],
      client
    );
    return result.rows[0] || null;
  }

  /**
   * Mark every unread notification for a user as read.
   * Returns the number of rows updated.
   */
  async markAllAsRead(userId, client = null) {
    const result = await this.query(
      `UPDATE notifications
       SET is_read = true
       WHERE user_id = $1 AND is_read = false
       RETURNING id`,
      [userId],
      client
    );
    return result.rowCount;
  }

  /**
   * Delete a single notification, scoped to the owning user.
   * Returns the number of rows deleted.
   */
  async deleteById(id, userId, client = null) {
    const result = await this.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [id, userId],
      client
    );
    return result.rowCount;
  }

  /**
   * Delete all notifications for a user.
   * Returns the number of rows deleted.
   */
  async deleteAllByUser(userId, client = null) {
    const result = await this.query(
      'DELETE FROM notifications WHERE user_id = $1',
      [userId],
      client
    );
    return result.rowCount;
  }

  /**
   * Count unread notifications for a user.
   */
  async countUnread(userId, client = null) {
    const result = await this.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId],
      client
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Fetch notification preferences from user_settings.
   * Returns the row or null if the user has no settings record yet.
   */
  async findPreferences(userId, client = null) {
    const result = await this.query(
      'SELECT notification_preferences FROM user_settings WHERE user_id = $1',
      [userId],
      client
    );
    return result.rows[0] || null;
  }

  /**
   * Insert or update notification preferences in user_settings.
   * Returns the stored preferences object.
   */
  async upsertPreferences(userId, preferences, client = null) {
    const result = await this.query(
      `INSERT INTO user_settings (user_id, notification_preferences)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET notification_preferences = $2, updated_at = NOW()
       RETURNING notification_preferences`,
      [userId, JSON.stringify(preferences)],
      client
    );
    return result.rows[0].notification_preferences;
  }

  /**
   * Delete read notifications older than a given date.
   */
  async deleteOldRead(cutoffDate, client = null) {
    const result = await this.query(
      'DELETE FROM notifications WHERE created_at < $1 AND is_read = true',
      [cutoffDate], client
    );
    return result.rowCount;
  }
}

export default new NotificationRepository();
