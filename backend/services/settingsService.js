// Settings service - handles user profile, password, notifications, and session management
import pool from '../config/db.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { withTransaction } from '../utils/dbTransaction.js';

export const settingsService = {
  // Update user profile fields
  // Email changes are staged: the new address is saved as pending_email and the
  // user receives a verification token that must be confirmed before the change applies.
  async updateUserProfile(userId, updates) {
    const allowedFields = ['name', 'phone', 'company', 'avatar']; // email handled separately
    const fields = [];
    const values = [];
    let paramCount = 1;

    let pendingEmailToken = null;
    let pendingEmailAddress = null;

    // If email is being changed, stage it — do NOT apply it directly.
    if (updates.email) {
      // Check new address is not already taken
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [updates.email, userId]
      );
      if (emailCheck.rows.length > 0) {
        throw new Error('Email already in use');
      }

      // Also check it is not already a pending change for another user
      const pendingCheck = await pool.query(
        'SELECT id FROM users WHERE pending_email = $1 AND id != $2',
        [updates.email, userId]
      );
      if (pendingCheck.rows.length > 0) {
        throw new Error('Email already in use');
      }

      pendingEmailAddress = updates.email;
      pendingEmailToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

      await pool.query(
        `UPDATE users
         SET pending_email = $1, email_change_token = $2, email_change_expires = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [pendingEmailAddress, pendingEmailToken, expiresAt, userId]
      );
    }

    // Build dynamic update query for non-email fields
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    let updatedUser;
    if (fields.length > 0) {
      values.push(userId);
      const query = `
        UPDATE users 
        SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramCount}
        RETURNING id, username, email, name, phone, company, avatar, role, pending_email, created_at, updated_at
      `;
      const result = await pool.query(query, values);
      updatedUser = result.rows[0];
    } else {
      // Only an email change was requested — fetch the current user so we can return it
      const result = await pool.query(
        'SELECT id, username, email, name, phone, company, avatar, role, pending_email, created_at, updated_at FROM users WHERE id = $1',
        [userId]
      );
      updatedUser = result.rows[0];
    }

    // Attach token info so the controller can send the verification email
    if (pendingEmailToken) {
      updatedUser._emailChangeToken = pendingEmailToken;
      updatedUser._pendingEmail = pendingEmailAddress;
    }

    return updatedUser;
  },

  // Confirm an email change using the token that was emailed to the new address.
  // Sets users.email = pending_email and clears the pending_* columns.
  async verifyEmailChange(token) {
    const now = new Date();
    const result = await pool.query(
      `UPDATE users
       SET email             = pending_email,
           pending_email     = NULL,
           email_change_token = NULL,
           email_change_expires = NULL,
           email_verified    = TRUE,
           updated_at        = CURRENT_TIMESTAMP
       WHERE email_change_token = $1
         AND email_change_expires > $2
       RETURNING id, username, email, name, role`,
      [token, now]
    );

    if (result.rowCount === 0) {
      throw new Error('Invalid or expired email verification token');
    }

    return result.rows[0];
  },

  // Change user password
  async changePassword(userId, currentPassword, newPassword) {
    // Validate new password strength
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    return withTransaction(async (tx) => {
      // Get current password hash (lock the row to prevent concurrent changes)
      const userResult = await tx.query(
        'SELECT password_hash FROM users WHERE id = $1 FOR UPDATE',
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

      // Update password and bump token_version to invalidate stateless tokens
      await tx.query(
        `UPDATE users
         SET password_hash = $1,
             token_version = COALESCE(token_version, 0) + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [newPasswordHash, userId]
      );

      // TASK-R8-002: Revoke ALL active sessions so existing JWTs are immediately invalid.
      // Fetch sessions that have a stored jti for blocklisting.
      const sessions = await tx.query(
        `UPDATE user_sessions
         SET is_active = false
         WHERE user_id = $1 AND is_active = true
         RETURNING jti, expires_at`,
        [userId]
      );

      // Bulk-insert JTIs into revoked_tokens for any session that carried one
      const jtisToRevoke = sessions.rows
        .filter(s => s.jti)
        .map(s => ({
          jti: s.jti,
          // Use session expiry if available, otherwise default to 24 h from now
          expiresAt: s.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000)
        }));

      if (jtisToRevoke.length > 0) {
        const placeholders = jtisToRevoke
          .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
          .join(', ');
        const flatParams = jtisToRevoke.flatMap(({ jti, expiresAt }) => [jti, userId, expiresAt]);
        await tx.query(
          `INSERT INTO revoked_tokens (jti, user_id, expires_at)
           VALUES ${placeholders}
           ON CONFLICT (jti) DO NOTHING`,
          flatParams
        );
      }

      // Create audit log (inside same transaction — rolls back together on failure)
      await tx.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, 'password_changed', 'user', $1, '{"event": "password_changed"}')`,
        [userId]
      );

      return { success: true };
    });
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

  // Revoke a session — marks it inactive AND blocklists the associated JWT so it is
  // rejected even while it would still pass signature verification.
  async revokeSession(userId, sessionId, jti = null, tokenExpiresAt = null) {
    const result = await pool.query(
      `UPDATE user_sessions 
       SET is_active = false 
       WHERE id = $1 AND user_id = $2
       RETURNING id, jti`,
      [sessionId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Session not found or does not belong to user');
    }

    // Blocklist the JWT by its jti so requests using this token are rejected immediately.
    // Prefer the jti stored on the session row; fall back to the one supplied by the caller.
    const revokedJti = result.rows[0].jti || jti;
    if (revokedJti) {
      // Store until natural expiry (default 15 min from now when exact exp is unknown)
      const expiresAt = tokenExpiresAt
        ? new Date(tokenExpiresAt * 1000)
        : new Date(Date.now() + 15 * 60 * 1000);

      await pool.query(
        `INSERT INTO revoked_tokens (jti, user_id, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (jti) DO NOTHING`,
        [revokedJti, userId, expiresAt]
      );
    }

    return { success: true };
  }
};
