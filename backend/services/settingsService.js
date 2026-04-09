// Settings service - handles user profile, password, notifications, and session management
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { withTransaction } from '../utils/dbTransaction.js';
import { ConflictError, AuthenticationError, ValidationError, NotFoundError } from '../errors/index.js';
import userRepo from '../repositories/UserRepository.js';
import logger from '../utils/logger.js';

export const settingsService = {
  /**
   * Update user profile fields.
   * Email changes are staged as pending and require token verification.
   */
  async updateUserProfile(userId, updates) {
    const allowedFields = ['name', 'phone', 'company', 'avatar']; // email handled separately
    const fields = [];
    const values = [];
    let paramCount = 1;

    let pendingEmailToken = null;
    let pendingEmailAddress = null;

    // If email is being changed, stage it — do NOT apply it directly.
    if (updates.email) {
      const { emailTaken, pendingTaken } = await userRepo.checkEmailTaken(updates.email, userId);
      if (emailTaken || pendingTaken) {
        throw new ConflictError('Email already in use');
      }

      pendingEmailAddress = updates.email;
      pendingEmailToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

      await userRepo.stagePendingEmail(userId, pendingEmailAddress, pendingEmailToken, expiresAt);
    }

    // Build dynamic update for non-email fields
    Object.entries(updates).forEach(([key, value]) => {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount += 1;
      }
    });

    let updatedUser;
    if (fields.length > 0) {
      updatedUser = await userRepo.updateProfileFields(userId, fields, values);
    } else {
      // Only an email change was requested — fetch current user to return
      updatedUser = await userRepo.getProfileById(userId);
    }

    // Attach token info so the controller can send the verification email
    if (pendingEmailToken) {
      updatedUser._emailChangeToken = pendingEmailToken;
      updatedUser._pendingEmail = pendingEmailAddress;
    }

    // Audit trail
    const changedFields = [
      ...fields.map(f => f.split(' ')[0]),           // 'name', 'phone', etc.
      ...(pendingEmailToken ? ['email_change_requested'] : [])
    ];
    await userRepo.insertAuditLog(userId, 'profile_updated', 'user', userId);
    logger.info('Profile updated', { userId, changedFields });

    return updatedUser;
  },

  /**
   * Confirm a staged email change using verification token.
   */
  async verifyEmailChange(token) {
    const now = new Date();
    const user = await userRepo.confirmEmailChange(token, now);
    if (!user) {
      throw new AuthenticationError('Invalid or expired email verification token');
    }
    return user;
  },

  /**
   * Change user password and revoke all active sessions.
   */
  async changePassword(userId, currentPassword, newPassword) {
    // Validate new password strength
    if (newPassword.length < 8) {
      throw new ValidationError('New password must be at least 8 characters long');
    }

    return withTransaction(async (tx) => {
      // Lock the row to prevent concurrent changes and fetch current hash
      const userRow = await userRepo.lockForPasswordChange(userId, tx);

      if (!userRow) {
        throw new NotFoundError('User');
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, userRow.password_hash);
      if (!isValid) {
        throw new AuthenticationError('Current password is incorrect');
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Update password + bump token_version to invalidate all stateless tokens
      await userRepo.updatePasswordHash(userId, newPasswordHash, tx);

      // Revoke ALL active sessions so existing JWTs are immediately invalid.
      const revokedSessions = await userRepo.revokeAllActiveSessionsReturning(userId, tx);

      // Bulk-insert JTIs into revoked_tokens for any session that carried one
      const jtisToRevoke = revokedSessions
        .filter(s => s.jti)
        .map(s => ({
          jti: s.jti,
          expiresAt: s.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000)
        }));

      if (jtisToRevoke.length > 0) {
        await userRepo.bulkInsertRevokedTokens(
          jtisToRevoke.map(({ jti, expiresAt }) => ({ jti, user_id: userId, expires_at: expiresAt })),
          tx
        );
      }

      // Audit log (inside same transaction — rolls back together on failure)
      await userRepo.insertAuditLog(userId, 'password_changed', 'user', userId, tx);

      return { success: true };
    });
  },

  /**
   * Get user notification preferences or defaults.
   */
  async getNotificationPreferences(userId) {
    const row = await userRepo.getNotificationPreferences(userId);

    if (!row) {
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

    return row;
  },

  /**
   * Update selected notification preference fields.
   */
  async updateNotificationPreferences(userId, preferences) {
    const { email_enabled, push_enabled, sms_enabled, notification_types } = preferences;

    const existing = await userRepo.getNotificationPreferences(userId);

    if (!existing) {
      return userRepo.insertNotificationPreferences(userId, {
        email_enabled,
        push_enabled,
        sms_enabled,
        notification_types
      });
    }

    // Build dynamic update for fields that were actually supplied
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (email_enabled !== undefined) {
      fields.push(`email_enabled = $${paramCount}`);
      values.push(email_enabled);
      paramCount += 1;
    }
    if (push_enabled !== undefined) {
      fields.push(`push_enabled = $${paramCount}`);
      values.push(push_enabled);
      paramCount += 1;
    }
    if (sms_enabled !== undefined) {
      fields.push(`sms_enabled = $${paramCount}`);
      values.push(sms_enabled);
      paramCount += 1;
    }
    if (notification_types !== undefined) {
      fields.push(`notification_types = $${paramCount}`);
      values.push(JSON.stringify(notification_types));
      paramCount += 1;
    }

    if (fields.length === 0) {
      throw new ValidationError('No valid preferences to update');
    }

    return userRepo.updateNotificationPreferences(userId, fields, values);
  },

  /**
   * List active sessions for account security settings.
   */
  async getActiveSessions(userId) {
    return userRepo.getActiveSessions(userId);
  },

  /**
   * Revoke one session and optionally blocklist its JWT by JTI.
   */
  async revokeSession(userId, sessionId, jti = null, tokenExpiresAt = null) {
    const revokedSession = await userRepo.revokeSessionById(sessionId, userId);

    if (!revokedSession) {
      throw new NotFoundError('Session');
    }

    // Blocklist the JWT by its jti so requests using this token are rejected immediately.
    // Prefer the jti stored on the session row; fall back to the one supplied by the caller.
    const revokedJti = revokedSession.jti || jti;
    if (revokedJti) {
      const expiresAt = tokenExpiresAt
        ? new Date(tokenExpiresAt * 1000)
        : new Date(Date.now() + 15 * 60 * 1000);

      await userRepo.insertRevokedToken(revokedJti, userId, expiresAt);
    }

    return { success: true };
  }
};
