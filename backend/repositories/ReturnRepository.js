// Return Repository - handles product returns and refunds
import BaseRepository from './BaseRepository.js';

class ReturnRepository extends BaseRepository {
  constructor() {
    super('returns');
  }

  // Get returns with pagination and filters (status, reason, search)
  async findReturns({ page = 1, limit = 20, status = null, reason = null, search = null, organizationId = undefined }, client = null) {
    const offset = (page - 1) * limit;
    const params = [];
    let paramCount = 1;
    
    let query = `
      SELECT r.*,
        COUNT(*) OVER() as total_count
      FROM returns r
      WHERE 1=1
    `;

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId, 'r');
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${paramCount++}`;
        params.push(...orgFilter.params);
      }
    }

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
        r.rma_number ILIKE $${paramCount} OR
        r.customer_name ILIKE $${paramCount} OR
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
  async findReturnWithItems(returnId, organizationId = undefined, client = null) {
    let query = `
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
    `;
    const params = [returnId];

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId, 'r');
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$2`;
        params.push(...orgFilter.params);
      }
    }

    query += ` GROUP BY r.id`;

    const result = await this.query(query, params, client);
    return result.rows[0] || null;
  }

  /**
   * Find returns by order ID
   */
  async findByOrderId(orderId, organizationId = undefined, client = null) {
    let query = `
      SELECT * FROM returns 
      WHERE order_id = $1
    `;
    const params = [orderId];

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
   * Find returns by customer email
   */
  async findByCustomerEmail(email, organizationId = undefined, client = null) {
    let query = `
      SELECT * FROM returns 
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
   * Update return status with optional field overrides.
   * additionalData: { notes?, refund_amount?, refund_method? }
   */
  async updateStatus(returnId, status, organizationId = undefined, additionalData = {}, client = null) {
    const updates = ['status = $1', 'updated_at = NOW()'];
    const params = [status];
    let paramCount = 2;

    if (additionalData.notes) {
      updates.push(`quality_check_notes = $${paramCount++}`);
      params.push(additionalData.notes);
    }

    if (additionalData.refund_amount !== undefined) {
      updates.push(`refund_amount = $${paramCount++}`);
      params.push(additionalData.refund_amount);
    }

    if (status === 'approved') {
      updates.push('approved_at = NOW()');
    } else if (status === 'completed' || status === 'refunded') {
      updates.push('resolved_at = NOW()');
    }

    params.push(returnId);

    let query = `
      UPDATE returns
      SET ${updates.join(', ')}
      WHERE id = $${paramCount++}`;

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId);
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${paramCount++}`;
        params.push(...orgFilter.params);
      }
    }

    query += ` RETURNING *`;

    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  /**
   * Find returns with order number (for list views).
   */
  async findReturnsWithDetails({ page = 1, limit = 20, status = null, reason = null, organizationId = undefined } = {}, client = null) {
    const offset = (page - 1) * limit;
    const params = [];
    let paramCount = 1;

    let query = `
      SELECT r.*, o.order_number, o.shipping_address AS customer_address,
        COUNT(*) OVER() AS total_count
      FROM returns r
      JOIN orders o ON r.order_id = o.id
      WHERE 1=1
    `;

    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId, 'r');
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${paramCount++}`;
        params.push(...orgFilter.params);
      }
    }

    if (status) {
      query += ` AND r.status = $${paramCount++}`;
      params.push(status);
    }

    if (reason) {
      query += ` AND r.reason = $${paramCount++}`;
      params.push(reason);
    }

    query += ` ORDER BY r.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
    return { returns: result.rows, totalCount };
  }

  /**
   * Global return status counts (no pagination) for cards/tabs.
   */
  async getReturnStatusStats(organizationId = undefined, client = null) {
    const params = [];
    let p = 1;
    let query = `
      SELECT
        COUNT(*)::int AS total_returns,
        COUNT(*) FILTER (WHERE r.status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE r.status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE r.status = 'rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE r.status = 'completed')::int AS completed
      FROM returns r
      WHERE 1=1
    `;

    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId, 'r');
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${p++}`;
        params.push(...orgFilter.params);
      }
    }

    const result = await this.query(query, params, client);
    return result.rows[0] || {
      total_returns: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
    };
  }

  /**
   * Find a single return with order details and enriched item list.
   */
  async findReturnDetails(returnId, organizationId = undefined, client = null) {
    let query = `
      SELECT r.*, o.order_number, o.shipping_address AS customer_address,
        json_agg(
          json_build_object(
            'id',           ri.id,
            'product_id',   ri.product_id,
            'product_name', COALESCE(p.name, ri.product_name),
            'sku',          COALESCE(p.sku, ri.sku),
            'quantity',     ri.quantity,
            'condition',    ri.condition,
            'reason',       ri.reason
          ) ORDER BY ri.id
        ) FILTER (WHERE ri.id IS NOT NULL) AS items
      FROM returns r
      JOIN orders        o  ON o.id          = r.order_id
      LEFT JOIN return_items ri ON ri.return_id   = r.id
      LEFT JOIN products     p  ON p.id           = ri.product_id
      WHERE r.id = $1
    `;
    const params = [returnId];

    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId, 'r');
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$2`;
        params.push(...orgFilter.params);
      }
    }

    query += ` GROUP BY r.id, o.order_number, o.shipping_address`;

    const result = await this.query(query, params, client);
    return result.rows[0] || null;
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
  async getReturnStats(dateFrom = null, dateTo = null, organizationId = undefined, client = null) {
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

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId);
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${paramCount++}`;
        params.push(...orgFilter.params);
      }
    }

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
  async findByStatus(status, organizationId = undefined, limit = 100, client = null) {
    let query = `
      SELECT * FROM returns 
      WHERE status = $1
    `;
    const params = [status];
    let paramCount = 2;

    // Add organization filter for multi-tenancy
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId);
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$${paramCount++}`;
        params.push(...orgFilter.params);
      }
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    params.push(limit);

    const result = await this.query(query, params, client);
    return result.rows;
  }

  /**
   * Return aggregate stats + reason breakdown for the last 30 days.
   * Used by returnsController.getReturnStats.
   *
   * @param {string|null} organizationId
   * @param {object|null} client
   * @returns {Promise<{ stats: object, reasons: Array }>}
   */
  async getLast30DayStats(organizationId = null, client = null) {
    const orgClause = organizationId ? ' AND organization_id = $1' : '';
    const orgArgs   = organizationId ? [organizationId] : [];

    const [statsRes, reasonsRes] = await Promise.all([
      this.query(
        `SELECT
           COUNT(*) AS total_returns,
           COUNT(*) FILTER (WHERE status = 'pending')    AS pending,
           COUNT(*) FILTER (WHERE status = 'approved')   AS approved,
           COUNT(*) FILTER (WHERE status = 'processing') AS processing,
           COUNT(*) FILTER (WHERE status = 'completed')  AS completed,
           COUNT(*) FILTER (WHERE status = 'rejected')   AS rejected,
           COALESCE(SUM(refund_amount), 0)                AS total_refunds,
           COALESCE(SUM(restocking_fee),   0)            AS total_restock_fees
         FROM returns
         WHERE created_at >= NOW() - INTERVAL '30 days'${orgClause}`,
        orgArgs, client
      ),
      this.query(
        `SELECT reason, COUNT(*) AS count
         FROM returns
         WHERE created_at >= NOW() - INTERVAL '30 days'${orgClause}
         GROUP BY reason
         ORDER BY count DESC`,
        orgArgs, client
      )
    ]);

    return { stats: statsRes.rows[0], reasons: reasonsRes.rows };
  }

  // ─── Methods used by returnsService ──────────────────────────────────────────

  /**
   * Schedule a pickup for a return that is in requested/approved status.
   */
  async schedulePickup(returnId, pickupDate, timeSlot, pickupAddress, client = null) {
    const res = await this.query(
      `UPDATE returns
       SET pickup_scheduled_date = $1,
           pickup_time_slot      = $2,
           pickup_address        = $3,
           status                = 'pickup_scheduled'
       WHERE id = $4 AND status IN ('requested', 'approved')
       RETURNING *`,
      [pickupDate, timeSlot, JSON.stringify(pickupAddress), returnId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Mark pickup as completed (status: pickup_scheduled → in_transit).
   */
  async completePickup(returnId, client = null) {
    const res = await this.query(
      `UPDATE returns
       SET pickup_completed_at = NOW(),
           status              = 'in_transit'
       WHERE id = $1 AND status = 'pickup_scheduled'
       RETURNING *`,
      [returnId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Get a single return by id (bare row, no joins).
   */
  async findByIdRaw(returnId, client = null) {
    const res = await this.query(
      'SELECT * FROM returns WHERE id = $1',
      [returnId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Update the inspection result fields on a return.
   */
  async updateInspectionResult(returnId, qualityCheckResult, inspectionNotes, client = null) {
    const res = await this.query(
      `UPDATE returns
       SET quality_check_result = $1,
           quality_check_notes  = $2,
           status               = 'inspected'
       WHERE id = $3
       RETURNING *`,
      [qualityCheckResult, inspectionNotes, returnId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Get return items joined with warehouse_id (from order_items) and sku (from products).
   */
  async findReturnItemsWithInventoryInfo(returnId, client = null) {
    const res = await this.query(
      `SELECT ri.*, oi.warehouse_id, p.sku
       FROM return_items ri
       JOIN order_items oi ON oi.id = ri.order_item_id
       JOIN products    p  ON p.id  = ri.product_id
       WHERE ri.return_id = $1`,
      [returnId],
      client
    );
    return res.rows;
  }

  /**
   * Upsert inventory stock for a warehouse+product, adding qty on conflict.
   */
  async upsertInventoryStock(warehouseId, productId, quantity, client = null) {
    const res = await this.query(
      `INSERT INTO inventory (warehouse_id, product_id, available_quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (warehouse_id, product_id) WHERE product_id IS NOT NULL
       DO UPDATE SET available_quantity = inventory.available_quantity + $3`,
      [warehouseId, productId, quantity],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Insert an inbound stock movement for a return.
   */
  async insertStockMovement({ warehouseId, productId, quantity, returnId, notes }, client = null) {
    const res = await this.query(
      `INSERT INTO stock_movements
        (warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, notes)
       VALUES ($1, $2, 'inbound', $3, 'return', $4, $5)
       RETURNING *`,
      [warehouseId, productId, quantity, returnId, notes],
      client
    );
    return res.rows[0];
  }

  /**
   * Get return items joined with warehouse_id (no product join needed for damage tracking).
   */
  async findReturnItemsWithWarehouse(returnId, client = null) {
    const res = await this.query(
      `SELECT ri.*, oi.warehouse_id
       FROM return_items ri
       JOIN order_items oi ON oi.id = ri.order_item_id
       WHERE ri.return_id = $1`,
      [returnId],
      client
    );
    return res.rows;
  }

  /**
   * Increment damaged_quantity on an inventory row.
   */
  async markDamagedInventory(warehouseId, productId, quantity, client = null) {
    const res = await this.query(
      `UPDATE inventory
       SET damaged_quantity = damaged_quantity + $1
       WHERE warehouse_id = $2 AND product_id = $3
       RETURNING *`,
      [quantity, warehouseId, productId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Get a return joined with its order's total_amount.
   */
  async findByIdWithOrderAmount(returnId, client = null) {
    const res = await this.query(
      `SELECT r.*, o.total_amount
       FROM returns r
       JOIN orders o ON o.id = r.order_id
       WHERE r.id = $1`,
      [returnId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Update refund info and mark the return as refunded.
   */
  async updateRefundInfo(returnId, { refundAmount, refundMethod, refundReference }, client = null) {
    const res = await this.query(
      `UPDATE returns
       SET status               = 'refunded',
           refund_amount        = $1,
           refund_method        = $2,
           refund_reference     = $3,
           refund_initiated_at  = NOW(),
           refund_completed_at  = NOW(),
           resolved_at          = NOW()
       WHERE id = $4
       RETURNING *`,
      [refundAmount, refundMethod, refundReference, returnId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Create a REFUND record in the invoices table for finance tracking.
   */
  async createRefundInvoice(rmaNumber, refundAmount, client = null) {
    const res = await this.query(
      `INSERT INTO invoices
        (invoice_number, carrier_id, total_shipments, base_amount, final_amount, status)
       VALUES ($1, NULL, 0, $2, $3, 'paid')
       RETURNING *`,
      [`REFUND-${rmaNumber}`, -refundAmount, -refundAmount],
      client
    );
    return res.rows[0];
  }

  /**
   * Reject a return with a reason.
   */
  async rejectReturn(returnId, reason, client = null) {
    const res = await this.query(
      `UPDATE returns
       SET status              = 'rejected',
           quality_check_notes = $1,
           resolved_at         = NOW()
       WHERE id = $2
       RETURNING *`,
      [reason, returnId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Get a return with the order number and customer name.
   */
  async findByIdWithOrderNumber(returnId, client = null) {
    const res = await this.query(
      `SELECT r.*, o.order_number, o.customer_name
       FROM returns r
       JOIN orders o ON o.id = r.order_id
       WHERE r.id = $1`,
      [returnId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Get return items with product name and sku.
   */
  async findItemsWithProductInfo(returnId, client = null) {
    const res = await this.query(
      `SELECT ri.*, p.name AS product_name, p.sku
       FROM return_items ri
       JOIN products p ON p.id = ri.product_id
       WHERE ri.return_id = $1`,
      [returnId],
      client
    );
    return res.rows;
  }

  /**
   * Aggregate return analytics for a date range.
   */
  async getAnalytics(startDate, endDate, client = null) {
    const [summaryRes, reasonsRes] = await Promise.all([
      this.query(
        `SELECT
           COUNT(*) AS total_returns,
           COUNT(CASE WHEN status = 'refunded'                 THEN 1 END) AS completed_returns,
           COUNT(CASE WHEN status = 'rejected'                 THEN 1 END) AS rejected_returns,
           COUNT(CASE WHEN quality_check_result = 'passed'     THEN 1 END) AS quality_passed,
           COUNT(CASE WHEN quality_check_result = 'failed'     THEN 1 END) AS quality_failed,
           COALESCE(SUM(refund_amount), 0)                                  AS total_refunded,
           COALESCE(AVG(refund_amount), 0)                                  AS avg_refund_amount,
           COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - requested_at)) / 86400), 0) AS avg_resolution_days
         FROM returns
         WHERE requested_at >= $1 AND requested_at < $2`,
        [startDate, endDate],
        client
      ),
      this.query(
        `SELECT reason, COUNT(*) AS count
         FROM returns
         WHERE requested_at >= $1 AND requested_at < $2
         GROUP BY reason
         ORDER BY count DESC
         LIMIT 10`,
        [startDate, endDate],
        client
      ),
    ]);

    return { summary: summaryRes.rows[0], topReasons: reasonsRes.rows };
  }

  /**
   * Find returns with pickups scheduled for today or overdue that haven't been reminded.
   */
  async findPendingPickupReminders(client = null) {
    const result = await this.query(
      `SELECT r.*, u.email, u.first_name, u.last_name
       FROM returns r
       JOIN users u ON r.customer_id = u.id
       WHERE r.status = 'pickup_scheduled'
         AND r.pickup_date <= CURRENT_DATE + INTERVAL '1 day'
         AND r.pickup_reminder_sent = false
       ORDER BY r.pickup_date ASC`,
      [], client
    );
    return result.rows;
  }

  /**
   * Mark a return's pickup reminder as sent.
   */
  async markReminderSent(returnId, client = null) {
    await this.query(
      'UPDATE returns SET pickup_reminder_sent = true WHERE id = $1',
      [returnId], client
    );
  }

  /**
   * Create a return record from a webhook payload.
   */
  async createFromWebhook({ organizationId, externalReturnId, externalOrderId, customerName, customerEmail, items, refundAmount }, client = null) {
    const result = await this.query(
      `INSERT INTO returns (
        organization_id,
        external_return_id, order_id, customer_name, customer_email,
        items, refund_amount, status, created_at
      ) VALUES ($1, $2,
        (SELECT id FROM orders WHERE external_order_id = $3 LIMIT 1),
        $4, $5, $6, $7, 'pending', NOW())
      RETURNING id`,
      [organizationId, externalReturnId, externalOrderId, customerName, customerEmail, JSON.stringify(items), refundAmount],
      client
    );
    return result.rows[0];
  }

  /**
   * Get refund statistics for a date range.
   */
  async getRefundStats(startDate, endDate, client = null) {
    const result = await this.query(
      `SELECT
         COUNT(*)                      AS count,
         COALESCE(SUM(refund_amount), 0) AS total_refunded,
         COALESCE(AVG(refund_amount), 0) AS avg_refund
       FROM returns
       WHERE status = 'refunded'
         AND resolved_at BETWEEN $1 AND $2`,
      [startDate, endDate], client
    );
    return result.rows[0];
  }
}

export default new ReturnRepository();
