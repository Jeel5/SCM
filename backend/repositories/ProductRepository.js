import BaseRepository from './BaseRepository.js';
import { ValidationError } from '../errors/index.js';

class ProductRepository extends BaseRepository {
  constructor() {
    super('products');
  }

  /**
   * Paginated list of products for an org, with optional filters.
   */
  async findProducts({ organizationId, search, category, is_active, limit = 50, offset = 0 } = {}, client = null) {
    let query = `
      SELECT p.*, COUNT(*) OVER() AS total_count
      FROM products p
      WHERE 1=1
    `;
    const params = [];
    let pc = 1;

    if (organizationId) {
      query += ` AND (p.organization_id = $${pc++} OR p.organization_id IS NULL)`;
      params.push(organizationId);
    }
    if (category) {
      query += ` AND p.category = $${pc++}`;
      params.push(category);
    }
    if (is_active !== undefined && is_active !== null) {
      query += ` AND p.is_active = $${pc++}`;
      params.push(is_active);
    }
    if (search) {
      query += ` AND (p.name ILIKE $${pc} OR p.sku ILIKE $${pc})`;
      params.push(`%${search}%`);
      pc++;
    }
    query += ` ORDER BY p.name ASC LIMIT $${pc++} OFFSET $${pc++}`;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    return result.rows;
  }

  /**
   * Find a single product by id, scoped to org.
   */
  async findById(id, organizationId = undefined, client = null) {
    const params = [id];
    let clause = organizationId
      ? ' AND (organization_id = $2 OR organization_id IS NULL)'
      : '';
    if (organizationId) params.push(organizationId);
    const result = await this.query(
      `SELECT * FROM products WHERE id = $1${clause} LIMIT 1`,
      params, client
    );
    return result.rows[0] || null;
  }

  /**
   * Find a product by SKU within org (for duplicate checking).
   */
  async findBySku(sku, organizationId = undefined, client = null) {
    const params = [sku];
    const orgClause = organizationId
      ? ' AND (organization_id = $2 OR organization_id IS NULL)'
      : '';
    if (organizationId) params.push(organizationId);
    const result = await this.query(
      `SELECT id FROM products WHERE sku = $1${orgClause} LIMIT 1`,
      params, client
    );
    return result.rows[0] || null;
  }

  /**
   * Insert a new product row. data must contain all required column values.
   */
  async create(data, client = null) {
    const result = await this.query(
      `INSERT INTO products (
         organization_id, sku, name, category, description, weight, dimensions,
         unit_price, cost_price, currency,
         is_fragile, requires_cold_storage, is_hazmat, is_perishable,
         item_type, package_type, handling_instructions,
         requires_insurance, declared_value, attributes, is_active
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,true)
       RETURNING *`,
      [
        data.organization_id || null,
        data.sku,
        data.name,
        data.category || null,
        data.description || null,
        data.weight || null,
        data.dimensions ? JSON.stringify(data.dimensions) : null,
        data.unit_price || null,
        data.cost_price || null,
        data.currency || 'INR',
        data.is_fragile || false,
        data.requires_cold_storage || false,
        data.is_hazmat || false,
        data.is_perishable || false,
        data.item_type || 'general',
        data.package_type || 'box',
        data.handling_instructions || null,
        data.requires_insurance || false,
        data.declared_value || null,
        data.attributes ? JSON.stringify(data.attributes) : null,
      ],
      client
    );
    return result.rows[0];
  }

  /**
   * Partial update — all fields are COALESCE'd so only fields present in data change.
   */
  async update(id, data, client = null) {
    const result = await this.query(
      `UPDATE products SET
         name                  = COALESCE($1,  name),
         category              = COALESCE($2,  category),
         description           = COALESCE($3,  description),
         weight                = COALESCE($4,  weight),
         dimensions            = COALESCE($5,  dimensions),
         unit_price            = COALESCE($6,  unit_price),
         cost_price            = COALESCE($7,  cost_price),
         currency              = COALESCE($8,  currency),
         is_fragile            = COALESCE($9,  is_fragile),
         requires_cold_storage = COALESCE($10, requires_cold_storage),
         is_hazmat             = COALESCE($11, is_hazmat),
         is_perishable         = COALESCE($12, is_perishable),
         is_active             = COALESCE($13, is_active),
         item_type             = COALESCE($14, item_type),
         package_type          = COALESCE($15, package_type),
         handling_instructions = COALESCE($16, handling_instructions),
         requires_insurance    = COALESCE($17, requires_insurance),
         declared_value        = COALESCE($18, declared_value),
         attributes            = COALESCE($19, attributes),
         images                = COALESCE($20, images),
         updated_at            = NOW()
       WHERE id = $21
       RETURNING *`,
      [
        data.name           || null,
        data.category       || null,
        data.description    || null,
        data.weight         !== undefined ? data.weight         : null,
        data.dimensions     ? JSON.stringify(data.dimensions)   : null,
        data.unit_price     !== undefined ? data.unit_price     : null,
        data.cost_price     !== undefined ? data.cost_price     : null,
        data.currency       || null,
        data.is_fragile             !== undefined ? data.is_fragile             : null,
        data.requires_cold_storage  !== undefined ? data.requires_cold_storage  : null,
        data.is_hazmat              !== undefined ? data.is_hazmat              : null,
        data.is_perishable          !== undefined ? data.is_perishable          : null,
        data.is_active              !== undefined ? data.is_active              : null,
        data.item_type       || null,
        data.package_type    || null,
        data.handling_instructions || null,
        data.requires_insurance !== undefined ? data.requires_insurance : null,
        data.declared_value     !== undefined ? data.declared_value     : null,
        data.attributes ? JSON.stringify(data.attributes) : null,
        data.images     ? JSON.stringify(data.images)     : null,
        id,
      ],
      client
    );
    return result.rows[0] || null;
  }

  /**
   * Hard-delete a product row by id.
   */
  async delete(id, client = null) {
    await this.query('DELETE FROM products WHERE id = $1', [id], client);
  }

  /**
   * Returns true if any inventory row references this product with quantity > 0.
   */
  async isInUse(id, client = null) {
    const result = await this.query(
      `SELECT COUNT(*) AS cnt FROM inventory WHERE product_id = $1 AND quantity > 0 LIMIT 1`,
      [id], client
    );
    return parseInt(result.rows[0]?.cnt) > 0;
  }
}

export default new ProductRepository();
