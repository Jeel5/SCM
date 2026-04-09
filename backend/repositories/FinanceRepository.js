// Finance Repository - handles invoices, refunds, disputes, and financial summaries
import BaseRepository from './BaseRepository.js';
import { RETURN_REFUND_ELIGIBLE_STATUSES } from '../config/returnStatuses.js';

class FinanceRepository extends BaseRepository {
  constructor() {
    super('invoices');
  }

  /**
   * Paginated invoice list with carrier JOIN and window COUNT.
   * Returns { invoices, totalCount }.
   */
  async findInvoices({ page = 1, limit = 20, status = null, carrier_id = null, organizationId = undefined } = {}, client = null) {
    const offset = (page - 1) * limit;
    const params = [];
    let p = 1;

    let query = `
      SELECT
        i.*,
        c.name AS carrier_name,
        c.code AS carrier_code,
        COUNT(*) OVER() AS total_count
      FROM invoices i
      LEFT JOIN carriers c ON i.carrier_id = c.id
      WHERE 1=1
    `;

    if (organizationId !== undefined) {
      const f = this.buildOrgFilter(organizationId, 'i');
      if (f.clause) {
        query += ` AND ${f.clause}$${p}`;
        params.push(...f.params);
        p += 1;
      }
    }
    if (status)     { query += ` AND i.status = $${p}`;      params.push(status); p += 1; }
    if (carrier_id) { query += ` AND i.carrier_id = $${p}`;  params.push(carrier_id); p += 1; }

    query += ` ORDER BY i.created_at DESC LIMIT $${p} OFFSET $${p + 1}`;
    p += 2;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { invoices: result.rows, totalCount };
  }

  /**
   * Single invoice by ID with carrier details.
   * Returns the row or null.
   */
  async findInvoiceById(id, client = null) {
    const result = await this.query(
      `SELECT i.*,
        c.name AS carrier_name, c.code AS carrier_code,
        c.contact_email AS carrier_email, c.contact_phone AS carrier_phone
       FROM invoices i
       LEFT JOIN carriers c ON i.carrier_id = c.id
       WHERE i.id = $1`,
      [id],
      client
    );
    return result.rows[0] || null;
  }

  /**
   * Shipments belonging to a carrier within a billing period.
   */
  async findShipmentsForInvoice(carrierId, periodStart, periodEnd, client = null) {
    const result = await this.query(
      `SELECT s.id, s.tracking_number, s.shipping_cost,
              s.delivery_scheduled, s.delivery_actual, s.status
       FROM shipments s
       WHERE s.carrier_id = $1
         AND s.created_at >= $2
         AND s.created_at <= $3
       ORDER BY s.created_at DESC`,
      [carrierId, periodStart, periodEnd],
      client
    );
    return result.rows;
  }

  /**
   * Paginated refund list (returns in approved/inspected/refunded state) with order JOIN.
   * Returns { refunds, totalCount }.
   */
  async findRefunds({ page = 1, limit = 20, status = null, organizationId = undefined } = {}, client = null) {
    const offset = (page - 1) * limit;
    const params = [RETURN_REFUND_ELIGIBLE_STATUSES];
    let p = 2;

    let query = `
      SELECT
        r.*,
        o.order_number,
        o.customer_name,
        o.customer_email,
        COUNT(*) OVER() AS total_count
      FROM returns r
      LEFT JOIN orders o ON r.order_id = o.id
      WHERE r.status = ANY($1::text[])
    `;

    if (organizationId !== undefined) {
      const f = this.buildOrgFilter(organizationId, 'r');
      if (f.clause) {
        query += ` AND ${f.clause}$${p}`;
        params.push(...f.params);
        p += 1;
      }
    }
    if (status) { query += ` AND r.status = $${p}`; params.push(status); p += 1; }

    query += ` ORDER BY r.created_at DESC LIMIT $${p} OFFSET $${p + 1}`;
    p += 2;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { refunds: result.rows, totalCount };
  }

