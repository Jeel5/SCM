import crypto from 'crypto';
import bcrypt from 'bcrypt';
import userRepo from '../repositories/UserRepository.js';
import orgRepo from '../repositories/OrganizationRepository.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { settingsService } from '../services/settingsService.js';
import emailService from '../services/emailService.js';
import { ORG_ASSIGNABLE_ROLES } from '../config/roles.js';
import { getSubscriptionLimits } from '../config/subscriptionLimits.js';
import logger from '../utils/logger.js';
import axios from 'axios';
import { asyncHandler, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, ConflictError } from '../errors/index.js';

// HttpOnly cookie options — tokens are NOT accessible from JS
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

// Login - verifies credentials and returns JWT tokens
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) throw new ValidationError('Email and password required');
  
  const user = await userRepo.findByEmailWithOrg(email);
  if (!user) throw new AuthenticationError('Invalid credentials');
  
  // Verify password
  const isValid = await bcrypt.compare(String(password), String(user.password_hash));
  
  if (!isValid) throw new AuthenticationError('Invalid credentials');

  if (user.org_is_deleted === true) throw new AuthorizationError('Organization is deleted');
  if (user.org_suspended_at) throw new AuthorizationError('Organization is suspended');
  if (user.org_is_active === false) throw new AuthorizationError('Organization is inactive');

  // Update last login
  await userRepo.updateLastLogin(user.id);

  const tokenPayload = { userId: user.id, role: user.role, email: user.email, organizationId: user.organization_id };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Store refresh token for revocation support
  await userRepo.createSession(user.id, refreshToken, req.ip, req.headers['user-agent']);

  // Set tokens as httpOnly cookies — not accessible from JavaScript
  res
    .cookie('accessToken', accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 })
    .cookie('refreshToken', refreshToken, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60 * 1000 })
    .json({
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
        }
      }
    });
});

// Google OAuth login via ID token verification.
export const googleLogin = asyncHandler(async (req, res) => {
  const { credential } = req.body;
  if (!credential) throw new ValidationError('Google credential is required');

  let tokenInfo;
  try {
    const response = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
      params: { id_token: credential },
      timeout: 10000,
    });
    tokenInfo = response.data;
  } catch {
    throw new AuthenticationError('Invalid Google token');
  }

  const configuredClientId = process.env.GOOGLE_CLIENT_ID;
  if (configuredClientId && tokenInfo.aud !== configuredClientId) {
    throw new AuthenticationError('Google token audience mismatch');
  }

  const email = tokenInfo.email;
  if (!email || tokenInfo.email_verified !== 'true') {
    throw new AuthenticationError('Google email is not verified');
  }

  const user = await userRepo.findByEmailWithOrg(email);
  if (!user) throw new AuthenticationError('No account exists for this Google email');
  if (!user.is_active) throw new AuthorizationError('User account is inactive');
  if (user.org_is_deleted === true) throw new AuthorizationError('Organization is deleted');
  if (user.org_suspended_at) throw new AuthorizationError('Organization is suspended');
  if (user.org_is_active === false) throw new AuthorizationError('Organization is inactive');

  await userRepo.updateLastLogin(user.id);

  const tokenPayload = { userId: user.id, role: user.role, email: user.email, organizationId: user.organization_id };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);
  await userRepo.createSession(user.id, refreshToken, req.ip, req.headers['user-agent']);

  res
    .cookie('accessToken', accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 })
    .cookie('refreshToken', refreshToken, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60 * 1000 })
    .json({
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
          createdAt: user.created_at,
        },
      },
    });
});

// Refresh token
export const refreshToken = asyncHandler(async (req, res) => {
  // Read refresh token from httpOnly cookie
  const token = req.cookies?.refreshToken;

  if (!token) throw new ValidationError('Refresh token required');
  
  const decoded = verifyRefreshToken(token);
  if (!decoded) throw new AuthenticationError('Invalid refresh token');

  // Verify token is persisted and not revoked
  const session = await userRepo.findActiveSession(token);
  if (!session) throw new AuthenticationError('Refresh token has been revoked');

  const user = await userRepo.findById(decoded.userId);
  if (!user || !user.is_active) throw new AuthenticationError('User not found or inactive');

  const tokenPayload = {
    userId: user.id,
    role: user.role,
    email: user.email,
    organizationId: user.organization_id,
    ...(decoded.impersonation ? { impersonation: decoded.impersonation } : {}),
  };
  const newAccessToken = generateAccessToken(tokenPayload);

  // Update session last_active timestamp
  await userRepo.updateSessionActivity(token);

  // Issue new access token cookie
  res
    .cookie('accessToken', newAccessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 })
    .json({ success: true });
});

// Get current user profile
export const getProfile = asyncHandler(async (req, res) => {
  const user = await userRepo.findWithOrg(req.user.userId);
  if (!user) throw new NotFoundError('User');
  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone || null,
      role: user.role,
      organizationId: user.organization_id,
      impersonation: req.user.impersonation || null,
      avatar: user.avatar,
      lastLogin: user.last_login,
      createdAt: user.created_at
    }
  });
});

