// Organization Repository - handles multi-tenant organization CRUD
import BaseRepository from './BaseRepository.js';

class OrganizationRepository extends BaseRepository {
  constructor() {
    super('organizations');
  }

  // Generate unique organization code
  async generateOrganizationCode(client = null) {
    const prefix = 'ORG';
    const year = new Date().getFullYear().toString().slice(-2);
    
    // Get the count of organizations created this year
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM organizations 
      WHERE code LIKE $1
    `;
    const result = await this.query(countQuery, [`${prefix}-${year}%`], client);
    const count = parseInt(result.rows[0].count) + 1;
    
    // Generate code like ORG-26-001, ORG-26-002, etc.
    const sequence = count.toString().padStart(3, '0');
    return `${prefix}-${year}-${sequence}`;
  }

  // Get organizations with pagination and filtering
  async findOrganizations({ page = 1, limit = 20, is_active = null, search = null }, client = null) {
    const offset = (page - 1) * limit;
    const params = [];
    let paramCount = 1;
    
    let query = `
      SELECT o.*,
        COUNT(*) OVER() as total_count
      FROM organizations o
      WHERE 1=1
    `;

    if (is_active !== null) {
      query += ` AND o.is_active = $${paramCount++}`;
      params.push(is_active);
    }

    if (search) {
      query += ` AND (
        o.name ILIKE $${paramCount} OR
        o.code ILIKE $${paramCount} OR
        o.email ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY o.created_at DESC`;
    query += ` LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    
    const organizations = result.rows;
    const totalCount = organizations.length > 0 ? parseInt(organizations[0].total_count) : 0;
    
    return { organizations, totalCount };
  }

  // Find organization by code
  async findByCode(code, client = null) {
    const query = 'SELECT * FROM organizations WHERE code = $1';
    const result = await this.query(query, [code], client);
    return result.rows[0] || null;
  }

  // Find organization by ID
  async findById(id, client = null) {
    const query = 'SELECT * FROM organizations WHERE id = $1';
    const result = await this.query(query, [id], client);
    return result.rows[0] || null;
  }

  // Create organization
  async createOrganization(orgData, client = null) {
    // Auto-generate code if not provided
    const code = orgData.code || await this.generateOrganizationCode(client);
    
    const query = `
      INSERT INTO organizations (
        code, name, email, phone, website,
        address, city, state, country, postal_code,
        timezone, currency, logo_url,
        subscription_tier, is_active,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
      RETURNING *
    `;
    
    const params = [
      code,
      orgData.name,
      orgData.email || null,
      orgData.phone || null,
      orgData.website || null,
      orgData.address || null,
      orgData.city || null,
      orgData.state || null,
      orgData.country || 'India',
      orgData.postal_code || null,
      orgData.timezone || 'Asia/Kolkata',
      orgData.currency || 'INR',
      orgData.logo_url || null,
      orgData.subscription_tier || 'standard',
      orgData.is_active !== false // Default to true
    ];

    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  // Update organization
  async updateOrganization(id, orgData, client = null) {
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (orgData.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      params.push(orgData.name);
    }

    if (orgData.email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      params.push(orgData.email);
    }

    if (orgData.phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      params.push(orgData.phone);
    }

    if (orgData.website !== undefined) {
      updates.push(`website = $${paramCount++}`);
      params.push(orgData.website);
    }

    if (orgData.address !== undefined) {
      updates.push(`address = $${paramCount++}`);
      params.push(orgData.address);
    }

    if (orgData.city !== undefined) {
      updates.push(`city = $${paramCount++}`);
      params.push(orgData.city);
    }

    if (orgData.state !== undefined) {
      updates.push(`state = $${paramCount++}`);
      params.push(orgData.state);
    }

    if (orgData.country !== undefined) {
      updates.push(`country = $${paramCount++}`);
      params.push(orgData.country);
    }

    if (orgData.postal_code !== undefined) {
      updates.push(`postal_code = $${paramCount++}`);
      params.push(orgData.postal_code);
    }

    if (orgData.timezone !== undefined) {
      updates.push(`timezone = $${paramCount++}`);
      params.push(orgData.timezone);
    }

    if (orgData.currency !== undefined) {
      updates.push(`currency = $${paramCount++}`);
      params.push(orgData.currency);
    }

    if (orgData.logo_url !== undefined) {
      updates.push(`logo_url = $${paramCount++}`);
      params.push(orgData.logo_url);
    }

    if (orgData.subscription_tier !== undefined) {
      updates.push(`subscription_tier = $${paramCount++}`);
      params.push(orgData.subscription_tier);
    }

    if (orgData.is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      params.push(orgData.is_active);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push(`updated_at = NOW()`);

    const query = `
      UPDATE organizations
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    params.push(id);

    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  // Delete organization (soft delete by setting is_active = false)
  async deleteOrganization(id, client = null) {
    const query = `
      UPDATE organizations
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await this.query(query, [id], client);
    return result.rows[0];
  }

  // Get organization statistics
  async getOrganizationStats(organizationId, client = null) {
    const query = `
      SELECT
        (SELECT COUNT(*) FROM users WHERE organization_id = $1 AND is_active = true) as active_users,
        (SELECT COUNT(*) FROM warehouses WHERE organization_id = $1 AND is_active = true) as active_warehouses,
        (SELECT COUNT(*) FROM orders WHERE organization_id = $1) as total_orders,
        (SELECT COUNT(*) FROM shipments WHERE organization_id = $1) as total_shipments
    `;
    const result = await this.query(query, [organizationId], client);
    return result.rows[0];
  }
}

export default new OrganizationRepository();