  /**
   * Paginated disputed invoices with carrier JOIN.
   * Returns { disputes, totalCount }.
   */
  async findDisputes({ page = 1, limit = 20, organizationId = undefined } = {}, client = null) {
    const offset = (page - 1) * limit;
    const params = [];
    let p = 1;

    let query = `
      SELECT
        i.*,
        c.name AS carrier_name,
        c.code AS carrier_code,
        COUNT(*) OVER() AS total_count
      FROM invoices i
      LEFT JOIN carriers c ON i.carrier_id = c.id
      WHERE i.status = 'disputed'
    `;

    if (organizationId !== undefined) {
      const f = this.buildOrgFilter(organizationId, 'i');
      if (f.clause) {
        query += ` AND ${f.clause}$${p}`;
        params.push(...f.params);
        p += 1;
      }
    }

    query += ` ORDER BY i.created_at DESC LIMIT $${p} OFFSET $${p + 1}`;
    p += 2;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { disputes: result.rows, totalCount };
  }

  /**
   * Financial summary (invoices + refunds + disputes) for a given time range.
   * intervalStr: '1 day' | '7 days' | '30 days' | '1 year'
   * Uses $1::INTERVAL to avoid SQL interpolation.
   * Returns { invoices: row, refunds: row, disputes: row }.
   */
  async getFinancialSummary(intervalStr, organizationId = undefined, client = null) {
    const baseParams = [intervalStr];
    let p = 2; // $1 = interval, $2+ = orgId if present
    let orgClause = '';

    if (organizationId !== undefined) {
      const f = this.buildOrgFilter(organizationId);
      if (f.clause) {
        orgClause = ` AND ${f.clause}$${p}`;
        p += 1;
        baseParams.push(...f.params);
      }
    }

    const [invoicesResult, refundsResult, disputesResult] = await Promise.all([
      this.query(
        `SELECT
           COUNT(*) AS total_invoices,
           COALESCE(SUM(final_amount), 0) AS total_amount,
           COALESCE(SUM(CASE WHEN status = 'pending'  THEN final_amount ELSE 0 END), 0) AS pending_amount,
           COALESCE(SUM(CASE WHEN status = 'approved' THEN final_amount ELSE 0 END), 0) AS approved_amount,
           COALESCE(SUM(CASE WHEN status = 'disputed' THEN final_amount ELSE 0 END), 0) AS disputed_amount,
           COALESCE(SUM(CASE WHEN status IN ('pending', 'approved', 'disputed') THEN final_amount ELSE 0 END), 0) AS outstanding_amount,
           COALESCE(SUM(CASE WHEN status = 'paid'     THEN final_amount ELSE 0 END), 0) AS paid_amount,
           COALESCE(SUM(penalties), 0) AS total_penalties
         FROM invoices
         WHERE created_at >= NOW() - $1::INTERVAL${orgClause}`,
        baseParams, client
      ),
      this.query(
        `SELECT
           COUNT(*) AS total_refunds,
           COALESCE(SUM(refund_amount), 0) AS total_refund_amount,
           COALESCE(SUM(restocking_fee), 0) AS total_restocking_fees
         FROM returns
         WHERE status = 'refunded'
           AND COALESCE(resolved_at, updated_at, created_at) >= NOW() - $1::INTERVAL${orgClause}`,
        baseParams, client
      ),
      this.query(
        `SELECT COUNT(*) AS total_disputes
         FROM invoices
         WHERE status = 'disputed'
           AND created_at >= NOW() - $1::INTERVAL${orgClause}`,
        baseParams, client
      ),
    ]);

    return {
      invoices: invoicesResult.rows[0],
      refunds:  refundsResult.rows[0],
      disputes: disputesResult.rows[0],
    };
  }

  /**
   * Check for duplicate invoice number within an organization.
   * @param {string} invoiceNumber
   * @param {string|null} organizationId
   * @param {object} client - pg transaction client (required — called inside a tx)
   * @returns {boolean}
   */
  async invoiceNumberExists(invoiceNumber, organizationId, client) {
    const result = await this.query(
      `SELECT id FROM invoices
       WHERE invoice_number = $1
         AND (organization_id = $2 OR ($2::uuid IS NULL AND organization_id IS NULL))`,
      [invoiceNumber, organizationId || null],
      client
    );
    return result.rows.length > 0;
  }

