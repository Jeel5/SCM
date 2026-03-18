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
      query += ` AND (p.organization_id = $${pc += 1} OR p.organization_id IS NULL)`;
      params.push(organizationId);
    }
    if (category) {
      query += ` AND p.category = $${pc += 1}`;
      params.push(category);
    }
    if (is_active !== undefined && is_active !== null) {
      query += ` AND p.is_active = $${pc += 1}`;
      params.push(is_active);
    }
    if (search) {
      query += ` AND (p.name ILIKE $${pc} OR p.sku ILIKE $${pc})`;
      params.push(`%${search}%`);
      pc += 1;
    }
    query += ` ORDER BY p.name ASC LIMIT $${pc += 1} OFFSET $${pc += 1}`;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    return result.rows;
  }

  /**
   * Global product stats (no pagination) for cards.
   */
  async getProductStats({ organizationId } = {}, client = null) {
    const params = [];
    let p = 1;
    let query = `
      SELECT
        COUNT(*)::int AS total_products,
        COUNT(*) FILTER (WHERE p.is_active = true)::int AS active_products,
        COUNT(*) FILTER (WHERE p.is_active = false)::int AS inactive_products,
        COUNT(DISTINCT p.category)::int AS category_count
      FROM products p
      WHERE 1=1
    `;

    if (organizationId) {
      query += ` AND (p.organization_id = $${p += 1} OR p.organization_id IS NULL)`;
      params.push(organizationId);
    }

    const result = await this.query(query, params, client);
    return result.rows[0] || {
      total_products: 0,
      active_products: 0,
      inactive_products: 0,
      category_count: 0,
    };
  }

  /**
   * Find a single product by id, scoped to org.
   */
  async findById(id, organizationId = undefined, client = null) {
    const params = [id];
    const clause = organizationId
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
   * Find a product by SKU within org — returns the FULL product row.
   */
  async findBySku(sku, organizationId = undefined, client = null) {
    const params = [sku];
    const orgClause = organizationId
      ? ' AND (organization_id = $2 OR organization_id IS NULL)'
      : '';
    if (organizationId) params.push(organizationId);
    const result = await this.query(
      `SELECT * FROM products WHERE sku = $1${orgClause} LIMIT 1`,
      params, client
    );
    return result.rows[0] || null;
  }

  /**
   * Returns only products that have available inventory (available_quantity > 0)
   * in at least one warehouse. Used by the webhook catalog endpoint so external
   * platforms (e-commerce stores, portals) can only show/order stocked products.
   *
   * PRODUCTION RULE: An order can only be placed for products returned here.
   */
  async findAvailableProducts({ organizationId, category, limit = 200 } = {}, client = null) {
    const params = [];
    let pc = 1;

    let orgJoin = '';
    let orgWhere = '';
    if (organizationId) {
      orgJoin  = ` AND (p.organization_id = $${pc} OR p.organization_id IS NULL)`;
      orgWhere = ` AND (i.organization_id = $${pc} OR i.organization_id IS NULL)`;
      params.push(organizationId);
      pc += 1;
    }

    let catWhere = '';
    if (category) {
      catWhere = ` AND p.category = $${pc += 1}`;
      params.push(category);
    }

    params.push(limit);

    const query = `
      SELECT
        p.id, p.sku, p.name, p.category, p.description,
        p.selling_price, p.cost_price, p.mrp, p.currency,
        p.weight, p.dimensions, p.volumetric_weight,
        p.is_fragile, p.requires_cold_storage, p.is_hazmat, p.is_perishable,
        p.package_type, p.handling_instructions,
        p.requires_insurance, p.attributes,
        p.manufacturer_barcode, p.internal_barcode, p.hsn_code, p.gst_rate, p.brand, p.country_of_origin,
        p.warranty_period_days, p.shelf_life_days, p.tags, p.supplier_id,
        COALESCE(SUM(i.available_quantity), 0)::int AS total_available,
        COALESCE(SUM(i.reserved_quantity),  0)::int AS total_reserved,
        COUNT(DISTINCT i.warehouse_id)::int          AS warehouse_count
      FROM products p
      INNER JOIN inventory i ON i.sku = p.sku${orgWhere}
      WHERE p.is_active = true
        AND i.available_quantity > 0
        ${orgJoin}${catWhere}
      GROUP BY p.id
      HAVING COALESCE(SUM(i.available_quantity), 0) > 0
      ORDER BY p.name ASC
      LIMIT $${pc}
    `;

    const result = await this.query(query, params, client);
    return result.rows;
  }

  /**
   * Insert a new product row. data must contain all required column values.
   */
  async create(data, client = null) {
    const result = await this.query(
      `INSERT INTO products (
         organization_id, sku, name, category, description, weight, dimensions,
         selling_price, cost_price, mrp, currency,
         is_fragile, requires_cold_storage, is_hazmat, is_perishable,
         package_type, handling_instructions,
         requires_insurance, attributes, is_active,
         manufacturer_barcode, internal_barcode, hsn_code, gst_rate, brand, country_of_origin,
         warranty_period_days, shelf_life_days, tags, supplier_id
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
         $12,$13,$14,$15,$16,$17,$18,$19,true,
         $20,$21,$22,$23,$24,$25,$26,$27,$28,$29
       ) RETURNING *`,
      [
        data.organization_id || null,
        data.sku,
        data.name,
        data.category || null,
        data.description || null,
        data.weight || null,
        data.dimensions ? JSON.stringify(data.dimensions) : null,
        data.selling_price || null,
        data.cost_price || null,
        data.mrp || null,
        data.currency || 'INR',
        data.is_fragile || false,
        data.requires_cold_storage || false,
        data.is_hazmat || false,
        data.is_perishable || false,
        data.package_type || 'box',
        data.handling_instructions || null,
        data.requires_insurance || false,
        data.attributes ? JSON.stringify(data.attributes) : null,
        // barcode fields
        data.manufacturer_barcode || null,
        data.internal_barcode, // REQUIRED, generated by controller
        data.hsn_code || null,
        data.gst_rate != null ? data.gst_rate : 18.00,
        data.brand || null,
        data.country_of_origin || 'India',
        data.warranty_period_days != null ? data.warranty_period_days : 0,
        data.shelf_life_days || null,
        data.tags ? JSON.stringify(data.tags) : '[]',
        data.supplier_id || null,
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
         selling_price         = COALESCE($6,  selling_price),
         cost_price            = COALESCE($7,  cost_price),
         mrp                   = COALESCE($8,  mrp),
         currency              = COALESCE($9,  currency),
         is_fragile            = COALESCE($10, is_fragile),
         requires_cold_storage = COALESCE($11, requires_cold_storage),
         is_hazmat             = COALESCE($12, is_hazmat),
         is_perishable         = COALESCE($13, is_perishable),
         is_active             = COALESCE($14, is_active),
         package_type          = COALESCE($15, package_type),
         handling_instructions = COALESCE($16, handling_instructions),
         requires_insurance    = COALESCE($17, requires_insurance),
         attributes            = COALESCE($18, attributes),
         manufacturer_barcode  = COALESCE($19, manufacturer_barcode),
         hsn_code              = COALESCE($20, hsn_code),
         gst_rate              = COALESCE($21, gst_rate),
         brand                 = COALESCE($22, brand),
         country_of_origin     = COALESCE($23, country_of_origin),
         warranty_period_days  = COALESCE($24, warranty_period_days),
         shelf_life_days       = COALESCE($25, shelf_life_days),
         tags                  = COALESCE($26, tags),
         supplier_id           = COALESCE($27, supplier_id),
         updated_at            = NOW()
       WHERE id = $28
       RETURNING *`,
      [
        data.name           || null,
        data.category       || null,
        data.description    || null,
        data.weight         !== undefined ? data.weight         : null,
        data.dimensions     ? JSON.stringify(data.dimensions)   : null,
        data.selling_price  !== undefined ? data.selling_price  : null,
        data.cost_price     !== undefined ? data.cost_price     : null,
        data.mrp            !== undefined ? data.mrp            : null,
        data.currency       || null,
        data.is_fragile            !== undefined ? data.is_fragile            : null,
        data.requires_cold_storage !== undefined ? data.requires_cold_storage : null,
        data.is_hazmat             !== undefined ? data.is_hazmat             : null,
        data.is_perishable         !== undefined ? data.is_perishable         : null,
        data.is_active             !== undefined ? data.is_active             : null,
        data.package_type          || null,
        data.handling_instructions || null,
        data.requires_insurance !== undefined ? data.requires_insurance : null,
        data.attributes ? JSON.stringify(data.attributes) : null,
        // barcode fields (internal_barcode is NOT updatable - set once at creation)
        data.manufacturer_barcode !== undefined ? (data.manufacturer_barcode || null) : null,
        data.hsn_code             !== undefined ? (data.hsn_code || null) : null,
        data.gst_rate             !== undefined ? data.gst_rate           : null,
        data.brand                !== undefined ? (data.brand || null)    : null,
        data.country_of_origin    !== undefined ? (data.country_of_origin || null) : null,
        data.warranty_period_days !== undefined ? data.warranty_period_days : null,
        data.shelf_life_days      !== undefined ? data.shelf_life_days    : null,
        data.tags ? JSON.stringify(data.tags) : null,
        data.supplier_id !== undefined ? (data.supplier_id || null) : null,
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
    return parseInt(result.rows[0]?.cnt, 10) > 0;
  }
}

export default new ProductRepository();