// List users (admin only)
export const listUsers = asyncHandler(async (req, res) => {
  const queryParams = req.validatedQuery || req.query;
  const { role, is_active, search, page = 1, limit = 20 } = queryParams;
  const organizationId = req.orgContext?.organizationId;
  const pageNum  = parseInt(page, 10)  || 1;
  const limitNum = Math.min(parseInt(limit, 10) || 20, 100);

  const { users, totalCount } = await userRepo.findUsers({
    page: pageNum, limit: limitNum, role,
    is_active: is_active !== undefined ? (is_active === 'true' || is_active === true) : null,
    search, organizationId,
  });

  res.json({
    success: true,
    data: users,
    total: totalCount,
    page: pageNum,
    pageSize: limitNum,
    totalPages: Math.ceil(totalCount / limitNum)
  });
});

// List roles
export const listRoles = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'admin', name: 'Administrator', description: 'Full system access' },
      { id: 'operations_manager', name: 'Operations Manager', description: 'Manage orders and shipments' },
      { id: 'warehouse_manager', name: 'Warehouse Manager', description: 'Manage inventory and warehouses' },
      { id: 'carrier_partner', name: 'Carrier Manager', description: 'View and update shipments' },
      { id: 'finance', name: 'Finance', description: 'Access financial reports' },
      { id: 'customer_support', name: 'Customer Support', description: 'Handle returns and exceptions' }
    ]
  });
});

// Logout (client-side token removal, but we can log it)
export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;

  // Best-effort: revoke + audit — errors must not prevent the 200 response
  try {
    if (token && req.user) await userRepo.revokeSession(token, req.user.userId);
    if (req.user) await userRepo.insertAuditLog(req.user.userId, 'logout', 'user');
  } catch { /* deliberately silenced — logout succeeds regardless of session storage errors */ }

  // Clear both cookies
  res
    .clearCookie('accessToken', COOKIE_OPTS)
    .clearCookie('refreshToken', COOKIE_OPTS)
    .json({ success: true, data: null });
});

