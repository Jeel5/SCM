// Settings service - handles user profile, password, notifications, and session management
import pool from '../configs/db.js';
import bcrypt from 'bcrypt';

export const settingsService = {
  // Update user profile fields
  async updateUserProfile(userId, updates) {
    const allowedFields = ['name', 'email', 'phone', 'company', 'avatar'];
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Check if email is being changed and if it's already taken
    if (updates.email) {
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [updates.email, userId]
      );
      if (emailCheck.rows.length > 0) {
        throw new Error('Email already in use');
      }
    }

    // Build dynamic update query
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(userId);
    const query = `
      UPDATE users 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING id, username, email, name, phone, company, avatar, role, created_at, updated_at
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Change user password
  async changePassword(userId, currentPassword, newPassword) {
    // Validate new password strength
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    // Get current password hash
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, userId]
    );

    // Create audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
       VALUES ($1, 'password_changed', 'user', $1, '{"event": "password_changed"}')`,
      [userId]
    );

    return { success: true };
  },

  // Get notification preferences
  async getNotificationPreferences(userId) {
    const result = await pool.query(
      'SELECT * FROM user_notification_preferences WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Return defaults if no preferences exist
      return {
        email_enabled: true,
        push_enabled: true,
        sms_enabled: false,
        notification_types: {
          orders: true,
          shipments: true,
          sla_alerts: true,
          exceptions: true,
          returns: true,
          system_updates: true
        }
      };
    }

    return result.rows[0];
  },

  // Update notification preferences
  async updateNotificationPreferences(userId, preferences) {
    const { email_enabled, push_enabled, sms_enabled, notification_types } = preferences;

    // Check if preferences exist
    const existing = await pool.query(
      'SELECT id FROM user_notification_preferences WHERE user_id = $1',
      [userId]
    );

    if (existing.rows.length === 0) {
      // Insert new preferences
      const result = await pool.query(
        `INSERT INTO user_notification_preferences 
         (user_id, email_enabled, push_enabled, sms_enabled, notification_types)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          userId,
          email_enabled ?? true,
          push_enabled ?? true,
          sms_enabled ?? false,
          JSON.stringify(notification_types ?? {})
        ]
      );
      return result.rows[0];
    } else {
      // Update existing preferences
      const fields = [];
      const values = [];
      let paramCount = 1;

      if (email_enabled !== undefined) {
        fields.push(`email_enabled = $${paramCount++}`);
        values.push(email_enabled);
      }
      if (push_enabled !== undefined) {
        fields.push(`push_enabled = $${paramCount++}`);
        values.push(push_enabled);
      }
      if (sms_enabled !== undefined) {
        fields.push(`sms_enabled = $${paramCount++}`);
        values.push(sms_enabled);
      }
      if (notification_types !== undefined) {
        fields.push(`notification_types = $${paramCount++}`);
        values.push(JSON.stringify(notification_types));
      }

      if (fields.length === 0) {
        throw new Error('No valid preferences to update');
      }

      values.push(userId);
      const query = `
        UPDATE user_notification_preferences 
        SET ${fields.join(', ')}
        WHERE user_id = $${paramCount}
        RETURNING *
      `;

      const result = await pool.query(query, values);
      return result.rows[0];
    }
  },

  // Get active sessions for user
  async getActiveSessions(userId) {
    const result = await pool.query(
      `SELECT id, device_name, ip_address, user_agent, last_active, created_at
       FROM user_sessions
       WHERE user_id = $1 AND is_active = true
       ORDER BY last_active DESC`,
      [userId]
    );

    return result.rows;
  },

  // Revoke a session
  async revokeSession(userId, sessionId) {
    const result = await pool.query(
      `UPDATE user_sessions 
       SET is_active = false 
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [sessionId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Session not found or does not belong to user');
    }

    return { success: true };
  }
};
