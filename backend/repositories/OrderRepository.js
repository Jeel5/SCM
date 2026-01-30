// Order Repository - handles all database operations for orders and order_items
import BaseRepository from './BaseRepository.js';

class OrderRepository extends BaseRepository {
  constructor() {
    super('orders');
  }

  // Get orders with pagination, filters (status, search), and sorting
  async findOrders({ page = 1, limit = 20, status = null, search = null, sortBy = 'created_at', sortOrder = 'DESC' }, client = null) {
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

    // Status filter
    if (status) {
      query += ` AND o.status = $${paramCount++}`;
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
      paramCount++;
    }

    // Group by for aggregation
    query += ` GROUP BY o.id`;

    // Sorting
    const validSortColumns = ['created_at', 'updated_at', 'total_amount', 'status', 'order_number'];
    const orderByColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY o.${orderByColumn} ${orderDirection}`;

    // Pagination
    query += ` LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    
    return {
      orders: result.rows,
      totalCount: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0
    };
  }

  /**
   * Find order by ID with all items
   */
  // Get order with all its items using JSON aggregation
  async findOrderWithItems(orderId, client = null) {
    const query = `
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
      GROUP BY o.id
    `;

    const result = await this.query(query, [orderId], client);
    return result.rows[0] || null;
  }

  // Create order with items in single transaction
  async createOrderWithItems(orderData, items, client) {
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
      const itemsQuery = `
        INSERT INTO order_items (order_id, product_id, sku, product_name, quantity, unit_price, total_price, weight, warehouse_id)
        VALUES ${items.map((_, idx) => {
          const base = idx * 9;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`;
        }).join(', ')}
        RETURNING *
      `;

      const itemsParams = items.flatMap(item => [
        order.id,
        item.product_id,
        item.sku,
        item.product_name,
        item.quantity,
        item.unit_price,
        item.total_price || (item.quantity * item.unit_price),
        item.weight || null,
        item.warehouse_id || null
      ]);

      const itemsResult = await this.query(itemsQuery, itemsParams, client);
      order.items = itemsResult.rows;
    }

    return order;
  }

  // Update order status and timestamp
  async updateStatus(orderId, status, client = null) {
    const query = `
      UPDATE orders
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await this.query(query, [status, orderId], client);
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
  async findByStatus(status, limit = 100, client = null) {
    const query = `
      SELECT * FROM orders 
      WHERE status = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await this.query(query, [status, limit], client);
    return result.rows;
  }

  /**
   * Get orders by customer email
   */
  async findByCustomerEmail(email, client = null) {
    const query = `
      SELECT * FROM orders 
      WHERE customer_email = $1 
      ORDER BY created_at DESC
    `;
    const result = await this.query(query, [email], client);
    return result.rows;
  }

  /**
   * Get order statistics
   */
  async getOrderStats(dateFrom = null, dateTo = null, client = null) {
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

    if (dateFrom) {
      query += ` AND created_at >= $${paramCount++}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ` AND created_at <= $${paramCount++}`;
      params.push(dateTo);
    }

    const result = await this.query(query, params, client);
    return result.rows[0];
  }
}

export default new OrderRepository();
