// Organization Controller - handles multi-tenant organization management
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import OrganizationRepository from '../repositories/OrganizationRepository.js';
import userRepo from '../repositories/UserRepository.js';
import emailService from '../services/emailService.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import { withTransaction } from '../utils/dbTransaction.js';
import { asyncHandler } from '../errors/errorHandler.js';
import { NotFoundError, BusinessLogicError, AuthorizationError, ValidationError } from '../errors/index.js';
import logger from '../utils/logger.js';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

// Defense-in-depth superadmin check — applied inside every mutation handler
// so that a misconfigured route cannot bypass it (T1-05)
const assertSuperadmin = (req) => {
  if (req.user?.role !== 'superadmin') {
    throw new AuthorizationError('Superadmin access required');
  }
};

const collectStatusEmailRecipients = ({ users = [], organizationEmail = null }) => {
  const recipientMap = new Map();

  users
    .filter((user) => user.is_active && user.email)
    .forEach((user) => {
      const email = String(user.email).trim().toLowerCase();
      if (!email || recipientMap.has(email)) return;
      recipientMap.set(email, { email: user.email, name: user.name || 'there' });
    });

  if (organizationEmail) {
    const normalized = String(organizationEmail).trim().toLowerCase();
    if (normalized && !recipientMap.has(normalized)) {
      recipientMap.set(normalized, { email: organizationEmail, name: 'there' });
    }
  }

  return Array.from(recipientMap.values());
};

// ========== ORGANIZATIONS (Superadmin only) ==========

// Get organizations list with filters
export const listOrganizations = asyncHandler(async (req, res) => {
  const queryParams = req.validatedQuery || req.query;
  const { page, limit, is_active, include_deleted, search } = queryParams;

  const { organizations, totalCount } = await OrganizationRepository.findOrganizations({
    page,
    limit,
    is_active,
    include_deleted,
    search
  });

  // Transform for frontend
  const transformed = organizations.map(org => ({
    id: org.id,
    code: org.code,
    name: org.name,
    email: org.email,
    phone: org.phone,
    website: org.website,
    address: org.address,
    city: org.city,
    state: org.state,
    country: org.country,
    postalCode: org.postal_code,
    timezone: org.timezone,
    currency: org.currency,
    logoUrl: org.logo_url,
    subscriptionTier: org.subscription_tier,
    isActive: org.is_active,
      isDeleted: org.is_deleted,
      suspendedAt: org.suspended_at,
      suspensionReason: org.suspension_reason,
    createdAt: org.created_at,
    updatedAt: org.updated_at
  }));

  res.json({
    success: true,
    data: transformed,
    pagination: {
      page,
      limit,
      total: totalCount,
      pages: Math.ceil(totalCount / limit)
    }
  });
});

// Get organization by ID
export const getOrganization = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const organization = await OrganizationRepository.findById(id);
  if (!organization) {
    throw new NotFoundError('Organization not found');
  }

  // Get organization statistics
  const stats = await OrganizationRepository.getOrganizationStats(id);

  const transformed = {
    id: organization.id,
    code: organization.code,
    name: organization.name,
    email: organization.email,
    phone: organization.phone,
    website: organization.website,
    address: organization.address,
    city: organization.city,
    state: organization.state,
    country: organization.country,
    postalCode: organization.postal_code,
    timezone: organization.timezone,
    currency: organization.currency,
    logoUrl: organization.logo_url,
    subscriptionTier: organization.subscription_tier,
    isActive: organization.is_active,
      isDeleted: organization.is_deleted,
      suspendedAt: organization.suspended_at,
      suspensionReason: organization.suspension_reason,
    createdAt: organization.created_at,
    updatedAt: organization.updated_at,
    stats: {
      activeUsers: parseInt(stats.active_users, 10) || 0,
      activeWarehouses: parseInt(stats.active_warehouses, 10) || 0,
      totalOrders: parseInt(stats.total_orders, 10) || 0,
      totalShipments: parseInt(stats.total_shipments, 10) || 0
    }
  };

  res.json({ success: true, data: transformed });
});

