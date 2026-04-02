// Supplier Repository — CRUD for suppliers table
import BaseRepository from './BaseRepository.js';

class SupplierRepository extends BaseRepository {
  constructor() {
    super('suppliers');
  }

  /**
   * List suppliers with pagination, search, and org scoping.
   */
  async findSuppliers({ page = 1, limit = 50, is_active = null, search = null, organizationId } = {}, client = null) {
    const offset = (page - 1) * limit;
    const params = [];
    let idx = 1;

    let query = `
      SELECT *,
             COUNT(*) OVER() AS total_count
      FROM suppliers
      WHERE organization_id = $${idx}
    `;
    params.push(organizationId);
    idx += 1;

    if (is_active !== null) {
      query += ` AND is_active = $${idx}`;
      idx += 1;
      params.push(is_active);
    }
    if (search) {
      query += ` AND (name ILIKE $${idx} OR code ILIKE $${idx} OR contact_name ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx += 1;
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    return {
      suppliers: result.rows,
      totalCount: result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0,
    };
  }

  /**
   * Find a supplier by ID, scoped to org.
   */
  async findByIdScoped(id, organizationId, client = null) {
    const result = await this.query(
      `SELECT * FROM suppliers WHERE id = $1 AND organization_id = $2`,
      [id, organizationId],
      client
    );
    return result.rows[0] || null;
  }

  /**
   * Find supplier by code within an org.
   */
  async findByCode(code, organizationId, client = null) {
    const result = await this.query(
      `SELECT * FROM suppliers WHERE UPPER(code) = $1 AND organization_id = $2`,
      [code.toUpperCase(), organizationId],
      client
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new supplier.
   */
  async createSupplier(data, client = null) {
    const result = await this.query(
      `INSERT INTO suppliers
         (organization_id, name, code,
          contact_name, contact_email, contact_phone,
          address, city, state, country, postal_code,
          api_endpoint, inbound_contact_name, inbound_contact_email, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        data.organization_id,
        data.name,
        data.code.toUpperCase().trim(),
        data.contact_name || null,
        data.contact_email || null,
        data.contact_phone || null,
        data.address || null,
        data.city || null,
        data.state || null,
        data.country || 'India',
        data.postal_code || null,
        data.api_endpoint || null,
        data.inbound_contact_name || null,
        data.inbound_contact_email || null,
        data.is_active !== false,
      ],
      client
    );
    return result.rows[0];
  }

  /**
   * Update a supplier.
   */
  async updateSupplier(id, organizationId, data, client = null) {
    const fields = [];
    const params = [];
    let idx = 1;

    const allowed = [
      'name', 'code', 'contact_name', 'contact_email', 'contact_phone',
      'address', 'city', 'state', 'country', 'postal_code',
      'api_endpoint', 'inbound_contact_name', 'inbound_contact_email', 'is_active',
    ];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        let val = data[key];
        if (key === 'code') val = val.toUpperCase().trim();
        fields.push(`${key} = $${idx}`);
        idx += 1;
        params.push(val);
      }
    }

    if (fields.length === 0) return this.findByIdScoped(id, organizationId, client);

    params.push(id, organizationId);
    const result = await this.query(
      `UPDATE suppliers SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${idx} AND organization_id = $${idx + 1}
       RETURNING *`,
      params,
      client
    );
    return result.rows[0] || null;
  }

  /**
   * Delete a supplier.
   */
  async deleteSupplier(id, organizationId, client = null) {
    const result = await this.query(
      `DELETE FROM suppliers WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [id, organizationId],
      client
    );
    return result.rows[0] || null;
  }
}

export default new SupplierRepository();
