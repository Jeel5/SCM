// Organization Controller - handles multi-tenant organization management
import bcrypt from 'bcrypt';
import OrganizationRepository from '../repositories/OrganizationRepository.js';
import userRepo from '../repositories/UserRepository.js';
import { withTransaction } from '../utils/dbTransaction.js';
import { asyncHandler } from '../errors/errorHandler.js';
import { NotFoundError, BusinessLogicError, AuthorizationError, ValidationError } from '../errors/index.js';
import logger from '../utils/logger.js';

// Password must be ≥8 chars with at least one uppercase, one digit, one symbol
const PASSWORD_STRENGTH_RE = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()?!_\-+=])/;

// Defense-in-depth superadmin check — applied inside every mutation handler
// so that a misconfigured route cannot bypass it (T1-05)
const assertSuperadmin = (req) => {
  if (req.user?.role !== 'superadmin') {
    throw new AuthorizationError('Superadmin access required');
  }
};

// ========== ORGANIZATIONS (Superadmin only) ==========

// Get organizations list with filters
export const listOrganizations = asyncHandler(async (req, res) => {
  const queryParams = req.validatedQuery || req.query;
  const { page, limit, is_active, search } = queryParams;

  const { organizations, totalCount } = await OrganizationRepository.findOrganizations({
    page,
    limit,
    is_active,
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
    createdAt: organization.created_at,
    updatedAt: organization.updated_at,
    stats: {
      activeUsers: parseInt(stats.active_users) || 0,
      activeWarehouses: parseInt(stats.active_warehouses) || 0,
      totalOrders: parseInt(stats.total_orders) || 0,
      totalShipments: parseInt(stats.total_shipments) || 0
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

    // Validate password strength before hashing (T2-01)
    if (!adminData.password || adminData.password.length < 8 || !PASSWORD_STRENGTH_RE.test(adminData.password)) {
      throw new ValidationError(
        'Admin password must be ≥8 characters and contain at least one uppercase letter, one digit, and one symbol (e.g. ! @ # $ % & *)'
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(adminData.password, 10);

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

    return { organization, adminUser };
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
      role: result.adminUser.role
    }
  };

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

  await OrganizationRepository.deleteOrganization(id);

  // Audit log (T2-02)
  logger.info('Organization deleted (soft)', {
    action: 'organization.delete',
    orgId: id,
    actorId: req.user?.userId,
    actorEmail: req.user?.email,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, message: 'Organization deactivated successfully' });
});