  /**
   * Insert a new invoice row.
   * @param {object} fields - all invoice columns
   * @param {object} client - pg transaction client
   * @returns {object} inserted row
   */
  async createInvoice(fields, client) {
    const {
      organizationId, invoiceNumber, carrierId,
      billingPeriodStart, billingPeriodEnd, totalShipments,
      baseAmount, penalties, adjustments, finalAmount, status,
    } = fields;
    const result = await this.query(
      `INSERT INTO invoices (
         organization_id, invoice_number, carrier_id,
         billing_period_start, billing_period_end, total_shipments,
         base_amount, penalties, adjustments, final_amount, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        organizationId || null,
        invoiceNumber, carrierId,
        billingPeriodStart, billingPeriodEnd, totalShipments,
        baseAmount, penalties, adjustments, finalAmount, status,
      ],
      client
    );
    return result.rows[0];
  }

  /**
   * Lock an invoice row for update, returning id + current status + final_amount.
   * Returns null if not found.
   * @param {string} id
   * @param {string|null} organizationId
   * @param {object} client - pg transaction client
   */
  async lockInvoiceForUpdate(id, organizationId, client) {
    const sql = organizationId
      ? `SELECT id, status AS old_status, final_amount FROM invoices WHERE id = $1 AND organization_id = $2 FOR UPDATE`
      : `SELECT id, status AS old_status, final_amount FROM invoices WHERE id = $1 FOR UPDATE`;
    const params = organizationId ? [id, organizationId] : [id];
    const result = await this.query(sql, params, client);
    return result.rows[0] || null;
  }

  /**
   * Dynamic partial update of an invoice.
   * @param {string} id
   * @param {{ status?, penalties?, adjustments?, final_amount? }} patches
   * @param {object} client - pg transaction client
   * @returns {object} updated row
   */
  async updateInvoiceFields(id, patches, client) {
    const updates = [];
    const values = [];
    let p = 1;
    if (patches.status       !== undefined) { updates.push(`status = $${p}`);       values.push(patches.status); p += 1; }
    if (patches.penalties    !== undefined) { updates.push(`penalties = $${p}`);    values.push(patches.penalties); p += 1; }
    if (patches.adjustments  !== undefined) { updates.push(`adjustments = $${p}`);  values.push(patches.adjustments); p += 1; }
    if (patches.final_amount !== undefined) { updates.push(`final_amount = $${p}`); values.push(patches.final_amount); p += 1; }
    values.push(id);
    const result = await this.query(
      `UPDATE invoices SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${p} RETURNING *`,
      values,
      client
    );
    return result.rows[0];
  }

  /**
   * Write an immutable finance audit log entry.
   * @param {{ entityType, entityId, action, oldValues, newValues, actorId, actorRole }} fields
   * @param {object} client - pg transaction client
   */
  async insertAuditLog(fields, client) {
    const { entityType, entityId, action, oldValues, newValues, actorId, actorRole } = fields;
    await this.query(
      `INSERT INTO finance_audit_log
         (entity_type, entity_id, action, old_values, new_values, actor_id, actor_role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        entityType, entityId, action,
        JSON.stringify(oldValues), JSON.stringify(newValues),
        actorId || null, actorRole || null,
      ],
      client
    );
  }

  /**
   * Lock a return row for update (used by processRefund).
   * Returns null if not found.
   */
  async lockReturnForRefund(id, client) {
    const result = await this.query(
      `SELECT id, status FROM returns WHERE id = $1 FOR UPDATE`,
      [id],
      client
    );
    return result.rows[0] || null;
  }

