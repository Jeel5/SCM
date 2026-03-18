// SalesChannel Repository — CRUD for sales_channels table
import BaseRepository from './BaseRepository.js';

class SalesChannelRepository extends BaseRepository {
  constructor() {
    super('sales_channels');
  }

  /**
   * List sales channels with pagination, search, and org scoping.
   */
  async findChannels({ page = 1, limit = 50, is_active = null, platform_type = null, search = null, organizationId } = {}, client = null) {
    const offset = (page - 1) * limit;
    const params = [];
    let idx = 1;

    let query = `
      SELECT sc.*, w.name AS warehouse_name,
             COUNT(*) OVER() AS total_count
      FROM sales_channels sc
      LEFT JOIN warehouses w ON sc.default_warehouse_id = w.id
      WHERE sc.organization_id = $${idx += 1}
    `;
    params.push(organizationId);

    if (is_active !== null) {
      query += ` AND sc.is_active = $${idx += 1}`;
      params.push(is_active);
    }
    if (platform_type) {
      query += ` AND sc.platform_type = $${idx += 1}`;
      params.push(platform_type);
    }
    if (search) {
      query += ` AND (sc.name ILIKE $${idx} OR sc.code ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx += 1;
    }

    query += ` ORDER BY sc.created_at DESC LIMIT $${idx += 1} OFFSET $${idx}`;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    return {
      channels: result.rows,
      totalCount: result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0,
    };
  }

  /**
   * Find a channel by ID, scoped to org.
   */
  async findByIdScoped(id, organizationId, client = null) {
    const result = await this.query(
      `SELECT sc.*, w.name AS warehouse_name
       FROM sales_channels sc
       LEFT JOIN warehouses w ON sc.default_warehouse_id = w.id
       WHERE sc.id = $1 AND sc.organization_id = $2`,
      [id, organizationId],
      client
    );
    return result.rows[0] || null;
  }

  /**
   * Find channel by code within an org.
   */
  async findByCode(code, organizationId, client = null) {
    const result = await this.query(
      `SELECT * FROM sales_channels WHERE UPPER(code) = $1 AND organization_id = $2`,
      [code.toUpperCase(), organizationId],
      client
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new sales channel.
   */
  async createChannel(data, client = null) {
    const result = await this.query(
      `INSERT INTO sales_channels
         (organization_id, name, code, platform_type, api_endpoint,
          contact_name, contact_email, contact_phone,
          config, default_warehouse_id, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        data.organization_id,
        data.name,
        data.code.toUpperCase().trim(),
        data.platform_type || 'marketplace',
        data.api_endpoint || null,
        data.contact_name || null,
        data.contact_email || null,
        data.contact_phone || null,
        JSON.stringify(data.config || {}),
        data.default_warehouse_id || null,
        data.is_active !== false,
      ],
      client
    );
    return result.rows[0];
  }

  /**
   * Update a sales channel.
   */
  async updateChannel(id, organizationId, data, client = null) {
    const fields = [];
    const params = [];
    let idx = 1;

    const allowed = [
      'name', 'code', 'platform_type', 'api_endpoint',
      'contact_name', 'contact_email', 'contact_phone',
      'config', 'default_warehouse_id', 'is_active',
    ];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        let val = data[key];
        if (key === 'code') val = val.toUpperCase().trim();
        if (key === 'config') val = JSON.stringify(val);
        fields.push(`${key} = $${idx += 1}`);
        params.push(val);
      }
    }

    if (fields.length === 0) return this.findByIdScoped(id, organizationId, client);

    params.push(id, organizationId);
    const result = await this.query(
      `UPDATE sales_channels SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${idx += 1} AND organization_id = $${idx}
       RETURNING *`,
      params,
      client
    );
    return result.rows[0] || null;
  }

  /**
   * Find a channel by its webhook_token (for webhook auth).
   */
  async findByWebhookToken(token, client = null) {
    const result = await this.query(
      `SELECT * FROM sales_channels WHERE webhook_token = $1 AND is_active = true`,
      [token],
      client
    );
    return result.rows[0] || null;
  }

  /**
   * Delete a sales channel.
   */
  async deleteChannel(id, organizationId, client = null) {
    const result = await this.query(
      `DELETE FROM sales_channels WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [id, organizationId],
      client
    );
    return result.rows[0] || null;
  }
}

export default new SalesChannelRepository();
