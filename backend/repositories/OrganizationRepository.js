// Organization Repository - handles multi-tenant organization CRUD
import BaseRepository from './BaseRepository.js';
import { ValidationError } from '../errors/AppError.js';

class OrganizationRepository extends BaseRepository {
  constructor() {
    super('organizations');
  }

  parseTotalCount(rows) {
    return rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
  }

  // Ensure the org code sequence exists and is at least aligned to current data.
  async ensureOrgCodeSequence(client = null) {
    await this.query(
      `CREATE SEQUENCE IF NOT EXISTS public.org_code_seq
         START WITH 1
         INCREMENT BY 1
         NO MINVALUE
         NO MAXVALUE
         CACHE 1`,
      [],
      client
    );

    const maxResult = await this.query(
      `SELECT COALESCE(MAX((regexp_match(code, '^ORG-[0-9]{2}-([0-9]+)$'))[1]::int), 0) AS max_seq
       FROM organizations`,
      [],
      client
    );

    const maxSeq = parseInt(maxResult.rows[0]?.max_seq || 0, 10);

    // Keep sequence monotonic even when data already exists.
    await this.query(
      `SELECT setval(
         'public.org_code_seq',
         GREATEST(
           $1::bigint,
           (SELECT COALESCE(last_value, 0) FROM public.org_code_seq)
         ),
         true
       )`,
      [maxSeq],
      client
    );
  }

  // Generate unique organization code using an atomic DB sequence
  async generateOrganizationCode(client = null) {
    await this.ensureOrgCodeSequence(client);

    const prefix = 'ORG';
    const year = new Date().getFullYear().toString().slice(-2);
    // NEXTVAL is atomic — two concurrent calls always get different values.
    const result = await this.query(
      `SELECT nextval('org_code_seq') AS seq`,
      [],
      client
    );
    const sequence = result.rows[0].seq.toString().padStart(3, '0');
    return `${prefix}-${year}-${sequence}`;
  }