// Update user profile (name, company, phone, avatar)
// Email changes are staged: user receives a verification link at the new address.
export const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const updates = req.body;
  
  const updatedUser = await settingsService.updateUserProfile(userId, updates);

  // If an email change was staged, the service attaches _emailChangeToken and _pendingEmail.
  if (updatedUser._emailChangeToken) {
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${updatedUser._emailChangeToken}`;
    try {
      await emailService.sendEmailChangeVerification({
        to: updatedUser._pendingEmail,
        name: updatedUser.name,
        verifyUrl,
      });
    } catch (emailError) {
      // Email transport failures should not block profile updates.
      logger.error('Failed to send email verification link', {
        userId,
        pendingEmail: updatedUser._pendingEmail,
        error: emailError,
      });
    }

    logger.info('[EMAIL-VERIFY] Email verification flow initiated', {
      pendingEmail: updatedUser._pendingEmail,
      userId,
    });

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
});

// Verify email change — called by the link in the verification email
export const verifyEmailChange = asyncHandler(async (req, res) => {
  const { token } = req.query;

  if (!token) throw new ValidationError('Verification token is required');

  const user = await settingsService.verifyEmailChange(token);

  res.json({
    success: true,
    message: 'Email address updated successfully',
    data: { id: user.id, email: user.email }
  });
});

// Change password
export const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { current_password, new_password } = req.body;
  
  if (!current_password || !new_password) {
    throw new ValidationError('Current and new passwords are required');
  }
  
  await settingsService.changePassword(userId, current_password, new_password);
  
  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

// Get notification preferences
export const getNotificationPreferences = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const preferences = await settingsService.getNotificationPreferences(userId);
  
  res.json({
    success: true,
    data: preferences
  });
});

// Update notification preferences
export const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const preferences = req.body;
  
  const updated = await settingsService.updateNotificationPreferences(userId, preferences);
  
  res.json({
    success: true,
    data: updated
  });
});

// Get active sessions
/**
 * Derive a human-readable device label from a raw user-agent string.
 */
function parseDeviceName(ua) {
  if (!ua) return 'Unknown Device';
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) {
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Android/i.test(ua)) return 'Android Device';
    return 'Mobile Device';
  }
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : null;
  const os = /Windows/.test(ua) ? 'Windows'
    : /Macintosh|Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : null;
  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  return 'Unknown Device';
}

export const getActiveSessions = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const sessions = await settingsService.getActiveSessions(userId);

  const mapped = sessions.map((s) => ({
    id: s.id,
    device: s.device_name || parseDeviceName(s.user_agent),
    ip: s.ip_address || 'Unknown IP',
    lastActive: s.last_active,
    current: false,          // sessions are anonymous — can't identify caller's refresh token
  }));

  res.json({
    success: true,
    data: mapped
  });
});

// Revoke ALL sessions for the current user (except the current one, best-effort)
export const revokeAllSessions = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  await userRepo.revokeAllActiveSessionsReturning(userId);
  await userRepo.insertAuditLog(userId, 'sessions_revoked_all', 'user', userId);
  logger.info('All sessions revoked', { userId });
  res.json({ success: true, message: 'All sessions revoked' });
});

// Revoke session
export const revokeSession = asyncHandler(async (req, res) => {
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
});

// ── Org User Management (admin-only, org-scoped) ────────────────────────────────
// ORG_ASSIGNABLE_ROLES imported from config/roles.js

// Create a new user within the admin's organization
export const createOrgUser = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  if (!organizationId) throw new AuthorizationError('Organization context required');

  const org = await orgRepo.findById(organizationId);
  if (!org) throw new NotFoundError('Organization');

  const limits = getSubscriptionLimits(org.subscription_tier || 'standard');
  if (Number.isFinite(limits.maxUsers)) {
    const activeUsers = await orgRepo.countActiveUsers(organizationId);
    if (activeUsers >= limits.maxUsers) {
      throw new ValidationError(
        `User limit reached for '${org.subscription_tier || 'standard'}' plan (${limits.maxUsers} active users).`
      );
    }
  }

  const { name, email, role, phone } = req.body;

  if (!ORG_ASSIGNABLE_ROLES.includes(role)) {
    throw new ValidationError(`Invalid role. Allowed roles: ${ORG_ASSIGNABLE_ROLES.join(', ')}`);
  }

  // Auto-generate a strong temporary password for new org users.
  const tempPassword = `Scm@${crypto.randomBytes(6).toString('hex')}`;

  // Check for duplicate email
  const existing = await userRepo.findByEmail(email);
  if (existing) throw new ConflictError('Email already in use');

  const password_hash = await bcrypt.hash(tempPassword, 10);

  const user = await userRepo.createUser({ name, email, password_hash, role, phone: phone || null, organization_id: organizationId });
  await userRepo.insertAuditLog(req.user.userId, 'create_user', 'user', user.id);

  // Return temporary password once so admin can share it securely.
  res.status(201).json({ success: true, data: { ...user, temporary_password: tempPassword } });
});

// Get a single user (must belong to same org)
export const getOrgUser = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  const { id } = req.params;

  const user = await userRepo.findOrgUser(id, organizationId);
  if (!user) throw new NotFoundError('User');

  res.json({ success: true, data: user });
});

// Update a user's role / active status / name
export const updateOrgUser = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  if (!organizationId) throw new AuthorizationError('Organization context required');

  const { id } = req.params;
  const { name, role, is_active } = req.body;

  if (role && !ORG_ASSIGNABLE_ROLES.includes(role)) {
    throw new ValidationError(`Invalid role. Allowed roles: ${ORG_ASSIGNABLE_ROLES.join(', ')}`);
  }

  // Verify user belongs to this org
  const existing = await userRepo.findById(id, organizationId);
  if (!existing) throw new NotFoundError('User');

  const fields = {};
  if (name      !== undefined) fields.name      = name;
  if (role      !== undefined) fields.role      = role;
  if (is_active !== undefined) fields.is_active = is_active;

  if (Object.keys(fields).length === 0) throw new ValidationError('No fields to update');

  const updated = await userRepo.updateUser(id, fields);

  // Audit: record who changed the user and what fields were updated (TASK-R12-008)
  await userRepo.insertAuditLog(req.user.userId, 'update_user', 'user', id);

  res.json({ success: true, data: updated });
});

// Soft-delete (deactivate) a user within the org
export const deactivateOrgUser = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  if (!organizationId) throw new AuthorizationError('Organization context required');

  const { id } = req.params;

  // Cannot deactivate yourself
  if (id === req.user.userId) throw new ValidationError('Cannot deactivate your own account');

  // TASK-R8-003: Deactivate user, bump token_version, and revoke all active sessions
  // so existing JWTs are immediately invalid — no waiting for natural expiry.
  const deactivated = await userRepo.deactivateUser(id, organizationId);
  if (!deactivated) throw new NotFoundError('User');

  // Revoke all active sessions and blocklist their JTIs
  const revokedSessions = await userRepo.revokeAllSessionsReturning(id);
  const jtisToRevoke = revokedSessions.filter(s => s.jti).map(s => ({ jti: s.jti, user_id: id, expires_at: s.expires_at }));
  await userRepo.bulkInsertRevokedTokens(jtisToRevoke);

  // Audit: record account deactivation (TASK-R12-008)
  await userRepo.insertAuditLog(req.user.userId, 'deactivate_user', 'user', id);

  res.json({ success: true, data: deactivated });
});

// Get organization webhook token (admin only, org-scoped)
export const getOrgWebhook = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  if (!organizationId) throw new AuthorizationError('Organization context required');

  const org = await orgRepo.findById(organizationId);
  if (!org) throw new NotFoundError('Organization');

  res.json({
    success: true,
    data: {
      organizationId: org.id,
      name: org.name,
      code: org.code,
      webhookToken: org.webhook_token
    }
  });
});