// Create organization (with admin user)
export const createOrganization = asyncHandler(async (req, res) => {
  assertSuperadmin(req);  // T1-05
  const value = req.body;

  const result = await withTransaction(async (tx) => {
    // Check if code already exists (if provided)
    if (value.code) {
      const existingOrg = await OrganizationRepository.findByCode(value.code, tx);
      if (existingOrg) {
        throw new BusinessLogicError(`Organization code '${value.code}' already exists`);
      }
    }

    // Check if email already exists
    const emailOrg = await OrganizationRepository.findByEmail(value.email, tx);
    if (emailOrg) {
      throw new BusinessLogicError(`Organization with email '${value.email}' already exists`);
    }

    // Create organization
    const organization = await OrganizationRepository.createOrganization({
      code: value.code,
      name: value.name,
      email: value.email,
      phone: value.phone,
      website: value.website,
      address: value.address,
      city: value.city,
      state: value.state,
      country: value.country,
      postal_code: value.postal_code,
      timezone: value.timezone,
      currency: value.currency,
      logo_url: value.logo_url,
      subscription_tier: value.subscription_tier,
      is_active: value.is_active
    }, tx);

    // Create admin user for the organization
    const adminData = value.admin_user;

    // Check if admin email already exists
    const existingUser = await userRepo.findByEmail(adminData.email, undefined, tx);
    if (existingUser) {
      throw new BusinessLogicError(`User with email '${adminData.email}' already exists`);
    }

    // Auto-generate an initial admin password so superadmin does not need to enter one.
    const temporaryPassword = `Org@${crypto.randomBytes(6).toString('hex')}`;

    // Hash password
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    // Create admin user
    const adminUser = await userRepo.createUser({
      organization_id: organization.id,
      email: adminData.email,
      password_hash: passwordHash,
      name: adminData.name,
      role: 'admin',
      phone: adminData.phone || null,
      is_active: true,
    }, tx);

    await OrganizationRepository.logAuditAction({
      orgId: organization.id,
      action: 'created',
      performedBy: req.user.userId,
      performedByRole: req.user.role,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      beforeState: null,
      afterState: {
        id: organization.id,
        code: organization.code,
        name: organization.name,
        subscription_tier: organization.subscription_tier,
        is_active: organization.is_active,
      },
      metadata: { adminUserId: adminUser.id },
    }, tx);

    return { organization, adminUser, temporaryPassword };
  });

  // Audit log (T2-02)
  logger.info('Organization created', {
    action: 'organization.create',
    orgId: result.organization.id,
    orgCode: result.organization.code,
    actorId: req.user?.userId,
    actorEmail: req.user?.email,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  const transformed = {
    id: result.organization.id,
    code: result.organization.code,
    name: result.organization.name,
    email: result.organization.email,
    phone: result.organization.phone,
    website: result.organization.website,
    address: result.organization.address,
    city: result.organization.city,
    state: result.organization.state,
    country: result.organization.country,
    postalCode: result.organization.postal_code,
    timezone: result.organization.timezone,
    currency: result.organization.currency,
    logoUrl: result.organization.logo_url,
    subscriptionTier: result.organization.subscription_tier,
    isActive: result.organization.is_active,
    createdAt: result.organization.created_at,
    adminUser: {
      id: result.adminUser.id,
      email: result.adminUser.email,
      name: result.adminUser.name,
      role: result.adminUser.role,
      temporaryPassword: result.temporaryPassword,
    }
  };

  try {
    await emailService.sendOrganizationAdminOnboardingEmail({
      to: result.adminUser.email,
      name: result.adminUser.name,
      organizationName: result.organization.name,
      temporaryPassword: result.temporaryPassword,
      loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`,
    });
  } catch (emailError) {
    logger.error('Failed to send organization onboarding email', {
      organizationId: result.organization.id,
      adminUserId: result.adminUser.id,
      email: result.adminUser.email,
      error: emailError,
    });
  }

  res.status(201).json({ success: true, data: transformed });
});

// Update organization
export const updateOrganization = asyncHandler(async (req, res) => {
  assertSuperadmin(req);  // T1-05
  const { id } = req.params;
  const value = req.body;

  // Check if organization exists
  const existing = await OrganizationRepository.findById(id);
  if (!existing) {
    throw new NotFoundError('Organization not found');
  }

  // Check if email is being updated and already exists
  if (value.email && value.email !== existing.email) {
    const emailConflict = await OrganizationRepository.findByEmail(value.email, null, id);
    if (emailConflict) {
      throw new BusinessLogicError(`Organization with email '${value.email}' already exists`);
    }
  }

  const updated = await OrganizationRepository.updateOrganization(id, value);
  await OrganizationRepository.logAuditAction({
    orgId: id,
    action: 'updated',
    performedBy: req.user.userId,
    performedByRole: req.user.role,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    beforeState: {
      name: existing.name,
      email: existing.email,
      phone: existing.phone,
      subscription_tier: existing.subscription_tier,
      is_active: existing.is_active,
    },
    afterState: {
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      subscription_tier: updated.subscription_tier,
      is_active: updated.is_active,
    },
    metadata: { changedFields: Object.keys(value) },
  });

  // Audit log (T2-02)
  logger.info('Organization updated', {
    action: 'organization.update',
    orgId: id,
    actorId: req.user?.userId,
    actorEmail: req.user?.email,
    ip: req.ip,
    changes: Object.keys(value),
    timestamp: new Date().toISOString()
  });

  const transformed = {
    id: updated.id,
    code: updated.code,
    name: updated.name,
    email: updated.email,
    phone: updated.phone,
    website: updated.website,
    address: updated.address,
    city: updated.city,
    state: updated.state,
    country: updated.country,
    postalCode: updated.postal_code,
    timezone: updated.timezone,
    currency: updated.currency,
    logoUrl: updated.logo_url,
    subscriptionTier: updated.subscription_tier,
    isActive: updated.is_active,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at
  };

  res.json({ success: true, data: transformed });
});

// Delete organization (soft delete)
export const deleteOrganization = asyncHandler(async (req, res) => {
  assertSuperadmin(req);  // T1-05
  const { id } = req.params;

  const organization = await OrganizationRepository.findById(id);
  if (!organization) {
    throw new NotFoundError('Organization not found');
  }

  let orgUsers = [];
  try {
    orgUsers = await OrganizationRepository.getUsersByOrganization(id);
  } catch (userFetchError) {
    logger.error('Failed to fetch organization users for deactivation email', {
      orgId: id,
      error: userFetchError,
    });
  }

  const deleted = await OrganizationRepository.softDeleteOrganization(id, req.user.userId);
  if (!deleted) {
    throw new BusinessLogicError('Organization is already deleted');
  }

  await OrganizationRepository.logAuditAction({
    orgId: id,
    action: 'deleted',
    performedBy: req.user.userId,
    performedByRole: req.user.role,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    beforeState: { name: organization.name, is_active: organization.is_active, is_deleted: false },
    afterState: { is_deleted: true },
  });

  logger.info('Organization soft-deleted', {
    action: 'organization.delete',
    orgId: id,
    actorId: req.user?.userId,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  try {
    const recipients = orgUsers.filter((user) => user.is_active && user.email);
    await Promise.all(recipients.map((user) => emailService.sendOrganizationStatusUpdateEmail({
      to: user.email,
      name: user.name,
      organizationName: organization.name,
      status: 'deactivated',
    })));
  } catch (emailError) {
    logger.error('Failed to send organization deactivation emails', {
      orgId: id,
      error: emailError,
    });
  }

  res.json({ success: true, message: 'Organization deleted successfully' });
});

// Suspend a tenant (blocks all logins for that org)
export const suspendOrganization = asyncHandler(async (req, res) => {
  assertSuperadmin(req);
  const { id } = req.params;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';

  if (!reason?.trim()) {
    throw new ValidationError('Suspension reason is required');
  }

  const organization = await OrganizationRepository.findById(id);
  if (!organization) throw new NotFoundError('Organization not found');
  if (organization.is_deleted) throw new BusinessLogicError('Organization is deleted');
  if (organization.suspended_at) throw new BusinessLogicError('Organization is already suspended');

  const suspended = await OrganizationRepository.suspendOrganization(id, req.user.userId, reason.trim());
  if (!suspended) {
    throw new BusinessLogicError('Unable to suspend organization in current state');
  }

  await OrganizationRepository.logAuditAction({
    orgId: id,
    action: 'suspended',
    performedBy: req.user.userId,
    performedByRole: req.user.role,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    beforeState: { is_active: organization.is_active, suspended_at: null },
    afterState: { is_active: false, suspended_at: suspended.suspended_at },
    metadata: { reason },
  });

  try {
    const users = await OrganizationRepository.getUsersByOrganization(id);
    const recipients = collectStatusEmailRecipients({
      users,
      organizationEmail: organization.email,
    });

    await Promise.all(recipients.map((user) => emailService.sendOrganizationStatusUpdateEmail({
      to: user.email,
      name: user.name,
      organizationName: organization.name,
      status: 'suspended',
      reason: reason.trim(),
    })));
  } catch (emailError) {
    logger.error('Failed to send organization suspension emails', {
      orgId: id,
      error: emailError,
    });
  }

  logger.info('Organization suspended', { orgId: id, reason, actorId: req.user.userId });
  res.json({ success: true, data: { id, suspendedAt: suspended.suspended_at, reason } });
});

// Reactivate a suspended tenant
export const reactivateOrganization = asyncHandler(async (req, res) => {
  assertSuperadmin(req);
  const { id } = req.params;

  const organization = await OrganizationRepository.findById(id);
  if (!organization) throw new NotFoundError('Organization not found');
  if (!organization.is_deleted && !organization.suspended_at && organization.is_active) {
    throw new BusinessLogicError('Organization is already active');
  }

  const reactivated = await OrganizationRepository.reactivateOrganization(id, req.user.userId);
  if (!reactivated) {
    throw new BusinessLogicError('Unable to activate organization in current state');
  }

  await OrganizationRepository.logAuditAction({
    orgId: id,
    action: 'reactivated',
    performedBy: req.user.userId,
    performedByRole: req.user.role,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    beforeState: {
      is_active: organization.is_active,
      is_deleted: organization.is_deleted,
      suspended_at: organization.suspended_at,
      suspension_reason: organization.suspension_reason,
    },
    afterState: { suspended_at: null, is_active: true, is_deleted: false },
  });

  try {
    const users = await OrganizationRepository.getUsersByOrganization(id);
    const recipients = collectStatusEmailRecipients({
      users,
      organizationEmail: organization.email,
    });

    await Promise.all(recipients.map((user) => emailService.sendOrganizationStatusUpdateEmail({
      to: user.email,
      name: user.name,
      organizationName: organization.name,
      status: 'reactivated',
      loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`,
    })));
  } catch (emailError) {
    logger.error('Failed to send organization reactivation emails', {
      orgId: id,
      error: emailError,
    });
  }

  logger.info('Organization reactivated', { orgId: id, actorId: req.user.userId });
  res.json({ success: true, data: { id, reactivatedAt: new Date().toISOString() } });
});

