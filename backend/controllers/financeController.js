// Finance Controller - handles invoices, refunds, disputes, and financial reporting
import db from '../config/db.js';
import { withTransaction } from '../utils/dbTransaction.js';

// Get invoices list with pagination and filters
export const getInvoices = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const carrierId = req.query.carrier_id;
    const organizationId = req.orgContext?.organizationId;

    let query = `
      SELECT 
        i.*,
        c.name as carrier_name,
        c.code as carrier_code
      FROM invoices i
      LEFT JOIN carriers c ON i.carrier_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // Multi-tenant filter: org users only see their org's invoices
    if (organizationId) {
      query += ` AND i.organization_id = $${paramCount}`;
      params.push(organizationId);
      paramCount++;
    }

    if (status) {
      query += ` AND i.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (carrierId) {
      query += ` AND i.carrier_id = $${paramCount}`;
      params.push(carrierId);
      paramCount++;
    }

    query += ` ORDER BY i.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM invoices i WHERE 1=1';
    const countParams = [];
    let countParamNum = 1;

    if (organizationId) {
      countQuery += ` AND i.organization_id = $${countParamNum}`;
      countParams.push(organizationId);
      countParamNum++;
    }

    if (status) {
      countQuery += ` AND i.status = $${countParamNum}`;
      countParams.push(status);
      countParamNum++;
    }

    if (carrierId) {
      countQuery += ` AND i.carrier_id = $${countParamNum}`;
      countParams.push(carrierId);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};

// GET /api/finance/invoices/:id - Get invoice by ID
export const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `
      SELECT 
        i.*,
        c.name as carrier_name,
        c.code as carrier_code,
        c.contact_email as carrier_email,
        c.contact_phone as carrier_phone
      FROM invoices i
      LEFT JOIN carriers c ON i.carrier_id = c.id
      WHERE i.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const organizationId = req.user?.organizationId || req.orgContext?.organizationId;
    if (organizationId && result.rows[0].organization_id !== organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get associated shipments for this billing period
    const shipmentsResult = await db.query(
      `
      SELECT 
        s.id,
        s.tracking_number,
        s.shipping_cost,
        s.delivery_scheduled,
        s.delivery_actual,
        s.status
      FROM shipments s
      WHERE s.carrier_id = $1
        AND s.created_at >= $2
        AND s.created_at <= $3
      ORDER BY s.created_at DESC
      `,
      [
        result.rows[0].carrier_id,
        result.rows[0].billing_period_start,
        result.rows[0].billing_period_end,
      ]
    );

    res.json({
      ...result.rows[0],
      shipments: shipmentsResult.rows,
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
};

// POST /api/finance/invoices - Create new invoice
export const createInvoice = async (req, res) => {
  try {
    const organizationId = req.orgContext?.organizationId;
    const {
      invoice_number,
      carrier_id,
      billing_period_start,
      billing_period_end,
      total_shipments,
      base_amount,
      penalties,
      adjustments,
      final_amount,
      status = 'pending',
    } = req.body;

    const row = await withTransaction(async (tx) => {
      // Check for duplicate invoice number within the same org
      const dup = await tx.query(
        `SELECT id FROM invoices WHERE invoice_number = $1
           AND (organization_id = $2 OR ($2::uuid IS NULL AND organization_id IS NULL))`,
        [invoice_number, organizationId || null]
      );
      if (dup.rows.length > 0) {
        const err = new Error('Duplicate invoice number');
        err.statusCode = 409;
        throw err;
      }

      const result = await tx.query(
        `
        INSERT INTO invoices (
          organization_id,
          invoice_number, carrier_id, billing_period_start, billing_period_end,
          total_shipments, base_amount, penalties, adjustments, final_amount, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
        `,
        [
          organizationId || null,
          invoice_number,
          carrier_id,
          billing_period_start,
          billing_period_end,
          total_shipments,
          base_amount,
          penalties,
          adjustments,
          final_amount,
          status,
        ]
      );
      return result.rows[0];
    });

    res.status(201).json(row);
  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({ error: error.message });
    }
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
};

// PATCH /api/finance/invoices/:id - Update invoice status
export const updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, penalties, adjustments, final_amount } = req.body;
    const actorId = req.user?.userId;
    const organizationId = req.user?.organizationId;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (status) {
      updates.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }
    if (penalties !== undefined) {
      updates.push(`penalties = $${paramCount}`);
      values.push(penalties);
      paramCount++;
    }
    if (adjustments !== undefined) {
      updates.push(`adjustments = $${paramCount}`);
      values.push(adjustments);
      paramCount++;
    }
    if (final_amount !== undefined) {
      updates.push(`final_amount = $${paramCount}`);
      values.push(final_amount);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Valid invoice status transitions (TASK-R9-020)
    const INVOICE_VALID_TRANSITIONS = {
      pending:   ['approved', 'disputed', 'cancelled'],
      approved:  ['paid', 'disputed'],
      disputed:  ['approved', 'cancelled'],
      paid:      [],
      cancelled: [],
    };

    // TASK-R9-018: wrap in transaction for consistency with other finance writes
    const updatedRow = await withTransaction(async (tx) => {
      // Org ownership check
      const own = await tx.query(
        `SELECT id, status AS old_status FROM invoices WHERE id = $1${organizationId ? ' AND organization_id = $2' : ''} FOR UPDATE`,
        organizationId ? [id, organizationId] : [id]
      );
      if (own.rows.length === 0) return null;

      // Validate status transition before applying the update (TASK-R9-020)
      if (status) {
        const currentStatus = own.rows[0].old_status;
        const allowed = INVOICE_VALID_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(status)) {
          const err = new Error(`Invalid status transition: ${currentStatus} → ${status}`);
          err.statusCode = 422;
          throw err;
        }
      }

      values.push(id);
      const result = await tx.query(
        `UPDATE invoices SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`,
        values
      );
      if (!result.rows[0]) return null;

      // Write immutable finance audit trail (TASK-R9-019)
      await tx.query(
        `INSERT INTO finance_audit_log
           (entity_type, entity_id, action, old_values, new_values, actor_id, actor_role, created_at)
         VALUES ('invoice', $1, 'status_change', $2, $3, $4, $5, NOW())`,
        [
          id,
          JSON.stringify({ status: own.rows[0].old_status }),
          JSON.stringify({ status, penalties, adjustments, final_amount }),
          actorId || null,
          req.user?.role || null,
        ]
      );

      return result.rows[0];
    });

    if (!updatedRow) {
      return res.status(404).json({ error: 'Invoice not found or access denied' });
    }

    res.json(updatedRow);
  } catch (error) {
    if (error.statusCode === 422) return res.status(422).json({ error: error.message });
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
};

