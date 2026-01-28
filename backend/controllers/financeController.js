import db from '../configs/db.js';

// GET /api/finance/invoices - Get all invoices with pagination
export const getInvoices = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const carrierId = req.query.carrier_id;

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

    const result = await db.query(
      `
      INSERT INTO invoices (
        invoice_number, carrier_id, billing_period_start, billing_period_end,
        total_shipments, base_amount, penalties, adjustments, final_amount, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
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

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
};

// PATCH /api/finance/invoices/:id - Update invoice status
export const updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, penalties, adjustments, final_amount } = req.body;

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

    values.push(id);
    const result = await db.query(
      `UPDATE invoices SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
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

    const result = await db.query(
      `
      UPDATE returns 
      SET 
        status = 'refunded',
        refund_amount = $1,
        restocking_fee = $2,
        resolved_at = NOW()
      WHERE id = $3 AND status = 'inspected'
      RETURNING *
      `,
      [refund_amount, restocking_fee || 0, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Return not found or not ready for refund' });
    }

    res.json(result.rows[0]);
  } catch (error) {
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

    query += ` ORDER BY i.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM invoices WHERE status = 'disputed'`
    );
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

    const result = await db.query(
      `
      UPDATE invoices 
      SET 
        status = 'approved',
        final_amount = COALESCE($1, final_amount)
      WHERE id = $2 AND status = 'disputed'
      RETURNING *
      `,
      [adjusted_amount, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error resolving dispute:', error);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
};

// GET /api/finance/summary - Get financial summary
export const getFinancialSummary = async (req, res) => {
  try {
    const timeRange = req.query.range || 'month'; // day, week, month, year
    
    let dateFilter = "NOW() - INTERVAL '30 days'";
    if (timeRange === 'day') dateFilter = "NOW() - INTERVAL '1 day'";
    if (timeRange === 'week') dateFilter = "NOW() - INTERVAL '7 days'";
    if (timeRange === 'year') dateFilter = "NOW() - INTERVAL '1 year'";

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
        WHERE created_at >= ${dateFilter}
        `
      ),
      db.query(
        `
        SELECT 
          COUNT(*) as total_refunds,
          COALESCE(SUM(refund_amount), 0) as total_refund_amount,
          COALESCE(SUM(restocking_fee), 0) as total_restocking_fees
        FROM returns
        WHERE status = 'refunded' AND resolved_at >= ${dateFilter}
        `
      ),
      db.query(
        `
        SELECT COUNT(*) as total_disputes
        FROM invoices
        WHERE status = 'disputed' AND created_at >= ${dateFilter}
        `
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
