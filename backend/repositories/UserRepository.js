// User Repository - handles user authentication and management queries
import BaseRepository from './BaseRepository.js';

class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  // Find user by username
  async findByUsername(username, client = null) {
    const query = `SELECT * FROM users WHERE username = $1`;
    const result = await this.query(query, [username], client);
    return result.rows[0] || null;
  }

  // Find user by email address
  async findByEmail(email, organizationId = undefined, client = null) {
    let query = `SELECT * FROM users WHERE email = $1`;
    const params = [email];
    if (organizationId !== undefined) {
      query += ` AND organization_id = $2`;
      params.push(organizationId);
    }
    const result = await this.query(query, params, client);
    return result.rows[0] || null;
  }

  // Get users with pagination and filters (role, active status, search)
  async findUsers({ page = 1, limit = 20, role = null, is_active = null, search = null, organizationId = undefined }, client = null) {
    const offset = (page - 1) * limit;
    const params = [];
    let paramCount = 1;
    
    let query = `
      SELECT 
        id, username, email, full_name, role, department, 
        phone, is_active, last_login, created_at, updated_at,
        COUNT(*) OVER() as total_count
      FROM users
      WHERE 1=1
    `;

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId);
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${paramCount++}`;
        params.push(...orgFilter.params);
      }
    }

    if (role) {
      query += ` AND role = $${paramCount++}`;
      params.push(role);
    }

    if (is_active !== null) {
      query += ` AND is_active = $${paramCount++}`;
      params.push(is_active);
    }

    if (search) {
      query += ` AND (
        username ILIKE $${paramCount} OR
        email ILIKE $${paramCount} OR
        full_name ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC`;
    query += ` LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    
    return {
      users: result.rows,
      totalCount: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0
    };
  }

  /**
   * Update last login time
   */
  async updateLastLogin(userId, client = null) {
    const query = `
      UPDATE users
      SET last_login = NOW()
      WHERE id = $1
      RETURNING id, username, email, full_name, role, last_login
    `;
    const result = await this.query(query, [userId], client);
    return result.rows[0];
  }

  /**
   * Update password
   */
  async updatePassword(userId, hashedPassword, client = null) {
    const query = `
      UPDATE users
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, username, email
    `;
    const result = await this.query(query, [hashedPassword, userId], client);
    return result.rows[0];
  }

  /**
   * Deactivate user
   */
  async deactivate(userId, organizationId = undefined, client = null) {
    let query = `
      UPDATE users
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
    `;
    const params = [userId];

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId);
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$2`;
        params.push(...orgFilter.params);
      }
    }

    query += ` RETURNING id, username, email, is_active`;
    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  /**
   * Activate user
   */
  async activate(userId, organizationId = undefined, client = null) {
    let query = `
      UPDATE users
      SET is_active = true, updated_at = NOW()
      WHERE id = $1
    `;
    const params = [userId];

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId);
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$2`;
        params.push(...orgFilter.params);
      }
    }

    query += ` RETURNING id, username, email, is_active`;
    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  /**
   * Get user statistics
   */
  async getUserStats(organizationId = undefined, client = null) {
    let query = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE is_active = true) as active_users,
        COUNT(*) FILTER (WHERE is_active = false) as inactive_users,
        COUNT(*) FILTER (WHERE role = 'admin') as admin_count,
        COUNT(*) FILTER (WHERE role = 'operations') as operations_count,
        COUNT(*) FILTER (WHERE role = 'warehouse') as warehouse_count,
        COUNT(*) FILTER (WHERE role = 'carrier') as carrier_count,
        COUNT(*) FILTER (WHERE role = 'finance') as finance_count,
        COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '7 days') as recent_active_users
      FROM users
      WHERE 1=1
    `;
    const params = [];

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId);
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$1`;
        params.push(...orgFilter.params);
      }
    }

    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  /**
   * Find users by role
   */
  async findByRole(role, organizationId = undefined, client = null) {
    let query = `
      SELECT id, username, email, full_name, role, department, is_active
      FROM users 
      WHERE role = $1 AND is_active = true
    `;
    const params = [role];

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId);
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$2`;
        params.push(...orgFilter.params);
      }
    }

    query += ` ORDER BY full_name`;
    const result = await this.query(query, params, client);
    return result.rows;
  }

  /**
   * Update user role
   */
  async updateRole(userId, role, organizationId = undefined, client = null) {
    let query = `
      UPDATE users
      SET role = $1, updated_at = NOW()
      WHERE id = $2
    `;
    const params = [role, userId];

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId);
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$3`;
        params.push(...orgFilter.params);
      }
    }

    query += ` RETURNING id, username, email, full_name, role`;
    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  /**
   * Get role distribution
   */
  async getRoleDistribution(organizationId = undefined, client = null) {
    let query = `
      SELECT 
        role,
        COUNT(*) as user_count,
        COUNT(*) FILTER (WHERE is_active = true) as active_count
      FROM users
      WHERE 1=1
    `;
    const params = [];

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId);
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$1`;
        params.push(...orgFilter.params);
      }
    }

    query += ` GROUP BY role ORDER BY user_count DESC`;
    const result = await this.query(query, params, client);
    return result.rows;
  }

  /**
   * Check if user has specific role
   */
  async hasRole(userId, role, client = null) {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM users 
        WHERE id = $1 AND role = $2 AND is_active = true
      ) as has_role
    `;
    const result = await this.query(query, [userId, role], client);
    return result.rows[0].has_role;
  }

  // ── Session & auth helpers ──────────────────────────────────────────────────

  /**
   * Find a user by id, joining their organization name — used for login and getProfile.
   */
  async findWithOrg(userId, client = null) {
    const result = await this.query(
      `SELECT u.*, o.name AS organization_name, o.is_active AS org_is_active
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.id = $1`,
      [userId], client
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by email, joining organization data — used at login.
   */
  async findByEmailWithOrg(email, client = null) {
    const result = await this.query(
      `SELECT u.*, o.name AS organization_name, o.is_active AS org_is_active
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.email = $1 AND u.is_active = true`,
      [email], client
    );
    return result.rows[0] || null;
  }

  /**
   * Persist a refresh-token session row.
   */
  async createSession(userId, sessionToken, ip, userAgent, client = null) {
    const result = await this.query(
      `INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')
       RETURNING id`,
      [userId, sessionToken, ip || null, userAgent || null], client
    );
    return result.rows[0];
  }

  /**
   * Verify a refresh token is active and not expired.
   */
  async findActiveSession(sessionToken, client = null) {
    const result = await this.query(
      `SELECT id FROM user_sessions
       WHERE session_token = $1 AND is_active = true AND expires_at > NOW()`,
      [sessionToken], client
    );
    return result.rows[0] || null;
  }

  /**
   * Touch last_active on a session (called on token refresh).
   */
  async updateSessionActivity(sessionToken, client = null) {
    await this.query(
      `UPDATE user_sessions SET last_active = NOW() WHERE session_token = $1`,
      [sessionToken], client
    );
  }

  /**
   * Soft-revoke a single session by token (used at logout).
   */
  async revokeSession(sessionToken, userId, client = null) {
    await this.query(
      `UPDATE user_sessions SET is_active = false
       WHERE session_token = $1 AND user_id = $2`,
      [sessionToken, userId], client
    );
  }

  /**
   * Revoke all active sessions for a user; returns the rows (including jti) for blocklisting.
   */
  async revokeAllSessionsReturning(userId, client = null) {
    const result = await this.query(
      `UPDATE user_sessions SET is_active = false
       WHERE user_id = $1 AND is_active = true
       RETURNING jti, expires_at`,
      [userId], client
    );
    return result.rows;
  }

  /**
   * Bulk-insert rows into revoked_tokens (ignore conflicts on jti).
   * rows: Array of { jti, user_id, expires_at }
   */
  async bulkInsertRevokedTokens(rows, client = null) {
    if (!rows.length) return;
    const placeholders = rows
      .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
      .join(', ');
    const params = rows.flatMap(({ jti, user_id, expires_at }) => [
      jti,
      user_id,
      expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000),
    ]);
    await this.query(
      `INSERT INTO revoked_tokens (jti, user_id, expires_at) VALUES ${placeholders}
       ON CONFLICT (jti) DO NOTHING`,
      params, client
    );
  }

  // ── Org-user CRUD ───────────────────────────────────────────────────────────

  /**
   * Insert a new user row.  data must include: name, email, password_hash, role,
   * organization_id.  Optional: phone, is_active (defaults true).
   */
  async createUser(data, client = null) {
    const result = await this.query(
      `INSERT INTO users (organization_id, email, password_hash, name, role, phone, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id, name, email, role, organization_id, is_active, created_at`,
      [
        data.organization_id || null,
        data.email,
        data.password_hash,
        data.name,
        data.role || 'viewer',
        data.phone || null,
        data.is_active !== undefined ? data.is_active : true,
      ], client
    );
    return result.rows[0];
  }

  /**
   * Fetch a single user by id, optionally scoped to an org, with org name join.
   */
  async findOrgUser(id, organizationId = undefined, client = null) {
    const params = [id];
    const orgClause = organizationId ? ` AND u.organization_id = $2` : '';
    if (organizationId) params.push(organizationId);
    const result = await this.query(
      `SELECT u.id, u.name, u.email, u.role, u.avatar, u.is_active,
              u.last_login, u.created_at, u.organization_id,
              o.name AS organization_name
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.id = $1${orgClause}`,
      params, client
    );
    return result.rows[0] || null;
  }

  /**
   * Dynamic partial update on users.  fields is a plain object of column→value pairs.
   * updated_at is always set.
   */
  async updateUser(id, fields, client = null) {
    const keys   = Object.keys(fields);
    if (keys.length === 0) return null;
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
    const params     = [...Object.values(fields), id];
    setClauses.push('updated_at = NOW()');
    const result = await this.query(
      `UPDATE users SET ${setClauses.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, name, email, role, is_active, organization_id, created_at`,
      params, client
    );
    return result.rows[0] || null;
  }

  /**
   * Soft-deactivate a user: set is_active=false, bump token_version (immediate JWT invalidation).
   * Returns the updated row, or null if not found in the given org.
   */
  async deactivateUser(id, organizationId, client = null) {
    const result = await this.query(
      `UPDATE users
       SET is_active = false,
           token_version = COALESCE(token_version, 0) + 1,
           updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING id, name, email, is_active`,
      [id, organizationId], client
    );
    return result.rows[0] || null;
  }

  /**
   * Append an audit log entry.  entityId may be null for entity-less actions.
   */
  async insertAuditLog(actorId, action, entityType, entityId = null, client = null) {
    await this.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [actorId, action, entityType, entityId], client
    );
  }

  // ─── Settings / Profile helpers ─────────────────────────────────────────────

  /**
   * Check whether an email address is already taken by another user.
   * Checks both the current email column AND the pending_email staging column.
   *
   * @param {string} email
   * @param {string} excludeId  - the user making the change (excluded from results)
   * @param {object|null} client
   * @returns {{ emailTaken: boolean, pendingTaken: boolean }}
   */
  async checkEmailTaken(email, excludeId, client = null) {
    const [emailRes, pendingRes] = await Promise.all([
      this.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, excludeId], client
      ),
      this.query(
        'SELECT id FROM users WHERE pending_email = $1 AND id != $2',
        [email, excludeId], client
      )
    ]);
    return {
      emailTaken:   emailRes.rows.length   > 0,
      pendingTaken: pendingRes.rows.length  > 0
    };
  }

  /**
   * Stage a pending email change — stores the new address and a verification token.
   */
  async stagePendingEmail(userId, pendingEmail, token, expiresAt, client = null) {
    await this.query(
      `UPDATE users
       SET pending_email       = $1,
           email_change_token  = $2,
           email_change_expires = $3,
           updated_at          = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [pendingEmail, token, expiresAt, userId], client
    );
  }

  /**
   * Update arbitrary safe profile fields (name, phone, company, avatar).
   * Returns the refreshed user row.
   *
   * @param {string} userId
   * @param {Array<string>} fields - SQL fragments like "name = $1"
   * @param {Array<*>} values     - corresponding parameter values (userId appended last)
   * @param {object|null} client
   */
  async updateProfileFields(userId, fields, values, client = null) {
    values.push(userId);
    const result = await this.query(
      `UPDATE users
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length}
       RETURNING id, username, email, name, phone, company, avatar, role,
                 pending_email, created_at, updated_at`,
      values, client
    );
    return result.rows[0] || null;
  }

  /**
   * Fetch safe public profile columns for a user (no password hash, no tokens).
   */
  async getProfileById(userId, client = null) {
    const result = await this.query(
      `SELECT id, username, email, name, phone, company, avatar, role,
              pending_email, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId], client
    );
    return result.rows[0] || null;
  }

  /**
   * Apply a pending email change identified by its single-use token.
   * Sets email = pending_email, clears staging columns, sets email_verified = true.
   * Returns the updated row, or null when the token is missing/expired.
   */
  async confirmEmailChange(token, now, client = null) {
    const result = await this.query(
      `UPDATE users
       SET email                = pending_email,
           pending_email        = NULL,
           email_change_token   = NULL,
           email_change_expires = NULL,
           email_verified       = TRUE,
           updated_at           = CURRENT_TIMESTAMP
       WHERE email_change_token = $1
         AND email_change_expires > $2
       RETURNING id, username, email, name, role`,
      [token, now], client
    );
    return result.rows[0] || null;
  }

  /**
   * Lock the user row for a password-change transaction (SELECT FOR UPDATE).
   * Must be called within a transaction (pass the tx client).
   */
  async lockForPasswordChange(userId, client) {
    const result = await this.query(
      'SELECT password_hash FROM users WHERE id = $1 FOR UPDATE',
      [userId], client
    );
    return result.rows[0] || null;
  }

  /**
   * Persist a new password hash and bump token_version to invalidate all JWTs.
   */
  async updatePasswordHash(userId, hash, client = null) {
    await this.query(
      `UPDATE users
       SET password_hash  = $1,
           token_version  = COALESCE(token_version, 0) + 1,
           updated_at     = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [hash, userId], client
    );
  }

  /**
   * Revoke all active sessions for a user and return their JTI + expiry rows
   * so the caller can bulk-insert them into revoked_tokens.
   */
  async revokeAllActiveSessionsReturning(userId, client = null) {
    const result = await this.query(
      `UPDATE user_sessions
       SET is_active = false
       WHERE user_id = $1 AND is_active = true
       RETURNING jti, expires_at`,
      [userId], client
    );
    return result.rows; // [{jti, expires_at}, ...]
  }

  /**
   * Revoke a single session and return the row (for JTI blocklisting).
   */
  async revokeSessionById(sessionId, userId, client = null) {
    const result = await this.query(
      `UPDATE user_sessions
       SET is_active = false
       WHERE id = $1 AND user_id = $2
       RETURNING id, jti`,
      [sessionId, userId], client
    );
    return result.rows[0] || null;
  }

  /**
   * Insert a single JTI into the revoked_tokens blocklist.
   */
  async insertRevokedToken(jti, userId, expiresAt, client = null) {
    await this.query(
      `INSERT INTO revoked_tokens (jti, user_id, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (jti) DO NOTHING`,
      [jti, userId, expiresAt], client
    );
  }

  // ─── Notification preferences ────────────────────────────────────────────────

  /**
   * Fetch the notification-preference row for a user.
   * Returns null when no row exists (caller may return defaults).
   */
  async getNotificationPreferences(userId, client = null) {
    const result = await this.query(
      'SELECT * FROM user_notification_preferences WHERE user_id = $1',
      [userId], client
    );
    return result.rows[0] || null;
  }

  /**
   * Insert a new notification-preferences row.
   */
  async insertNotificationPreferences(userId, prefs, client = null) {
    const { email_enabled = true, push_enabled = true, sms_enabled = false, notification_types = {} } = prefs;
    const result = await this.query(
      `INSERT INTO user_notification_preferences
         (user_id, email_enabled, push_enabled, sms_enabled, notification_types)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, email_enabled, push_enabled, sms_enabled, JSON.stringify(notification_types)], client
    );
    return result.rows[0];
  }

  /**
   * Update specific fields on an existing notification-preferences row.
   * @param {string} userId
   * @param {Array<string>} fields - SQL fragments like "email_enabled = $1"
   * @param {Array<*>} values     - corresponding values (userId appended last by this method)
   * @param {object|null} client
   */
  async updateNotificationPreferences(userId, fields, values, client = null) {
    values.push(userId);
    const result = await this.query(
      `UPDATE user_notification_preferences
       SET ${fields.join(', ')}
       WHERE user_id = $${values.length}
       RETURNING *`,
      values, client
    );
    return result.rows[0] || null;
  }

  // ─── Session listing ─────────────────────────────────────────────────────────

  /**
   * Return all active sessions for a user (for the "manage sessions" settings page).
   */
  async getActiveSessions(userId, client = null) {
    const result = await this.query(
      `SELECT id, device_name, ip_address, user_agent, last_active, created_at
       FROM user_sessions
       WHERE user_id = $1 AND is_active = true
       ORDER BY last_active DESC`,
      [userId], client
    );
    return result.rows;
  }

  /**
   * Check whether a JWT (by its jti) has been revoked.
   * Returns true if revoked, false otherwise.
   */
  async isTokenRevoked(jti, client = null) {
    const result = await this.query(
      'SELECT 1 FROM revoked_tokens WHERE jti = $1 AND expires_at > NOW() LIMIT 1',
      [jti], client
    );
    return result.rows.length > 0;
  }
}

export default new UserRepository();