// GET /api/finance/refunds - Get all refunds with pagination
export const getRefunds = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const organizationId = req.orgContext?.organizationId;

    let query = `
      SELECT 
        r.*,
        o.order_number,
        o.customer_name,
        o.customer_email
      FROM returns r
      LEFT JOIN orders o ON r.order_id = o.id
      WHERE r.status IN ('approved', 'inspected', 'refunded')
    `;
    const params = [];
    let paramCount = 1;

    if (organizationId) {
      query += ` AND r.organization_id = $${paramCount}`;
      params.push(organizationId);
      paramCount++;
    }

    if (status) {
      query += ` AND r.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` ORDER BY r.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) FROM returns r
      WHERE r.status IN ('approved', 'inspected', 'refunded')
    `;
    const countParams = [];
    let countParamNum = 1;

    if (organizationId) {
      countQuery += ` AND r.organization_id = $${countParamNum}`;
      countParams.push(organizationId);
      countParamNum++;
    }

    if (status) {
      countQuery += ` AND r.status = $${countParamNum}`;
      countParams.push(status);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching refunds:', error);
    res.status(500).json({ error: 'Failed to fetch refunds' });
  }
};

// POST /api/finance/refunds/:id/process - Process a refund
export const processRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { refund_amount, restocking_fee, notes } = req.body;

    const row = await withTransaction(async (tx) => {
      // Lock the return row to prevent concurrent double-refund
      const lock = await tx.query(
        `SELECT id, status FROM returns WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (lock.rows.length === 0) {
        const err = new Error('Return not found');
        err.statusCode = 404;
        throw err;
      }
      if (lock.rows[0].status !== 'inspected') {
        const err = new Error('Return not ready for refund (status must be inspected)');
        err.statusCode = 409;
        throw err;
      }

      const result = await tx.query(
        `
        UPDATE returns 
        SET 
          status = 'refunded',
          refund_amount = $1,
          restocking_fee = $2,
          resolved_at = NOW()
        WHERE id = $3
        RETURNING *
        `,
        [refund_amount, restocking_fee || 0, id]
      );

      // Write immutable finance audit trail (TASK-R9-019)
      await tx.query(
        `INSERT INTO finance_audit_log
           (entity_type, entity_id, action, old_values, new_values, actor_id, actor_role, created_at)
         VALUES ('refund', $1, 'refund_processed', $2, $3, $4, $5, NOW())`,
        [
          id,
          JSON.stringify({ status: 'inspected' }),
          JSON.stringify({ status: 'refunded', refund_amount, restocking_fee: restocking_fee || 0 }),
          req.user?.userId || null,
          req.user?.role || null,
        ]
      );

      return result.rows[0];
    });

    res.json(row);
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).json({ error: error.message });
    if (error.statusCode === 409) return res.status(409).json({ error: error.message });
    console.error('Error processing refund:', error);
    res.status(500).json({ error: 'Failed to process refund' });
  }
};

