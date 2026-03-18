// Order Repository - handles all database operations for orders and order_items
import BaseRepository from './BaseRepository.js';
import { AppError } from '../errors/AppError.js';

class OrderRepository extends BaseRepository {
  constructor() {
    super('orders');
  }

  // Get orders with pagination, filters (status, search), and sorting
  async findOrders({ page = 1, limit = 20, status = null, search = null, sortBy = 'created_at', sortOrder = 'DESC', organizationId = undefined }, client = null) {
    const offset = (page - 1) * limit;
    const params = [];
    let paramCount = 1;
    
    let query = `
      SELECT 
        o.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'product_id', oi.product_id,
              'sku', oi.sku,
              'product_name', oi.product_name,
              'quantity', oi.quantity,
              'unit_price', oi.unit_price,
              'weight', oi.weight,
              'warehouse_id', oi.warehouse_id
            ) ORDER BY oi.id
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) as items,
        COUNT(*) OVER() as total_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE 1=1
    `;

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId, 'o');
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${paramCount += 1}`;
        params.push(...orgFilter.params);
      }
    }

    // Status filter
    if (status) {
      query += ` AND o.status = $${paramCount += 1}`;
      params.push(status);
    }

    // Search filter (order number, customer name, email)
    if (search) {
      query += ` AND (
        o.order_number ILIKE $${paramCount} OR
        o.customer_name ILIKE $${paramCount} OR
        o.customer_email ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount += 1;
    }

    // Group by for aggregation
    query += ` GROUP BY o.id`;