// Get users belonging to an organization
export const getOrganizationUsers = asyncHandler(async (req, res) => {
  assertSuperadmin(req);
  const { id } = req.params;

  const org = await OrganizationRepository.findById(id);
  if (!org) throw new NotFoundError('Organization not found');

  const users = await OrganizationRepository.getUsersByOrganization(id);
  res.json({ success: true, data: users });
});

// Global platform statistics for the superadmin dashboard
export const getGlobalStats = asyncHandler(async (req, res) => {
  assertSuperadmin(req);

  const [stats, atRiskTenants] = await Promise.all([
    OrganizationRepository.getGlobalStats(),
    OrganizationRepository.getAtRiskTenants(5),
  ]);

  res.json({
    success: true,
    data: {
      tenants: {
        total: parseInt(stats.total_tenants, 10),
        active: parseInt(stats.active_tenants, 10),
        suspended: parseInt(stats.suspended_tenants, 10),
        deleted: parseInt(stats.deleted_tenants, 10),
      },
      users: {
        totalActive: parseInt(stats.total_active_users, 10),
      },
      orders: {
        total: parseInt(stats.total_orders, 10),
        last30d: parseInt(stats.orders_last_30d, 10),
      },
      shipments: {
        active: parseInt(stats.active_shipments, 10),
        last30d: parseInt(stats.shipments_last_30d, 10),
      },
      alerts: {
        active: parseInt(stats.active_alerts, 10),
      },
      revenue: {
        last30d: parseFloat(stats.revenue_last_30d) || 0,
      },
      atRiskTenants: atRiskTenants.map(t => ({
        id: t.id,
        name: t.name,
        code: t.code,
        subscriptionTier: t.subscription_tier,
        isActive: t.is_active,
        suspendedAt: t.suspended_at,
        slaViolations30d: parseInt(t.sla_violations_30d, 10),
        openExceptions: parseInt(t.open_exceptions, 10),
        activeUsers: parseInt(t.active_users, 10),
        lastUserLogin: t.last_user_login,
      })),
    },
  });
});