// GET /api/finance/disputes - Get all disputes
export const getDisputes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const organizationId = req.orgContext?.organizationId;

    let query = `
      SELECT 
        i.*,
        c.name as carrier_name,
        c.code as carrier_code
      FROM invoices i
      LEFT JOIN carriers c ON i.carrier_id = c.id
      WHERE i.status = 'disputed'
    `;
    const params = [];
    let paramCount = 1;

    if (organizationId) {
      query += ` AND i.organization_id = $${paramCount}`;
      params.push(organizationId);
      paramCount++;
    }

    query += ` ORDER BY i.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count — must be org-scoped to match the main query
    let countQuery = `SELECT COUNT(*) FROM invoices WHERE status = 'disputed'`;
    const countParams = [];
    if (organizationId) {
      countQuery += ` AND organization_id = $1`;
      countParams.push(organizationId);
    }
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching disputes:', error);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
};

// POST /api/finance/disputes/:id/resolve - Resolve a dispute
export const resolveDispute = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution, adjusted_amount } = req.body;

    const row = await withTransaction(async (tx) => {
      // Lock the invoice row to prevent concurrent dispute resolution
      const lock = await tx.query(
        `SELECT id, status, final_amount FROM invoices WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (lock.rows.length === 0) {
        const err = new Error('Invoice not found');
        err.statusCode = 404;
        throw err;
      }
      if (lock.rows[0].status !== 'disputed') {
        const err = new Error('Invoice is not in disputed status');
        err.statusCode = 409;
        throw err;
      }

      const result = await tx.query(
        `
        UPDATE invoices 
        SET 
          status = 'approved',
          final_amount = COALESCE($1, final_amount)
        WHERE id = $2
        RETURNING *
        `,
        [adjusted_amount, id]
      );

      // Write immutable finance audit trail (TASK-R9-019)
      await tx.query(
        `INSERT INTO finance_audit_log
           (entity_type, entity_id, action, old_values, new_values, actor_id, actor_role, created_at)
         VALUES ('invoice', $1, 'dispute_resolved', $2, $3, $4, $5, NOW())`,
        [
          id,
          JSON.stringify({ status: 'disputed', final_amount: lock.rows[0].final_amount }),
          JSON.stringify({ status: 'approved', final_amount: adjusted_amount ?? lock.rows[0].final_amount }),
          req.user?.userId || null,
          req.user?.role || null,
        ]
      );

      return result.rows[0];
    });

    res.json(row);
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).json({ error: error.message });
    if (error.statusCode === 409) return res.status(409).json({ error: error.message });
    console.error('Error resolving dispute:', error);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
};

// GET /api/finance/summary - Get financial summary
export const getFinancialSummary = async (req, res) => {
  try {
    const timeRange = req.query.range || 'month'; // day, week, month, year
    const organizationId = req.orgContext?.organizationId;
    
    let dateFilter = "NOW() - INTERVAL '30 days'";
    if (timeRange === 'day') dateFilter = "NOW() - INTERVAL '1 day'";
    if (timeRange === 'week') dateFilter = "NOW() - INTERVAL '7 days'";
    if (timeRange === 'year') dateFilter = "NOW() - INTERVAL '1 year'";

    // Use parameterized queries to prevent SQL injection
    const orgParam = organizationId ? ' AND organization_id = $1' : '';
    const orgArgs = organizationId ? [organizationId] : [];

    const [invoicesResult, refundsResult, disputesResult] = await Promise.all([
      db.query(
        `
        SELECT 
          COUNT(*) as total_invoices,
          COALESCE(SUM(final_amount), 0) as total_amount,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN final_amount ELSE 0 END), 0) as pending_amount,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN final_amount ELSE 0 END), 0) as paid_amount,
          COALESCE(SUM(penalties), 0) as total_penalties
        FROM invoices
        WHERE created_at >= ${dateFilter}${orgParam}
        `, orgArgs
      ),
      db.query(
        `
        SELECT 
          COUNT(*) as total_refunds,
          COALESCE(SUM(refund_amount), 0) as total_refund_amount,
          COALESCE(SUM(restocking_fee), 0) as total_restocking_fees
        FROM returns
        WHERE status = 'refunded' AND resolved_at >= ${dateFilter}${orgParam}
        `, orgArgs
      ),
      db.query(
        `
        SELECT COUNT(*) as total_disputes
        FROM invoices
        WHERE status = 'disputed' AND created_at >= ${dateFilter}${orgParam}
        `, orgArgs
      ),
    ]);

    res.json({
      timeRange,
      invoices: invoicesResult.rows[0],
      refunds: refundsResult.rows[0],
      disputes: disputesResult.rows[0],
    });
  } catch (error) {
    console.error('Error fetching financial summary:', error);
    res.status(500).json({ error: 'Failed to fetch financial summary' });
  }
};
