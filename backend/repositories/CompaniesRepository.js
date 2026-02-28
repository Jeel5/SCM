// Companies Repository - thin BaseRepository wrapper for organization/company queries
// used by the superadmin companies management controller.
import BaseRepository from './BaseRepository.js';

class CompaniesRepository extends BaseRepository {
  constructor() {
    super('organizations');
  }

  /** Full list of companies with user/order aggregates (superadmin). */
  async findAllWithStats() {
    const sql = `
      SELECT
        o.id, o.name, o.code, o.website, o.email, o.phone,
        o.address, o.city, o.state, o.country, o.postal_code,
        o.created_at, o.updated_at,
        COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'admin') AS admin_count,
        COUNT(DISTINCT u.id) AS user_count,
        COUNT(DISTINCT ord.id) AS order_count,
        COALESCE(SUM(ord.total_amount), 0) AS total_revenue,
        CASE
          WHEN COUNT(DISTINCT u.id) > 0 AND MAX(u.last_login) > NOW() - INTERVAL '7 days' THEN 'active'
          WHEN COUNT(DISTINCT u.id) > 0 THEN 'inactive'
          ELSE 'suspended'
        END AS status
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id AND u.is_active = true
      LEFT JOIN orders ord ON ord.organization_id = o.id
      WHERE o.is_deleted IS NOT TRUE
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;
    const result = await this.query(sql);
    return result.rows;
  }

  /** Single company with user/order aggregates. Returns null if not found / deleted. */
  async findByIdWithStats(id) {
    const sql = `
      SELECT
        o.*,
        COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'admin') AS admin_count,
        COUNT(DISTINCT u.id) AS user_count,
        COUNT(DISTINCT ord.id) AS order_count,
        COALESCE(SUM(ord.total_amount), 0) AS total_revenue
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id AND u.is_active = true
      LEFT JOIN orders ord ON ord.organization_id = o.id
      WHERE o.id = $1 AND o.is_deleted IS NOT TRUE
      GROUP BY o.id
    `;
    const result = await this.query(sql, [id]);
    return result.rows[0] || null;
  }

  /**
   * Check whether an organization code is already taken.
   * Used inside a transaction to lock duplicate creation.
   * @param {string} code
   * @param {object} [client] - optional pg transaction client
   * @returns {boolean}
   */
  async codeExists(code, client) {
    const result = await this.query(
      'SELECT id FROM organizations WHERE code = $1',
      [code],
      client
    );
    return result.rows.length > 0;
  }

  /**
   * Insert a new organization row inside a transaction.
   * @param {object} fields - { name, code, email, phone, website, street, city, state, country, postalCode }
   * @param {object} client - pg transaction client (required)
   * @returns {object} inserted row
   */
  async createOrganization(fields, client) {
    const sql = `
      INSERT INTO organizations (
        name, code, email, phone, website,
        address, city, state, country, postal_code
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const values = [
      fields.name, fields.code, fields.email, fields.phone,
      fields.website || null,
      fields.street, fields.city, fields.state,
      fields.country || 'India',
      fields.postalCode,
    ];
    const result = await this.query(sql, values, client);
    return result.rows[0];
  }

  /**
   * COALESCE-based partial update — any undefined field keeps its DB value.
   * Returns null if the row does not exist.
   */
  async updateOrganization(id, fields) {
    const sql = `
      UPDATE organizations
      SET
        name         = COALESCE($1, name),
        email        = COALESCE($2, email),
        phone        = COALESCE($3, phone),
        website      = COALESCE($4, website),
        address      = COALESCE($5, address),
        city         = COALESCE($6, city),
        state        = COALESCE($7, state),
        country      = COALESCE($8, country),
        postal_code  = COALESCE($9, postal_code),
        updated_at   = NOW()
      WHERE id = $10
      RETURNING *
    `;
    const values = [
      fields.name, fields.email, fields.phone, fields.website,
      fields.street, fields.city, fields.state, fields.country,
      fields.postalCode,
      id,
    ];
    const result = await this.query(sql, values);
    return result.rows[0] || null;
  }

  /**
   * Check existence + deletion status + user/order counts before a soft-delete.
   * Returns null if the org does not exist at all.
   */
  async findForDeletion(id) {
    const sql = `
      SELECT
        org.id, org.is_deleted,
        COUNT(DISTINCT u.id) AS user_count,
        COUNT(DISTINCT o.id) AS order_count
      FROM organizations org
      LEFT JOIN users u ON u.organization_id = org.id
      LEFT JOIN orders o ON o.organization_id = org.id
      WHERE org.id = $1
      GROUP BY org.id
    `;
    const result = await this.query(sql, [id]);
    return result.rows[0] || null;
  }

  /**
   * Soft-delete an organization (sets is_deleted=TRUE, records who deleted it).
   * Returns null if the row was already deleted or not found.
   */
  async softDelete(id, deletedById) {
    const sql = `
      UPDATE organizations
      SET
        is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_by = $2,
        updated_at = NOW()
      WHERE id = $1 AND is_deleted = FALSE
      RETURNING id, name, code
    `;
    const result = await this.query(sql, [id, deletedById]);
    return result.rows[0] || null;
  }

  /** Active users belonging to a company, ordered by creation date. */
  async findUsersByCompany(companyId) {
    const sql = `
      SELECT id, email, name, role, avatar, is_active, last_login, created_at
      FROM users
      WHERE organization_id = $1
      ORDER BY created_at DESC
    `;
    const result = await this.query(sql, [companyId]);
    return result.rows;
  }

  /** Aggregated global stats for the superadmin dashboard. */
  async getGlobalStats() {
    const sql = `
      SELECT
        (SELECT COUNT(*) FROM organizations) AS total_companies,
        (SELECT COUNT(*) FROM organizations o
         WHERE EXISTS (
           SELECT 1 FROM users u
           WHERE u.organization_id = o.id
             AND u.last_login > NOW() - INTERVAL '7 days'
         )) AS active_companies,
        (SELECT COUNT(*) FROM users WHERE is_active = true) AS total_users,
        (SELECT COUNT(*) FROM orders) AS total_orders,
        (SELECT COUNT(*) FROM shipments WHERE status NOT IN ('delivered', 'cancelled')) AS active_shipments,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders) AS total_revenue,
        (SELECT ROUND(AVG(sla_compliance_score), 2)
         FROM (
           SELECT
             (COUNT(*) FILTER (WHERE actual_delivery_date <= expected_delivery_date)::FLOAT /
             NULLIF(COUNT(*), 0) * 100) AS sla_compliance_score
           FROM shipments
           WHERE actual_delivery_date IS NOT NULL
           GROUP BY organization_id
         ) AS sla_scores
        ) AS avg_sla_compliance
    `;
    const result = await this.query(sql);
    return result.rows[0];
  }
}

export default new CompaniesRepository();