// Global users listing for superadmin control plane
export const getGlobalUsers = asyncHandler(async (req, res) => {
  assertSuperadmin(req);

  const { page = 1, limit = 50, search = '' } = req.validatedQuery ?? req.query;
  const result = await OrganizationRepository.getGlobalUsers({
    page: Number(page),
    limit: Number(limit),
    search: String(search || ''),
  });

  res.json({
    success: true,
    data: result.users,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: result.totalCount,
      pages: Math.ceil(result.totalCount / Number(limit)),
    },
  });
});

// Audit timeline per organization
export const getOrganizationAuditLogs = asyncHandler(async (req, res) => {
  assertSuperadmin(req);
  const { id } = req.params;
  const { limit = 100 } = req.validatedQuery ?? req.query;

  const org = await OrganizationRepository.findById(id);
  if (!org) throw new NotFoundError('Organization not found');

  const logs = await OrganizationRepository.getOrganizationAuditLogs(id, Number(limit));
  res.json({ success: true, data: logs });
});

// Global audit timeline across all organizations (superadmin)
export const getGlobalAuditLogs = asyncHandler(async (req, res) => {
  assertSuperadmin(req);
  const { page = 1, limit = 100, action = '', search = '' } = req.validatedQuery ?? req.query;

  const result = await OrganizationRepository.getGlobalAuditLogs({
    page: Number(page),
    limit: Number(limit),
    action: String(action || ''),
    search: String(search || ''),
  });

  res.json({
    success: true,
    data: result.logs,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: result.totalCount,
      pages: Math.ceil(result.totalCount / Number(limit)),
    },
  });
});