    // Sorting
    const validSortColumns = ['created_at', 'updated_at', 'total_amount', 'status', 'order_number'];
    const orderByColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY o.${orderByColumn} ${orderDirection}`;

    // Pagination
    query += ` LIMIT $${paramCount += 1} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    
    return {
      orders: result.rows,
      totalCount: result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0
    };
  }

  /**
   * Find order by ID with all items
   */
  // Get order with all its items using JSON aggregation
  async findOrderWithItems(orderId, organizationId = undefined, client = null) {
    let query = `
      SELECT 
        o.*,
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'sku', oi.sku,
            'product_name', oi.product_name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'weight', oi.weight,
            'warehouse_id', oi.warehouse_id
          ) ORDER BY oi.id
        ) FILTER (WHERE oi.id IS NOT NULL) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1
    `;
    const params = [orderId];
    let paramCount = 2;

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId, 'o');
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${paramCount += 1}`;
        params.push(...orgFilter.params);
      }
    }

    query += ` GROUP BY o.id`;

    const result = await this.query(query, params, client);
    return result.rows[0] || null;
  }

  // Create order with items in single transaction
  async createOrderWithItems(orderData, items, client) {
    // Fail fast if the caller forgot to pass a transaction client — two separate pool
    // queries without a transaction would leave an orphan order if items insert fails.
    if (!client) {
      throw new AppError('createOrderWithItems requires a transaction client (tx). Wrap the call in withTransaction().', 500, false);
    }
    // Insert order first
    const orderKeys = Object.keys(orderData);
    const orderValues = Object.values(orderData);
    const orderPlaceholders = orderKeys.map((_, idx) => `$${idx + 1}`).join(', ');
    
    const orderQuery = `
      INSERT INTO orders (${orderKeys.join(', ')})
      VALUES (${orderPlaceholders})
      RETURNING *
    `;
    
    const orderResult = await this.query(orderQuery, orderValues, client);
    const order = orderResult.rows[0];

    // Insert order items
    if (items && items.length > 0) {
      // Get all item fields from first item (assuming all items have same structure)
      const itemKeys = Object.keys(items[0]);
      const itemKeysList = ['order_id', ...itemKeys].join(', ');
      
      // Build placeholders for each item
      const itemsQuery = `
        INSERT INTO order_items (${itemKeysList})
        VALUES ${items.map((_, idx) => {
          const base = idx * (itemKeys.length + 1);
          const placeholders = Array.from({ length: itemKeys.length + 1 }, (_, i) => `$${base + i + 1}`).join(', ');
          return `(${placeholders})`;
        }).join(', ')}
        RETURNING *
      `;

      // Flatten all item parameters (order_id + all item fields)
      const itemsParams = items.flatMap(item => [
        order.id,
        ...itemKeys.map(key => item[key] !== undefined ? item[key] : null)
      ]);

      const itemsResult = await this.query(itemsQuery, itemsParams, client);
      order.items = itemsResult.rows;
    }

    return order;
  }

  // Update order status and timestamp
  async updateStatus(orderId, status, organizationId = undefined, client = null) {
    let query = `
      UPDATE orders
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `;
    const params = [status, orderId];
    let paramCount = 3;

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId);
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${paramCount += 1}`;
        params.push(...orgFilter.params);
      }
    }

    query += ` RETURNING *`;
    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  /**
   * Get order items by order ID
   */
  async findOrderItems(orderId, client = null) {
    const query = `SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`;
    const result = await this.query(query, [orderId], client);
    return result.rows;
  }

  /**
   * Get orders by status
   */
  async findByStatus(status, organizationId = undefined, limit = 100, client = null) {
    let query = `
      SELECT * FROM orders 
      WHERE status = $1
    `;
    const params = [status];
    let paramCount = 2;

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId);
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${paramCount += 1}`;
        params.push(...orgFilter.params);
      }
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    params.push(limit);

    const result = await this.query(query, params, client);
    return result.rows;
  }

  /**
   * Get orders by customer email
   */
  async findByCustomerEmail(email, organizationId = undefined, client = null) {
    let query = `
      SELECT * FROM orders 
      WHERE customer_email = $1
    `;
    const params = [email];

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId);
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$2`;
        params.push(...orgFilter.params);
      }
    }

    query += ` ORDER BY created_at DESC`;
    const result = await this.query(query, params, client);
    return result.rows;
  }

  /**
   * Get order statistics
   */
  async getOrderStats(dateFrom = null, dateTo = null, organizationId = undefined, client = null) {
    const params = [];
    let paramCount = 1;
    
    let query = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered_orders,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as average_order_value
      FROM orders
      WHERE 1=1
    `;

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId);
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${paramCount += 1}`;
        params.push(...orgFilter.params);
      }
    }

    if (dateFrom) {
      query += ` AND created_at >= $${paramCount += 1}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ` AND created_at <= $${paramCount += 1}`;
      params.push(dateTo);
    }

    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  /**
   * Global order status counts (no pagination) for UI cards/tabs.
   */
  async getOrderStatusStats(organizationId = undefined, client = null) {
    const params = [];
    let p = 1;

    let query = `
      SELECT
        COUNT(*)::int AS total_orders,
        COUNT(*) FILTER (WHERE status = 'processing')::int AS processing,
        COUNT(*) FILTER (WHERE status = 'shipped')::int AS shipped,
        COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
        COUNT(*) FILTER (WHERE status = 'returned')::int AS returned
      FROM orders o
      WHERE 1=1
    `;

    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId, 'o');
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${p += 1}`;
        params.push(...orgFilter.params);
      }
    }

    const result = await this.query(query, params, client);
    return result.rows[0] || {
      total_orders: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      returned: 0,
    };
  }

  /**
   * Update order status.
   */
  async updateStatus(orderId, status, organizationIdOrClient = undefined, client = null) {
    let organizationId = undefined;
    let txClient = client;

    // Backward compatibility:
    // - updateStatus(id, status, tx)
    // - updateStatus(id, status, organizationId, tx)
    if (
      organizationIdOrClient &&
      typeof organizationIdOrClient === 'object' &&
      typeof organizationIdOrClient.query === 'function'
    ) {
      txClient = organizationIdOrClient;
    } else {
      organizationId = organizationIdOrClient;
    }

    const params = [status, orderId];
    let paramCount = 3;
    let query = `
      UPDATE orders
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `;

    if (organizationId !== undefined) {
      query += ` AND organization_id = $${paramCount += 1}`;
      params.push(organizationId);
    }

    query += ` RETURNING *`;
    const result = await this.query(query, params, txClient);
    return result.rows[0] || null;
  }

  /**
   * Get the next value from the order_number_seq sequence.
   * @param {object} client - pg transaction client
   * @returns {string|number} sequence value
   */
  async nextOrderNumberSeq(client) {
    const result = await this.query(`SELECT nextval('order_number_seq') AS seq`, [], client);
    return result.rows[0].seq;
  }

  /**
   * Get the next value from the transfer_order_number_seq sequence.
   * @param {object} client - pg transaction client
   * @returns {string|number} sequence value
   */
  async nextTransferOrderSeq(client) {
    const result = await this.query(`SELECT nextval('transfer_order_number_seq') AS seq`, [], client);
    return result.rows[0].seq;
  }

  /**
   * Find a single order by ID (selected core columns).
   */
  async findById(orderId, client = null) {
    const result = await this.query(
      `SELECT id, customer_name, customer_email, customer_phone, priority,
              status, shipping_address, total_amount, created_at, order_number,
              external_order_id, tags, organization_id
       FROM orders WHERE id = $1`,
      [orderId], client
    );
    return result.rows[0] || null;
  }

  /**
   * Find order items joined with product shipping attributes.
   */
  async findOrderItemsWithProducts(orderId, client = null) {
    const result = await this.query(
      `SELECT oi.*, p.weight AS product_weight, p.dimensions AS product_dimensions,
              p.is_fragile AS product_is_fragile, p.is_hazmat AS product_is_hazardous
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [orderId], client
    );
    return result.rows;
  }

  /**
   * Find the first warehouse associated with an order's items.
   */
  async findWarehouseByOrderId(orderId, client = null) {
    const result = await this.query(
      `SELECT w.* FROM warehouses w
       JOIN order_items oi ON w.id = oi.warehouse_id
       WHERE oi.order_id = $1
       LIMIT 1`,
      [orderId], client
    );
    return result.rows[0] || null;
  }

  /**
   * Place an order on hold with a system note about exhausted carrier retries.
   */
  async putOnHold(orderId, client = null) {
    await this.query(
      `UPDATE orders
       SET status = 'on_hold',
           notes = CONCAT(COALESCE(notes, ''), '\n[SYSTEM] All carrier assignment attempts exhausted (9 carriers tried). Requires manual carrier assignment.'),
           updated_at = NOW()
       WHERE id = $1`,
      [orderId], client
    );
  }

  /**
   * Update order status and assigned carrier together.
   */
  async updateStatusAndCarrier(orderId, status, carrierId, client = null) {
    await this.query(
      `UPDATE orders SET status = $1, carrier_id = $2, updated_at = NOW() WHERE id = $3`,
      [status, carrierId, orderId], client
    );
  }

  /**
   * Mark the order that owns a given shipment as delivered.
   */
  async updateDeliveredByShipmentId(shipmentId, client = null) {
    await this.query(
      `UPDATE orders SET status = 'delivered', updated_at = NOW()
       WHERE id = (SELECT order_id FROM shipments WHERE id = $1)`,
      [shipmentId], client
    );
  }

  /**
   * Fetch an order along with its items as an aggregated array.
   */
  async findByIdWithAggItems(orderId, client = null) {
    const result = await this.query(
      `SELECT o.*, array_agg(oi.*) AS items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.id = $1
       GROUP BY o.id`,
      [orderId], client
    );
    return result.rows[0] || null;
  }

  // ── Shipping lock management ──────────────────────────────────────────

  /**
   * Atomically acquire a shipping lock on an order.
   * Returns true if lock acquired, false if already locked.
   */
  async acquireShippingLock(orderId, workerId, client = null) {
    const result = await this.query(
      `UPDATE orders
       SET shipping_locked = true,
           shipping_locked_at = NOW(),
           shipping_locked_by = $2
       WHERE id = $1
         AND (shipping_locked = false OR shipping_locked IS NULL)
       RETURNING id`,
      [orderId, workerId], client
    );
    return result.rows.length > 0;
  }

  /**
   * Release a shipping lock on an order.
   */
  async releaseShippingLock(orderId, client = null) {
    await this.query(
      `UPDATE orders
       SET shipping_locked = false,
           shipping_locked_at = NULL,
           shipping_locked_by = NULL
       WHERE id = $1`,
      [orderId], client
    );
  }

  /**
   * Check if an order is shipping-locked.
   */
  async getShippingLockStatus(orderId, client = null) {
    const result = await this.query(
      `SELECT shipping_locked, shipping_locked_at, shipping_locked_by
       FROM orders
       WHERE id = $1`,
      [orderId], client
    );
    return result.rows[0] || null;
  }

  /**
   * Release stale shipping locks older than the given minutes.
   * Uses parameterised interval (minutes * interval '1 minute') to avoid interpolation.
   */
  async releaseStaleLocks(olderThanMinutes, client = null) {
    const result = await this.query(
      `UPDATE orders
       SET shipping_locked = false,
           shipping_locked_at = NULL,
           shipping_locked_by = NULL
       WHERE shipping_locked = true
         AND shipping_locked_at < NOW() - $1::int * INTERVAL '1 minute'
       RETURNING id, shipping_locked_by`,
      [olderThanMinutes], client
    );
    return result.rows;
  }

  // ── Quote idempotency cache ───────────────────────────────────────────

  /**
   * Check if a quote result is cached for the given idempotency key.
   */
  async findCachedQuote(idempotencyKey, client = null) {
    const result = await this.query(
      `SELECT result, created_at
       FROM quote_idempotency_cache
       WHERE idempotency_key = $1 AND expires_at > NOW()`,
      [idempotencyKey], client
    );
    return result.rows[0] || null;
  }

  /**
   * Cache a quote result (upsert).
   * expiryHours is parameterised to avoid SQL interpolation.
   */
  async cacheQuoteResult(idempotencyKey, resultJson, expiryHours, client = null) {
    await this.query(
      `INSERT INTO quote_idempotency_cache (idempotency_key, result, expires_at)
       VALUES ($1, $2, NOW() + $3::int * INTERVAL '1 hour')
       ON CONFLICT (idempotency_key)
       DO UPDATE SET result = $2, expires_at = NOW() + $3::int * INTERVAL '1 hour'`,
      [idempotencyKey, resultJson, expiryHours], client
    );
  }

  /**
   * Clean up expired idempotency cache entries.
   */
  async cleanExpiredQuoteCache(client = null) {
    const result = await this.query(
      `DELETE FROM quote_idempotency_cache
       WHERE expires_at < NOW() - INTERVAL '1 day'`,
      [], client
    );
    return result.rowCount;
  }
}

export default new OrderRepository();
