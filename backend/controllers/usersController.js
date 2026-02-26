import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { settingsService } from '../services/settingsService.js';

// Login - verifies credentials and returns JWT tokens
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const result = await pool.query(
      `SELECT u.*, o.name as organization_name, o.is_active as org_is_active
       FROM users u 
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.email = $1 AND u.is_active = true`,
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // Verify password
    const isValid = await bcrypt.compare(String(password), String(user.password_hash));
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.org_is_active === false) {
      return res.status(403).json({ error: 'Organization is inactive' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const tokenPayload = { userId: user.id, role: user.role, email: user.email, organizationId: user.organization_id };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Store refresh token for revocation support
    await pool.query(
      `INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')`,
      [user.id, refreshToken, req.ip || null, req.headers['user-agent'] || null]
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organization_id,
          avatar: user.avatar,
          lastLogin: user.last_login,
          createdAt: user.created_at
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

// Refresh token
export async function refreshToken(req, res) {
  try {
    const { refreshToken: token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Refresh token required' });
    }
    
    const decoded = verifyRefreshToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Verify token is persisted and not revoked
    const sessionResult = await pool.query(
      'SELECT id FROM user_sessions WHERE session_token = $1 AND is_active = true AND expires_at > NOW()',
      [token]
    );
    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Refresh token has been revoked' });
    }

    const result = await pool.query(
      'SELECT id, email, role, organization_id FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const tokenPayload = { userId: user.id, role: user.role, email: user.email, organizationId: user.organization_id };
    const newAccessToken = generateAccessToken(tokenPayload);

    // Update session last_active timestamp
    await pool.query(
      'UPDATE user_sessions SET last_active = NOW() WHERE session_token = $1',
      [token]
    );

    res.json({ success: true, data: { accessToken: newAccessToken } });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
}

// Get current user profile
export async function getProfile(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.*, o.name as organization_name
       FROM users u 
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.id = $1`,
      [req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organization_id,
        avatar: user.avatar,
        lastLogin: user.last_login,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
}

// List users (admin only)
export async function listUsers(req, res) {
  try {
    const { role, is_active, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // Get organization context for multi-tenancy
    const organizationId = req.orgContext?.organizationId;
    
    let query = `
      SELECT u.id, u.email, u.name, u.role, u.avatar, u.is_active, 
             u.last_login, u.created_at, u.organization_id,
             o.name as organization_name
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      WHERE 1=1
    `;
    const params = [];
    
    // Multi-tenant filter: regular users only see their org's users
    if (organizationId) {
      params.push(organizationId);
      query += ` AND u.organization_id = $${params.length}`;
    }
    
    if (role) {
      params.push(role);
      query += ` AND u.role = $${params.length}`;
    }
    
    if (is_active !== undefined) {
      params.push(is_active === 'true');
      query += ` AND u.is_active = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }
    
    // Count rows: the .replace() regex approach fails on multi-line SELECTs
    // (JS '.' doesn't cross newlines), so wrap the WHERE expression as a subquery
    // instead (TASK-R12-007).
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM (${query}) AS _cnt`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Add pagination — parameterized to prevent SQL injection (TASK-R12-007).
    params.push(Math.min(parseInt(limit) || 20, 100), offset);
    query += ` ORDER BY u.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
      total,
      page: parseInt(page),
      pageSize: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
}

// List roles
export async function listRoles(req, res) {
  res.json({
    success: true,
    data: [
      { id: 'admin', name: 'Administrator', description: 'Full system access' },
      { id: 'operations_manager', name: 'Operations Manager', description: 'Manage orders and shipments' },
      { id: 'warehouse_manager', name: 'Warehouse Manager', description: 'Manage inventory and warehouses' },
      { id: 'carrier_partner', name: 'Carrier Partner', description: 'View and update shipments' },
      { id: 'finance', name: 'Finance', description: 'Access financial reports' },
      { id: 'customer_support', name: 'Customer Support', description: 'Handle returns and exceptions' }
    ]
  });
}

// Logout (client-side token removal, but we can log it)
export async function logout(req, res) {
  try {
    const { refreshToken: token } = req.body;

    // Revoke the refresh token session
    if (token && req.user) {
      await pool.query(
        'UPDATE user_sessions SET is_active = false WHERE session_token = $1 AND user_id = $2',
        [token, req.user.userId]
      );
    }

    // Log the logout action
    if (req.user) {
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, created_at) 
         VALUES ($1, 'logout', 'user', NOW())`,
        [req.user.userId]
      );
    }
    res.json({ success: true, data: null });
  } catch (error) {
    res.json({ success: true, data: null });
  }
}

// Update user profile (name, company, phone, avatar)
// Email changes are staged: user receives a verification link at the new address.
export async function updateProfile(req, res) {
  try {
    const userId = req.user.userId;
    const updates = req.body;
    
    const updatedUser = await settingsService.updateUserProfile(userId, updates);

    // If an email change was staged, the service attaches _emailChangeToken and _pendingEmail.
    // In production, send a verification email here. For now log the link.
    if (updatedUser._emailChangeToken) {
      const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${updatedUser._emailChangeToken}`;
      console.info(`[EMAIL-VERIFY] Send to ${updatedUser._pendingEmail}: ${verifyUrl}`);
      // TODO: replace with real email via nodemailer / SES / SendGrid
      delete updatedUser._emailChangeToken;
      delete updatedUser._pendingEmail;
    }
    
    res.json({
      success: true,
      data: updatedUser,
      ...(updates.email && {
        message: 'Profile updated. A verification email has been sent to your new address — please click the link to confirm the change.'
      })
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.message === 'Email already in use') {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

// Verify email change — called by the link in the verification email
export async function verifyEmailChange(req, res) {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const user = await settingsService.verifyEmailChange(token);

    res.json({
      success: true,
      message: 'Email address updated successfully',
      data: { id: user.id, email: user.email }
    });
  } catch (error) {
    console.error('Verify email change error:', error);
    if (error.message === 'Invalid or expired email verification token') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to verify email change' });
  }
}

// Change password
export async function changePassword(req, res) {
  try {
    const userId = req.user.userId;
    const { current_password, new_password } = req.body;
    
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }
    
    await settingsService.changePassword(userId, current_password, new_password);
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    
    if (error.message === 'Current password is incorrect') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'New password must be at least 8 characters long') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'User not found') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to change password' });
  }
}

// Get notification preferences
export async function getNotificationPreferences(req, res) {
  try {
    const userId = req.user.userId;
    const preferences = await settingsService.getNotificationPreferences(userId);
    
    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
}

// Update notification preferences
export async function updateNotificationPreferences(req, res) {
  try {
    const userId = req.user.userId;
    const preferences = req.body;
    
    const updated = await settingsService.updateNotificationPreferences(userId, preferences);
    
    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    
    if (error.message === 'No valid preferences to update') {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
}

// Get active sessions
export async function getActiveSessions(req, res) {
  try {
    const userId = req.user.userId;
    const sessions = await settingsService.getActiveSessions(userId);
    
    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('Get active sessions error:', error);
    res.status(500).json({ error: 'Failed to get active sessions' });
  }
}

// Revoke session
export async function revokeSession(req, res) {
  try {
    const userId = req.user.userId;
    const { sessionId } = req.params;

    // Pass the calling request's jti and exp as fallback for blocklisting.
    // If the session row already has a stored jti, that takes precedence in the service.
    const callerJti = req.user.jti || null;
    const callerExp = req.user.exp || null;
    
    await settingsService.revokeSession(userId, sessionId, callerJti, callerExp);
    
    res.json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error) {
    console.error('Revoke session error:', error);
    
    if (error.message === 'Session not found or does not belong to user') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to revoke session' });
  }
}

// ── Org User Management (admin-only, org-scoped) ──────────────────────────────

const ORG_ASSIGNABLE_ROLES = [
  'operations_manager',
  'warehouse_manager',
  'carrier_partner',
  'finance',
  'customer_support',
];

// Create a new user within the admin's organization
export async function createOrgUser(req, res) {
  try {
    const organizationId = req.orgContext?.organizationId;
    if (!organizationId) {
      return res.status(403).json({ error: 'Organization context required' });
    }

    const { name, email, password, role } = req.body;

    if (!ORG_ASSIGNABLE_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Invalid role. Allowed roles: ${ORG_ASSIGNABLE_ROLES.join(', ')}`
      });
    }

    // Validate password strength (TASK-R12-004): min 8 chars, mixed case, digit
    const PASSWORD_STRENGTH_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!password || !PASSWORD_STRENGTH_RE.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters and include at least one uppercase letter, one lowercase letter, and one number'
      });
    }

    // Check for duplicate email
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, organization_id, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       RETURNING id, name, email, role, organization_id, is_active, created_at`,
      [name, email, password_hash, role, organizationId]
    );

    const user = result.rows[0];

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, created_at)
       VALUES ($1, 'create_user', 'user', $2, NOW())`,
      [req.user.userId, user.id]
    );

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    console.error('Create org user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
}

// Get a single user (must belong to same org)
export async function getOrgUser(req, res) {
  try {
    const organizationId = req.orgContext?.organizationId;
    const { id } = req.params;

    let query = `
      SELECT u.id, u.name, u.email, u.role, u.avatar, u.is_active,
             u.last_login, u.created_at, u.organization_id,
             o.name as organization_name
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      WHERE u.id = $1
    `;
    const params = [id];

    if (organizationId) {
      params.push(organizationId);
      query += ` AND u.organization_id = $2`;
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get org user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
}

// Update a user's role / active status / name
export async function updateOrgUser(req, res) {
  try {
    const organizationId = req.orgContext?.organizationId;
    if (!organizationId) {
      return res.status(403).json({ error: 'Organization context required' });
    }

    const { id } = req.params;
    const { name, role, is_active } = req.body;

    if (role && !ORG_ASSIGNABLE_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Invalid role. Allowed roles: ${ORG_ASSIGNABLE_ROLES.join(', ')}`
      });
    }

    // Verify user belongs to this org
    const existing = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const setClauses = [];
    const params = [];

    if (name !== undefined) {
      params.push(name);
      setClauses.push(`name = $${params.length}`);
    }
    if (role !== undefined) {
      params.push(role);
      setClauses.push(`role = $${params.length}`);
    }
    if (is_active !== undefined) {
      params.push(is_active);
      setClauses.push(`is_active = $${params.length}`);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id);
    const result = await pool.query(
      `UPDATE users SET ${setClauses.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, name, email, role, is_active, organization_id, created_at`,
      params
    );

    // Audit: record who changed the user and what fields were updated (TASK-R12-008)
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, created_at)
       VALUES ($1, 'update_user', 'user', $2, NOW())`,
      [req.user.userId, id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update org user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
}

// Soft-delete (deactivate) a user within the org
export async function deactivateOrgUser(req, res) {
  try {
    const organizationId = req.orgContext?.organizationId;
    if (!organizationId) {
      return res.status(403).json({ error: 'Organization context required' });
    }

    const { id } = req.params;

    // Cannot deactivate yourself
    if (id === req.user.userId) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    // TASK-R8-003: Deactivate user, bump token_version, and revoke all active sessions
    // so existing JWTs are immediately invalid — no waiting for natural expiry.
    const result = await pool.query(
      `UPDATE users
       SET is_active = false,
           token_version = COALESCE(token_version, 0) + 1,
           updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING id, name, email, is_active`,
      [id, organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Revoke all active sessions and blocklist their JTIs
    const sessions = await pool.query(
      `UPDATE user_sessions
       SET is_active = false
       WHERE user_id = $1 AND is_active = true
       RETURNING jti, expires_at`,
      [id]
    );

    const jtisToRevoke = sessions.rows.filter(s => s.jti);
    if (jtisToRevoke.length > 0) {
      const placeholders = jtisToRevoke
        .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
        .join(', ');
      const flatParams = jtisToRevoke.flatMap(({ jti, expires_at }) => [
        jti,
        id,
        expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000)
      ]);
      await pool.query(
        `INSERT INTO revoked_tokens (jti, user_id, expires_at)
         VALUES ${placeholders}
         ON CONFLICT (jti) DO NOTHING`,
        flatParams
      );
    }

    // Audit: record account deactivation (TASK-R12-008)
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, created_at)
       VALUES ($1, 'deactivate_user', 'user', $2, NOW())`,
      [req.user.userId, id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Deactivate org user error:', error);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
}