  /**
   * Mark a return as refunded.
   * Returns updated row.
   */
  async applyRefund(id, refundAmount, restockingFee, client) {
    const result = await this.query(
      `UPDATE returns
       SET status = 'refunded', refund_amount = $1, restocking_fee = $2, resolved_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [refundAmount, restockingFee || 0, id],
      client
    );
    return result.rows[0];
  }

  /**
   * Resolve a dispute — updates invoice to approved with optional adjusted amount.
   * Returns updated row.
   */
  async resolveDispute(id, adjustedAmount, client) {
    const result = await this.query(
      `UPDATE invoices
       SET status = 'approved', final_amount = COALESCE($1, final_amount)
       WHERE id = $2
       RETURNING *`,
      [adjustedAmount, id],
      client
    );
    return result.rows[0];
  }

  // ─── Methods used by invoiceService ──────────────────────────────────────────

  /**
   * Find a carrier row by id.
   */
  async findCarrierById(carrierId, client = null) {
    const res = await this.query(
      'SELECT * FROM carriers WHERE id = $1',
      [carrierId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Shipments (with order_number) for a carrier in a period that are delivered or returned.
   */
  async findShipmentsForCarrierPeriod(carrierId, periodStart, periodEnd, client = null) {
    const res = await this.query(
      `SELECT s.*, o.order_number
       FROM shipments s
       JOIN orders o ON o.id = s.order_id
       WHERE s.carrier_id = $1
         AND s.created_at >= $2
         AND s.created_at < $3
         AND s.status IN ('delivered', 'returned')
       ORDER BY s.created_at`,
      [carrierId, periodStart, periodEnd],
      client
    );
    return res.rows;
  }

  /**
   * SLA violations (penalty_applied=true) for a carrier in a period.
   */
  async findPenaltiesForCarrierPeriod(carrierId, periodStart, periodEnd, client = null) {
    const res = await this.query(
      `SELECT sv.*, s.tracking_number
       FROM sla_violations sv
       JOIN shipments s ON s.id = sv.shipment_id
       WHERE s.carrier_id = $1
         AND sv.created_at >= $2
         AND sv.created_at < $3
         AND sv.penalty_applied = true`,
      [carrierId, periodStart, periodEnd],
      client
    );
    return res.rows;
  }

  /**
   * Insert a fully auto-generated carrier invoice (includes auto_generated, generation_job_id, payment_due_date).
   */
  async createAutoGeneratedInvoice(fields, client = null) {
    const {
      invoiceNumber, carrierId, billingPeriodStart, billingPeriodEnd,
      totalShipments, baseAmount, penalties, adjustments, finalAmount,
      jobId, paymentDueDate
    } = fields;
    const res = await this.query(
      `INSERT INTO invoices
        (invoice_number, carrier_id, billing_period_start, billing_period_end,
         total_shipments, base_amount, penalties, adjustments, final_amount,
         status, auto_generated, generation_job_id, payment_due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', true, $10, $11)
       RETURNING *`,
      [
        invoiceNumber, carrierId, billingPeriodStart, billingPeriodEnd,
        totalShipments, baseAmount, penalties, adjustments, finalAmount,
        jobId, paymentDueDate
      ],
      client
    );
    return res.rows[0];
  }

  /**
   * Insert a single invoice line item.
   */
  async createInvoiceLineItem({ invoiceId, shipmentId, description, itemType, quantity, unitPrice, amount }, client = null) {
    const res = await this.query(
      `INSERT INTO invoice_line_items
        (invoice_id, shipment_id, description, item_type, quantity, unit_price, amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [invoiceId, shipmentId, description, itemType, quantity, unitPrice, amount],
      client
    );
    return res.rows[0];
  }

  /**
   * Find active carrier IDs for monthly invoice generation.
   * If organizationId is given, only carriers that processed shipments for that org in the period.
   */
  async findCarriersForInvoicePeriod(periodStart, periodEnd, organizationId = undefined, client = null) {
    if (organizationId) {
      const res = await this.query(
        `SELECT DISTINCT c.id
         FROM carriers c
         JOIN shipments s ON s.carrier_id = c.id
         WHERE c.is_active = true
           AND s.organization_id = $1
           AND s.created_at >= $2
           AND s.created_at < $3`,
        [organizationId, periodStart, periodEnd],
        client
      );
      return res.rows;
    }
    const res = await this.query(
      'SELECT id FROM carriers WHERE is_active = true',
      [],
      client
    );
    return res.rows;
  }

  /**
   * Get a single invoice joined with carrier name and code.
   */
  async findInvoiceWithCarrier(invoiceId, client = null) {
    const res = await this.query(
      `SELECT i.*, c.name AS carrier_name, c.code AS carrier_code
       FROM invoices i
       LEFT JOIN carriers c ON c.id = i.carrier_id
       WHERE i.id = $1`,
      [invoiceId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Get all line items for an invoice, ordered by type then created_at.
   */
  async findInvoiceLineItems(invoiceId, client = null) {
    const res = await this.query(
      `SELECT * FROM invoice_line_items
       WHERE invoice_id = $1
       ORDER BY item_type, created_at`,
      [invoiceId],
      client
    );
    return res.rows;
  }

  /**
   * Approve a pending invoice.
   */
  async approveInvoice(invoiceId, approvedBy, organizationId = undefined, client = null) {
    const orgCondition = organizationId ? ' AND organization_id = $2' : '';
    const params = organizationId
      ? [invoiceId, organizationId]
      : [invoiceId];
    const res = await this.query(
      `UPDATE invoices
       SET status      = 'approved',
           updated_at  = NOW()
       WHERE id = $1 AND status = 'pending'${orgCondition}
       RETURNING *`,
      params,
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Mark an approved invoice as paid.
   */
  async markInvoicePaid(invoiceId, paymentMethod, paymentDate, organizationId = undefined, client = null) {
    const orgCondition = organizationId ? ' AND organization_id = $4' : '';
    const params = organizationId
      ? [paymentMethod, paymentDate, invoiceId, organizationId]
      : [paymentMethod, paymentDate, invoiceId];
    const res = await this.query(
      `UPDATE invoices
       SET status         = 'paid',
           payment_method = $1,
           paid_at        = $2,
           paid_amount    = COALESCE(paid_amount, final_amount),
           updated_at     = NOW()
       WHERE id = $3 AND status = 'approved'${orgCondition}
       RETURNING *`,
      params,
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Mark an invoice as disputed.
   */
  async disputeInvoice(invoiceId, organizationId = undefined, client = null) {
    const orgCondition = organizationId ? ' AND organization_id = $2' : '';
    const params = organizationId ? [invoiceId, organizationId] : [invoiceId];
    const res = await this.query(
      `UPDATE invoices
       SET status = 'disputed'
       WHERE id = $1${orgCondition}
       RETURNING *`,
      params,
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Aggregate invoicing summary for a period.
   */
  async getInvoicingSummary(startDate, endDate, organizationId = undefined, client = null) {
    const orgCondition = organizationId ? ' AND organization_id = $3' : '';
    const params = organizationId ? [startDate, endDate, organizationId] : [startDate, endDate];
    const res = await this.query(
      `SELECT
         COUNT(*) AS total_invoices,
         SUM(total_shipments) AS total_shipments,
         SUM(base_amount) AS total_base_amount,
         SUM(penalties) AS total_penalties,
         SUM(adjustments) AS total_adjustments,
         SUM(final_amount) AS total_final_amount,
         COUNT(CASE WHEN status = 'pending'  THEN 1 END) AS pending,
         COUNT(CASE WHEN status = 'approved' THEN 1 END) AS approved,
         COUNT(CASE WHEN status = 'paid'     THEN 1 END) AS paid,
         COUNT(CASE WHEN status = 'disputed' THEN 1 END) AS disputed
       FROM invoices
       WHERE created_at >= $1 AND created_at < $2${orgCondition}`,
      params,
      client
    );
    return res.rows[0];
  }

  /**
   * Get invoice statistics grouped by status for a date range.
   */
  async getInvoiceStatsByDateRange(startDate, endDate, client = null) {
    const result = await this.query(
      `SELECT
         status,
         COUNT(*)                    AS count,
         COALESCE(SUM(final_amount), 0) AS total_amount,
         COALESCE(AVG(final_amount), 0) AS avg_amount
       FROM invoices
       WHERE created_at BETWEEN $1 AND $2
       GROUP BY status`,
      [startDate, endDate], client
    );
    return result.rows;
  }

  /**
   * Create a customer invoice (FROM us TO customer).
   * @param {object} fields - invoice details
   * @param {object} client - pg transaction client
   * @returns {object} inserted row
   */
  async createCustomerInvoice(fields, client) {
    const {
      organizationId, invoiceNumber, customerId, orderId,
      totalAmount, taxAmount, finalAmount, status = 'pending',
      dueDate
    } = fields;
    const result = await this.query(
      `INSERT INTO invoices (
         organization_id, invoice_number, customer_id, order_id,
         base_amount, tax_amount, final_amount, status, due_date,
         invoice_type, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'customer', NOW(), NOW())
       RETURNING *`,
      [
        organizationId || null,
        invoiceNumber, customerId, orderId,
        totalAmount, taxAmount || 0, finalAmount, status,
        dueDate || null
      ],
      client
    );
    return result.rows[0];
  }
}
export default new FinanceRepository();