// Billing summary per organization (superadmin)
export const getOrganizationBillingSummary = asyncHandler(async (req, res) => {
  assertSuperadmin(req);
  const { id } = req.params;
  const { range_days = 90 } = req.validatedQuery ?? req.query;

  const org = await OrganizationRepository.findById(id);
  if (!org) throw new NotFoundError('Organization not found');

  const summary = await OrganizationRepository.getOrganizationBillingSummary(id, Number(range_days));
  res.json({
    success: true,
    data: {
      rangeDays: Number(range_days),
      invoiceCount: parseInt(summary?.invoice_count || 0, 10),
      billedAmount: parseFloat(summary?.billed_amount || 0),
      paidAmount: parseFloat(summary?.paid_amount || 0),
      openAmount: parseFloat(summary?.open_amount || 0),
      refundsAmount: parseFloat(summary?.refunds_amount || 0),
      avgInvoiceAmount: parseFloat(summary?.avg_invoice_amount || 0),
      lastInvoice: summary?.last_invoice_number ? {
        invoiceNumber: summary.last_invoice_number,
        status: summary.last_invoice_status,
        createdAt: summary.last_invoice_created_at,
      } : null,
    },
  });
});

export const startImpersonation = asyncHandler(async (req, res) => {
  assertSuperadmin(req);

  const { user_id: targetUserId } = req.body;
  const targetUser = await userRepo.findWithOrg(targetUserId);
  if (!targetUser || !targetUser.is_active) throw new NotFoundError('Target user');
  if (targetUser.role === 'superadmin') {
    throw new ValidationError('Impersonating another superadmin is not allowed');
  }

  const impersonation = {
    isImpersonating: true,
    byUserId: req.user.userId,
    byEmail: req.user.email,
    byRole: req.user.role,
    startedAt: new Date().toISOString(),
  };

  const tokenPayload = {
    userId: targetUser.id,
    role: targetUser.role,
    email: targetUser.email,
    organizationId: targetUser.organization_id,
    impersonation,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);
  await userRepo.createSession(targetUser.id, refreshToken, req.ip, req.headers['user-agent']);

  await OrganizationRepository.logAuditAction({
    orgId: targetUser.organization_id,
    action: 'impersonated',
    performedBy: req.user.userId,
    performedByRole: req.user.role,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    metadata: {
      targetUserId: targetUser.id,
      targetUserEmail: targetUser.email,
      targetRole: targetUser.role,
    },
  });

  res
    .cookie('accessToken', accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 })
    .cookie('refreshToken', refreshToken, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60 * 1000 })
    .json({
      success: true,
      data: {
        user: {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          role: targetUser.role,
          organizationId: targetUser.organization_id,
          avatar: targetUser.avatar,
          lastLogin: targetUser.last_login,
          createdAt: targetUser.created_at,
          impersonation,
        },
      },
    });
});

