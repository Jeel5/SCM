// Organization Controller - handles multi-tenant organization management
import pool from '../config/db.js';
import bcrypt from 'bcrypt';
import OrganizationRepository from '../repositories/OrganizationRepository.js';
import { asyncHandler } from '../errors/errorHandler.js';
import { NotFoundError, BusinessLogicError } from '../errors/index.js';

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
  const value = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if code already exists (if provided)
    if (value.code) {
      const existingOrg = await OrganizationRepository.findByCode(value.code, client);
      if (existingOrg) {
        throw new BusinessLogicError(`Organization code '${value.code}' already exists`);
      }
    }

    // Check if email already exists
    const emailCheck = await client.query(
      'SELECT id FROM organizations WHERE email = $1',
      [value.email]
    );
    if (emailCheck.rows.length > 0) {
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
    }, client);

    // Create admin user for the organization
    const adminData = value.admin_user;
    
    // Check if admin email already exists
    const userEmailCheck = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [adminData.email]
    );
    if (userEmailCheck.rows.length > 0) {
      throw new BusinessLogicError(`User with email '${adminData.email}' already exists`);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(adminData.password, 10);

    // Create admin user
    const userQuery = `
      INSERT INTO users (
        organization_id, email, password_hash, name, role, phone, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, name, role
    `;
    const userResult = await client.query(userQuery, [
      organization.id,
      adminData.email,
      passwordHash,
      adminData.name,
      'admin',
      adminData.phone || null,
      true
    ]);

    await client.query('COMMIT');

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
      adminUser: {
        id: userResult.rows[0].id,
        email: userResult.rows[0].email,
        name: userResult.rows[0].name,
        role: userResult.rows[0].role
      }
    };

    res.status(201).json({ success: true, data: transformed });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

// Update organization
export const updateOrganization = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const value = req.body;

  // Check if organization exists
  const existing = await OrganizationRepository.findById(id);
  if (!existing) {
    throw new NotFoundError('Organization not found');
  }

  // Check if email is being updated and already exists
  if (value.email && value.email !== existing.email) {
    const emailCheck = await pool.query(
      'SELECT id FROM organizations WHERE email = $1 AND id != $2',
      [value.email, id]
    );
    if (emailCheck.rows.length > 0) {
      throw new BusinessLogicError(`Organization with email '${value.email}' already exists`);
    }
  }

  const updated = await OrganizationRepository.updateOrganization(id, value);

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
  const { id } = req.params;

  const organization = await OrganizationRepository.findById(id);
  if (!organization) {
    throw new NotFoundError('Organization not found');
  }

  await OrganizationRepository.deleteOrganization(id);

  res.json({ success: true, message: 'Organization deactivated successfully' });
});