  // Get organizations with pagination and filtering
  async findOrganizations({ page = 1, limit = 20, is_active = null, include_deleted = false, search = null }, client = null) {
    const offset = (page - 1) * limit;
    const params = [];
    let paramCount = 1;
    
    let query = `
      SELECT o.*,
        COUNT(*) OVER() as total_count
      FROM organizations o
      WHERE 1=1
    `;

    // Exclude hard-deleted tenants by default; superadmin can pass include_deleted=true
    if (!include_deleted) {
      query += ` AND o.is_deleted = false`;
    }

    if (is_active !== null && is_active !== undefined && typeof is_active !== 'object') {
      query += ` AND o.is_active = $${paramCount += 1}`;
      params.push(is_active);
    }

    if (search) {
      query += ` AND (
        o.name ILIKE $${paramCount} OR
        o.code ILIKE $${paramCount} OR
        o.email ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount += 1;
    }

    query += ` ORDER BY o.created_at DESC`;
    query += ` LIMIT $${paramCount += 1} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    
    const organizations = result.rows;
    const totalCount = this.parseTotalCount(organizations);
    
    return { organizations, totalCount };
  }

  // Find organization by code
  async findByCode(code, client = null) {
    const query = 'SELECT * FROM organizations WHERE code = $1';
    const result = await this.query(query, [code], client);
    return result.rows[0] || null;
  }

  // Find organization by email (optionally exclude a specific org id — used in update uniqueness check)
  async findByEmail(email, client = null, excludeId = null) {
    const clause = excludeId ? ' AND id != $2' : '';
    const params = excludeId ? [email, excludeId] : [email];
    const result = await this.query(
      `SELECT id FROM organizations WHERE email = $1${clause} LIMIT 1`,
      params, client
    );
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
      updates.push(`name = $${paramCount += 1}`);
      params.push(orgData.name);
    }

    if (orgData.email !== undefined) {
      updates.push(`email = $${paramCount += 1}`);
      params.push(orgData.email);
    }

    if (orgData.phone !== undefined) {
      updates.push(`phone = $${paramCount += 1}`);
      params.push(orgData.phone);
    }

    if (orgData.website !== undefined) {
      updates.push(`website = $${paramCount += 1}`);
      params.push(orgData.website);
    }

    if (orgData.address !== undefined) {
      updates.push(`address = $${paramCount += 1}`);
      params.push(orgData.address);
    }

    if (orgData.city !== undefined) {
      updates.push(`city = $${paramCount += 1}`);
      params.push(orgData.city);
    }

    if (orgData.state !== undefined) {
      updates.push(`state = $${paramCount += 1}`);
      params.push(orgData.state);
    }

    if (orgData.country !== undefined) {
      updates.push(`country = $${paramCount += 1}`);
      params.push(orgData.country);
    }

    if (orgData.postal_code !== undefined) {
      updates.push(`postal_code = $${paramCount += 1}`);
      params.push(orgData.postal_code);
    }

    if (orgData.timezone !== undefined) {
      updates.push(`timezone = $${paramCount += 1}`);
      params.push(orgData.timezone);
    }

    if (orgData.currency !== undefined) {
      updates.push(`currency = $${paramCount += 1}`);
      params.push(orgData.currency);
    }

    if (orgData.logo_url !== undefined) {
      updates.push(`logo_url = $${paramCount += 1}`);
      params.push(orgData.logo_url);
    }

    if (orgData.subscription_tier !== undefined) {
      updates.push(`subscription_tier = $${paramCount += 1}`);
      params.push(orgData.subscription_tier);
    }

    if (orgData.is_active !== undefined) {
      updates.push(`is_active = $${paramCount += 1}`);
      params.push(orgData.is_active);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update');
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
  // Soft-delete (permanent removal) — sets is_deleted flag, not just is_active
  async softDeleteOrganization(id, deletedBy, client = null) {
    const result = await this.query(`
      UPDATE organizations
      SET is_deleted = true,
          deleted_at = NOW(),
          deleted_by = $2,
          is_active = false,
          updated_at = NOW()
      WHERE id = $1 AND is_deleted = false
      RETURNING *
    `, [id, deletedBy], client);
    return result.rows[0] || null;
  }

  // Suspend a tenant (blocks logins; is_active stays based on plan, but suspended_at set)
  async suspendOrganization(id, suspendedBy, reason, client = null) {
    const result = await this.query(`
      UPDATE organizations
      SET suspended_at = NOW(),
          suspended_by = $2,
          suspension_reason = $3,
          is_active = false,
          updated_at = NOW()
      WHERE id = $1 AND is_deleted = false AND suspended_at IS NULL
      RETURNING *
    `, [id, suspendedBy, reason], client);
    return result.rows[0] || null;
  }

  // Reactivate a suspended tenant
  async reactivateOrganization(id, reactivatedBy, client = null) {
    const result = await this.query(`
      UPDATE organizations
      SET suspended_at = NULL,
          suspended_by = NULL,
          suspension_reason = NULL,
          is_active = true,
          updated_at = NOW()
      WHERE id = $1 AND is_deleted = false AND suspended_at IS NOT NULL
      RETURNING *
    `, [id, reactivatedBy], client);
    return result.rows[0] || null;
  }

  // Get global platform statistics (superadmin dashboard)
  async getGlobalStats(client = null) {
    const result = await this.query(`
      SELECT
        (SELECT COUNT(*) FROM organizations WHERE is_deleted = false)::int                 AS total_tenants,
        (SELECT COUNT(*) FROM organizations WHERE is_deleted = false AND is_active = true AND suspended_at IS NULL)::int AS active_tenants,
        (SELECT COUNT(*) FROM organizations WHERE is_deleted = false AND suspended_at IS NOT NULL)::int AS suspended_tenants,
        (SELECT COUNT(*) FROM organizations WHERE is_deleted = true)::int                  AS deleted_tenants,
        (SELECT COUNT(*) FROM users WHERE is_active = true)::int                           AS total_active_users,
        (SELECT COUNT(*) FROM orders)::int                                                 AS total_orders,
        (SELECT COUNT(*) FROM orders WHERE created_at >= NOW() - INTERVAL '30 days')::int AS orders_last_30d,
        (SELECT COUNT(*) FROM shipments WHERE status IN ('in_transit','out_for_delivery'))::int AS active_shipments,
        (SELECT COUNT(*) FROM shipments WHERE created_at >= NOW() - INTERVAL '30 days')::int   AS shipments_last_30d,
        (SELECT COUNT(*) FROM alerts WHERE status = 'active')::int                         AS active_alerts,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE created_at >= NOW() - INTERVAL '30 days') AS revenue_last_30d
    `, [], client);
    return result.rows[0];
  }

  // Get top-risk tenants (high SLA violations, low health)
  async getAtRiskTenants(limit = 10, client = null) {
    const result = await this.query(`
      SELECT
        o.id,
        o.name,
        o.code,
        o.subscription_tier,
        o.is_active,
        o.suspended_at,
        COUNT(DISTINCT sv.id) AS sla_violations_30d,
        COUNT(DISTINCT e.id)  AS open_exceptions,
        COUNT(DISTINCT u.id)  AS active_users,
        MAX(u.last_login) AS last_user_login
      FROM organizations o
      LEFT JOIN sla_violations sv ON sv.organization_id = o.id
        AND sv.violated_at >= NOW() - INTERVAL '30 days'
      LEFT JOIN exceptions e ON e.organization_id = o.id AND e.status NOT IN ('resolved','closed')
      LEFT JOIN users u ON u.organization_id = o.id AND u.is_active = true
      WHERE o.is_deleted = false AND o.is_active = true
      GROUP BY o.id
      ORDER BY sla_violations_30d DESC NULLS LAST, open_exceptions DESC NULLS LAST
      LIMIT $1
    `, [limit], client);
    return result.rows;
  }

  // Get users for a specific organization
  async getUsersByOrganization(orgId, client = null) {
    const result = await this.query(`
      SELECT id, name, email, role, is_active, last_login, created_at
      FROM users
      WHERE organization_id = $1
      ORDER BY role, name
    `, [orgId], client);
    return result.rows;
  }

  async getGlobalUsers({ page = 1, limit = 50, search = '' } = {}, client = null) {
    const offset = (page - 1) * limit;
    const params = [];
    let idx = 1;

    let where = `WHERE o.is_deleted = false`;
    if (search) {
      where += ` AND (
        u.name ILIKE $${idx}
        OR u.email ILIKE $${idx}
        OR o.name ILIKE $${idx}
        OR o.code ILIKE $${idx}
      )`;
      params.push(`%${search}%`);
      idx += 1;
    }

    params.push(limit, offset);

    const result = await this.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.is_active,
        u.last_login,
        u.created_at,
        o.id AS organization_id,
        o.name AS organization_name,
        o.code AS organization_code,
        COUNT(*) OVER() AS total_count
      FROM users u
      JOIN organizations o ON o.id = u.organization_id
      ${where}
      ORDER BY u.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, params, client);

    return {
      users: result.rows,
      totalCount: this.parseTotalCount(result.rows),
    };
  }

  async getOrganizationAuditLogs(orgId, limit = 100, client = null) {
    const result = await this.query(`
      SELECT
        l.id,
        l.organization_id,
        l.action,
        l.performed_by,
        l.performed_by_role,
        l.ip_address,
        l.user_agent,
        l.before_state,
        l.after_state,
        l.metadata,
        l.created_at,
        u.name AS performed_by_name,
        u.email AS performed_by_email
      FROM organization_audit_logs l
      LEFT JOIN users u ON u.id = l.performed_by
      WHERE l.organization_id = $1
      ORDER BY l.created_at DESC
      LIMIT $2
    `, [orgId, limit], client);
    return result.rows;
  }

  async getOrganizationBillingSummary(orgId, rangeDays = 90, client = null) {
    const result = await this.query(
      `SELECT
         (SELECT COUNT(*)::int
            FROM invoices i
            WHERE i.organization_id = $1
              AND i.created_at >= NOW() - ($2::int || ' days')::interval) AS invoice_count,
         (SELECT COALESCE(SUM(i.final_amount), 0)
            FROM invoices i
            WHERE i.organization_id = $1
              AND i.created_at >= NOW() - ($2::int || ' days')::interval) AS billed_amount,
         (SELECT COALESCE(SUM(i.final_amount), 0)
            FROM invoices i
            WHERE i.organization_id = $1
              AND i.status = 'paid'
              AND i.created_at >= NOW() - ($2::int || ' days')::interval) AS paid_amount,
         (SELECT COALESCE(SUM(i.final_amount), 0)
            FROM invoices i
            WHERE i.organization_id = $1
              AND i.status IN ('pending', 'approved', 'disputed')
              AND i.created_at >= NOW() - ($2::int || ' days')::interval) AS open_amount,
         (SELECT COALESCE(SUM(r.refund_amount), 0)
            FROM returns r
            WHERE r.organization_id = $1
              AND r.status = 'refunded'
              AND r.resolved_at >= NOW() - ($2::int || ' days')::interval) AS refunds_amount,
         (SELECT COALESCE(AVG(i.final_amount), 0)
            FROM invoices i
            WHERE i.organization_id = $1
              AND i.created_at >= NOW() - ($2::int || ' days')::interval) AS avg_invoice_amount,
         (SELECT i.invoice_number
            FROM invoices i
            WHERE i.organization_id = $1
            ORDER BY i.created_at DESC
            LIMIT 1) AS last_invoice_number,
         (SELECT i.status
            FROM invoices i
            WHERE i.organization_id = $1
            ORDER BY i.created_at DESC
            LIMIT 1) AS last_invoice_status,
         (SELECT i.created_at
            FROM invoices i
            WHERE i.organization_id = $1
            ORDER BY i.created_at DESC
            LIMIT 1) AS last_invoice_created_at`,
      [orgId, rangeDays],
      client
    );

    return result.rows[0] || null;
  }

  async getActiveIncidentBanner(organizationId = null, client = null) {
    const result = await this.query(
      `SELECT b.*
       FROM system_incident_banners b
       WHERE b.is_active = true
         AND (b.starts_at IS NULL OR b.starts_at <= NOW())
         AND (b.ends_at IS NULL OR b.ends_at >= NOW())
         AND (b.organization_id IS NULL OR b.organization_id = $1)
       ORDER BY
         CASE b.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
         b.created_at DESC
       LIMIT 1`,
      [organizationId],
      client
    );
    return result.rows[0] || null;
  }

  async listIncidentBanners(client = null) {
    const result = await this.query(
      `SELECT b.*, o.name AS organization_name
       FROM system_incident_banners b
       LEFT JOIN organizations o ON o.id = b.organization_id
       ORDER BY b.created_at DESC`,
      [],
      client
    );
    return result.rows;
  }

  async createIncidentBanner(data, client = null) {
    const result = await this.query(
      `INSERT INTO system_incident_banners
        (organization_id, title, message, severity, starts_at, ends_at, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       RETURNING *`,
      [
        data.organization_id || null,
        data.title,
        data.message,
        data.severity || 'warning',
        data.starts_at || null,
        data.ends_at || null,
        data.is_active !== false,
        data.actor_id || null,
      ],
      client
    );
    return result.rows[0] || null;
  }

  async updateIncidentBanner(id, data, actorId, client = null) {
    const updates = [];
    const params = [];
    let idx = 1;

    for (const [k, v] of Object.entries(data || {})) {
      updates.push(`${k} = $${idx += 1}`);
      params.push(v);
    }

    updates.push(`updated_by = $${idx += 1}`);
    params.push(actorId || null);
    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await this.query(
      `UPDATE system_incident_banners
       SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING *`,
      params,
      client
    );
    return result.rows[0] || null;
  }

  // Write an immutable audit log entry for superadmin actions
  async logAuditAction({ orgId, action, performedBy, performedByRole, ip, userAgent, beforeState, afterState, metadata } = {}, client = null) {
    await this.query(`
      INSERT INTO organization_audit_logs
        (organization_id, action, performed_by, performed_by_role, ip_address, user_agent, before_state, after_state, metadata)
      VALUES ($1, $2, $3, $4, $5::inet, $6, $7, $8, $9)
    `, [
      orgId || null,
      action,
      performedBy || null,
      performedByRole || null,
      ip || null,
      userAgent || null,
      beforeState ? JSON.stringify(beforeState) : null,
      afterState ? JSON.stringify(afterState) : null,
      metadata ? JSON.stringify(metadata) : null,
    ], client);
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

  async countActiveUsers(organizationId, client = null) {
    const result = await this.query(
      `SELECT COUNT(*)::int AS count
       FROM users
       WHERE organization_id = $1 AND is_active = true`,
      [organizationId],
      client
    );
    return parseInt(result.rows[0]?.count || 0, 10);
  }

  /**
   * Find active organization by its webhook token.
   */
  async findByWebhookToken(token, client = null) {
    const result = await this.query(
      `SELECT id, name, code
       FROM organizations
       WHERE webhook_token = $1
         AND is_active = true
       LIMIT 1`,
      [token], client
    );
    return result.rows[0] || null;
  }
}

export default new OrganizationRepository();