export const stopImpersonation = asyncHandler(async (req, res) => {
  const impersonation = req.user?.impersonation;
  if (!impersonation?.isImpersonating || !impersonation.byUserId) {
    throw new ValidationError('No active impersonation session');
  }

  const superadminUser = await userRepo.findById(impersonation.byUserId);
  if (!superadminUser || !superadminUser.is_active || superadminUser.role !== 'superadmin') {
    throw new AuthorizationError('Original superadmin account unavailable');
  }

  const tokenPayload = {
    userId: superadminUser.id,
    role: superadminUser.role,
    email: superadminUser.email,
    organizationId: superadminUser.organization_id,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);
  await userRepo.createSession(superadminUser.id, refreshToken, req.ip, req.headers['user-agent']);

  await OrganizationRepository.logAuditAction({
    orgId: req.user.organizationId || null,
    action: 'impersonation_stopped',
    performedBy: superadminUser.id,
    performedByRole: superadminUser.role,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    metadata: {
      previousImpersonatedUserId: req.user.userId,
      previousImpersonatedEmail: req.user.email,
    },
  });

  res
    .cookie('accessToken', accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 })
    .cookie('refreshToken', refreshToken, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60 * 1000 })
    .json({
      success: true,
      data: {
        user: {
          id: superadminUser.id,
          email: superadminUser.email,
          name: superadminUser.name,
          role: superadminUser.role,
          organizationId: superadminUser.organization_id,
          avatar: superadminUser.avatar,
          lastLogin: superadminUser.last_login,
          createdAt: superadminUser.created_at,
          impersonation: null,
        },
      },
    });
});

export const getActiveIncidentBanner = asyncHandler(async (req, res) => {
  const orgId = req.orgContext?.organizationId || null;
  const banner = await OrganizationRepository.getActiveIncidentBanner(orgId);
  res.json({ success: true, data: banner || null });
});

export const listIncidentBanners = asyncHandler(async (req, res) => {
  assertSuperadmin(req);
  const banners = await OrganizationRepository.listIncidentBanners();
  res.json({ success: true, data: banners });
});

export const createIncidentBanner = asyncHandler(async (req, res) => {
  assertSuperadmin(req);
  const banner = await OrganizationRepository.createIncidentBanner({
    ...req.body,
    actor_id: req.user.userId,
  });

  await OrganizationRepository.logAuditAction({
    orgId: banner.organization_id,
    action: 'incident_banner_created',
    performedBy: req.user.userId,
    performedByRole: req.user.role,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    metadata: { bannerId: banner.id, severity: banner.severity },
  });

  res.status(201).json({ success: true, data: banner });
});

export const updateIncidentBanner = asyncHandler(async (req, res) => {
  assertSuperadmin(req);
  const { id } = req.params;
  const banner = await OrganizationRepository.updateIncidentBanner(id, req.body, req.user.userId);
  if (!banner) throw new NotFoundError('Incident banner not found');

  await OrganizationRepository.logAuditAction({
    orgId: banner.organization_id,
    action: 'incident_banner_updated',
    performedBy: req.user.userId,
    performedByRole: req.user.role,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    metadata: { bannerId: banner.id, changes: Object.keys(req.body || {}) },
  });

  res.json({ success: true, data: banner });
});
