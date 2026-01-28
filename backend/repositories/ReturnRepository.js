// Return Repository - handles product returns and refunds
import BaseRepository from './BaseRepository.js';

class ReturnRepository extends BaseRepository {
  constructor() {
    super('returns');
  }

  // Get returns with pagination and filters (status, reason, search)
  async findReturns({ page = 1, limit = 20, status = null, reason = null, search = null }, client = null) {
    const offset = (page - 1) * limit;
    const params = [];
    let paramCount = 1;
    
    let query = `
      SELECT r.*,
        COUNT(*) OVER() as total_count
      FROM returns r
      WHERE 1=1
    `;

    if (status) {
      query += ` AND r.status = $${paramCount++}`;
      params.push(status);
    }

    if (reason) {
      query += ` AND r.reason = $${paramCount++}`;
      params.push(reason);
    }

    if (search) {
      query += ` AND (
        r.return_number ILIKE $${paramCount} OR
        r.requested_by ILIKE $${paramCount} OR
        r.customer_email ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY r.created_at DESC`;
    query += ` LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    
    return {
      returns: result.rows,
      totalCount: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0
    };
  }

  /**
   * Find return by ID with items
   */
  async findReturnWithItems(returnId, client = null) {
    const query = `
      SELECT 
        r.*,
        json_agg(
          json_build_object(
            'id', ri.id,
            'product_id', ri.product_id,
            'sku', ri.sku,
            'product_name', ri.product_name,
            'quantity', ri.quantity,
            'condition', ri.condition,
            'reason', ri.reason
          ) ORDER BY ri.id
        ) FILTER (WHERE ri.id IS NOT NULL) as items
      FROM returns r
      LEFT JOIN return_items ri ON r.id = ri.return_id
      WHERE r.id = $1
      GROUP BY r.id
    `;

    const result = await this.query(query, [returnId], client);
    return result.rows[0] || null;
  }

  /**
   * Find returns by order ID
   */
  async findByOrderId(orderId, client = null) {
    const query = `
      SELECT * FROM returns 
      WHERE order_id = $1 
      ORDER BY created_at DESC
    `;
    const result = await this.query(query, [orderId], client);
    return result.rows;
  }

  /**
   * Find returns by customer email
   */
  async findByCustomerEmail(email, client = null) {
    const query = `
      SELECT * FROM returns 
      WHERE customer_email = $1 
      ORDER BY created_at DESC
    `;
    const result = await this.query(query, [email], client);
    return result.rows;
  }

  /**
   * Update return status
   */
  async updateStatus(returnId, status, additionalData = {}, client = null) {
    const updates = ['status = $1', 'updated_at = NOW()'];
    const params = [status];
    let paramCount = 2;

    if (additionalData.inspection_notes) {
      updates.push(`inspection_notes = $${paramCount++}`);
      params.push(additionalData.inspection_notes);
    }

    if (additionalData.refund_amount !== undefined) {
      updates.push(`refund_amount = $${paramCount++}`);
      params.push(additionalData.refund_amount);
    }

    if (additionalData.refund_method) {
      updates.push(`refund_method = $${paramCount++}`);
      params.push(additionalData.refund_method);
    }

    if (status === 'completed' || status === 'refunded') {
      updates.push('completed_at = NOW()');
    }

    params.push(returnId);

    const query = `
      UPDATE returns
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  /**
   * Create return with items
   */
  async createReturnWithItems(returnData, items, client) {
    // Insert return
    const returnKeys = Object.keys(returnData);
    const returnValues = Object.values(returnData);
    const returnPlaceholders = returnKeys.map((_, idx) => `$${idx + 1}`).join(', ');
    
    const returnQuery = `
      INSERT INTO returns (${returnKeys.join(', ')})
      VALUES (${returnPlaceholders})
      RETURNING *
    `;
    
    const returnResult = await this.query(returnQuery, returnValues, client);
    const returnRecord = returnResult.rows[0];

    // Insert return items
    if (items && items.length > 0) {
      const itemsQuery = `
        INSERT INTO return_items (return_id, product_id, sku, product_name, quantity, condition, reason)
        VALUES ${items.map((_, idx) => {
          const base = idx * 7;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
        }).join(', ')}
        RETURNING *
      `;

      const itemsParams = items.flatMap(item => [
        returnRecord.id,
        item.product_id,
        item.sku,
        item.product_name,
        item.quantity,
        item.condition || null,
        item.reason || null
      ]);

      const itemsResult = await this.query(itemsQuery, itemsParams, client);
      returnRecord.items = itemsResult.rows;
    }

    return returnRecord;
  }

  /**
   * Get return statistics
   */
  async getReturnStats(dateFrom = null, dateTo = null, client = null) {
    const params = [];
    let paramCount = 1;
    
    let query = `
      SELECT 
        COUNT(*) as total_returns,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_returns,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_returns,
        SUM(refund_amount) as total_refund_amount,
        AVG(refund_amount) FILTER (WHERE refund_amount IS NOT NULL) as avg_refund_amount,
        COUNT(*) FILTER (WHERE reason = 'damaged') as damaged_count,
        COUNT(*) FILTER (WHERE reason = 'defective') as defective_count,
        COUNT(*) FILTER (WHERE reason = 'wrong_item') as wrong_item_count
      FROM returns
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

  /**
   * Get returns by status
   */
  async findByStatus(status, limit = 100, client = null) {
    const query = `
      SELECT * FROM returns 
      WHERE status = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await this.query(query, [status, limit], client);
    return result.rows;
  }
}

export default new ReturnRepository();
