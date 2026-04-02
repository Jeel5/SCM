// Finance Controller - handles invoices, refunds, disputes, and financial reporting
import financeRepo from '../repositories/FinanceRepository.js';
import invoiceService from '../services/invoiceService.js';
import { INVOICE_VALID_TRANSITIONS } from '../services/invoiceService.js';
import { withTransaction } from '../utils/dbTransaction.js';
import { ok, created, paginated } from '../utils/response.js';
import logger from '../utils/logger.js';
import { asyncHandler, NotFoundError, ConflictError, AppError, AuthorizationError } from '../errors/index.js';

// ── GET /api/finance/invoices ────────────────────────────────────────────────
export const getInvoices = asyncHandler(async (req, res) => {
  const queryParams = req.validatedQuery || req.query;
  const { status, carrier_id: carrierId, page = 1, limit = 20 } = queryParams;
  const pageNum  = parseInt(page, 10)  || 1;
  const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
  const organizationId = req.orgContext?.organizationId;

  const { invoices, totalCount } = await financeRepo.findInvoices({
    page: pageNum, limit: limitNum, status, carrier_id: carrierId, organizationId,
  });

  paginated(res, invoices, { page: pageNum, limit: limitNum, total: totalCount });
});

// ── GET /api/finance/invoices/:id ────────────────────────────────────────────
export const getInvoiceById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;

  const row = await financeRepo.findInvoiceById(id);
  if (!row) throw new NotFoundError('Invoice');

  if (organizationId && row.organization_id !== organizationId) {
    throw new AuthorizationError('Access denied');
  }

  const shipments = await financeRepo.findShipmentsForInvoice(
    row.carrier_id, row.billing_period_start, row.billing_period_end
  );

  ok(res, { ...row, shipments });
});

// ── POST /api/finance/invoices ───────────────────────────────────────────────
export const createInvoice = asyncHandler(async (req, res) => {
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
    const isDuplicate = await financeRepo.invoiceNumberExists(invoice_number, organizationId, tx);
    if (isDuplicate) throw new ConflictError('Duplicate invoice number');

    return financeRepo.createInvoice(
      {
        organizationId, invoiceNumber: invoice_number, carrierId: carrier_id,
        billingPeriodStart: billing_period_start, billingPeriodEnd: billing_period_end,
        totalShipments: total_shipments, baseAmount: base_amount,
        penalties, adjustments, finalAmount: final_amount, status,
      },
      tx
    );
  });

  created(res, row, 'Invoice created successfully');
});

// ── PATCH /api/finance/invoices/:id ─────────────────────────────────────────
export const updateInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, penalties, adjustments, final_amount } = req.body;
  const actorId = req.user?.userId;
  const organizationId = req.orgContext?.organizationId;

  const hasUpdates = status !== undefined || penalties !== undefined
    || adjustments !== undefined || final_amount !== undefined;
  if (!hasUpdates) throw new AppError('No fields to update', 400);

  // TASK-R9-018: wrap in transaction for consistency with other finance writes
  const updatedRow = await withTransaction(async (tx) => {
    // Org ownership check + row lock
    const own = await financeRepo.lockInvoiceForUpdate(id, organizationId, tx);
    if (!own) throw new NotFoundError('Invoice');

    // Validate status transition before applying the update (TASK-R9-020)
    if (status) {
      const currentStatus = own.old_status;
      const allowed = INVOICE_VALID_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(status)) {
        throw new AppError(`Invalid status transition: ${currentStatus} → ${status}`, 422);
      }
    }

    const result = await financeRepo.updateInvoiceFields(id, { status, penalties, adjustments, final_amount }, tx);

    // Write immutable finance audit trail (TASK-R9-019)
    await financeRepo.insertAuditLog(
      {
        entityType: 'invoice', entityId: id, action: 'status_change',
        oldValues: { status: own.old_status },
        newValues: { status, penalties, adjustments, final_amount },
        actorId, actorRole: req.user?.role || null,
      },
      tx
    );

    return result;
  });

  ok(res, updatedRow, 'Invoice updated');
});

// ── POST /api/finance/invoices/:id/approve ─────────────────────────────────
export const approveInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;
  const actorId = req.user?.userId || null;

  const row = await invoiceService.approveInvoice(id, actorId, organizationId);
  ok(res, row, 'Invoice approved successfully');
});

// ── POST /api/finance/invoices/:id/pay ─────────────────────────────────────
export const markInvoicePaid = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { payment_method, payment_date } = req.body;
  const organizationId = req.orgContext?.organizationId;

  const paymentDate = payment_date || new Date().toISOString();
  const row = await invoiceService.markInvoicePaid(id, payment_method, paymentDate, organizationId);

  ok(res, row, 'Invoice marked as paid successfully');
});

// ── GET /api/finance/refunds ─────────────────────────────────────────────────
export const getRefunds = asyncHandler(async (req, res) => {
  const queryParams = req.validatedQuery || req.query;
  const { status, page = 1, limit = 20 } = queryParams;
  const pageNum  = parseInt(page, 10)  || 1;
  const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
  const organizationId = req.orgContext?.organizationId;

  const { refunds, totalCount } = await financeRepo.findRefunds({
    page: pageNum, limit: limitNum, status, organizationId,
  });

  paginated(res, refunds, { page: pageNum, limit: limitNum, total: totalCount });
});

// ── POST /api/finance/refunds/:id/process ────────────────────────────────────
export const processRefund = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { refund_amount, restocking_fee } = req.body;

  const row = await withTransaction(async (tx) => {
    // Lock the return row to prevent concurrent double-refund
    const lock = await financeRepo.lockReturnForRefund(id, tx);
    if (!lock) throw new NotFoundError('Return');
    if (lock.status !== 'inspected') {
      throw new ConflictError('Return not ready for refund (status must be inspected)');
    }

    const result = await financeRepo.applyRefund(id, refund_amount, restocking_fee, tx);

    // Write immutable finance audit trail (TASK-R9-019)
    await financeRepo.insertAuditLog(
      {
        entityType: 'refund', entityId: id, action: 'refund_processed',
        oldValues: { status: 'inspected' },
        newValues: { status: 'refunded', refund_amount, restocking_fee: restocking_fee || 0 },
        actorId: req.user?.userId || null, actorRole: req.user?.role || null,
      },
      tx
    );

    return result;
  });

  ok(res, row, 'Refund processed successfully');
});

// ── GET /api/finance/disputes ────────────────────────────────────────────────
export const getDisputes = asyncHandler(async (req, res) => {
  const queryParams = req.validatedQuery || req.query;
  const { page = 1, limit = 20 } = queryParams;
  const pageNum  = parseInt(page, 10)  || 1;
  const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
  const organizationId = req.orgContext?.organizationId;

  const { disputes, totalCount } = await financeRepo.findDisputes({
    page: pageNum, limit: limitNum, organizationId,
  });

  paginated(res, disputes, { page: pageNum, limit: limitNum, total: totalCount });
});

// ── POST /api/finance/disputes/:id/resolve ───────────────────────────────────
export const resolveDispute = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { adjusted_amount } = req.body;

  const row = await withTransaction(async (tx) => {
    // Lock the invoice row to prevent concurrent dispute resolution
    const lock = await financeRepo.lockInvoiceForUpdate(id, null, tx);
    if (!lock) throw new NotFoundError('Invoice');
    if (lock.old_status !== 'disputed') {
      throw new ConflictError('Invoice is not in disputed status');
    }

    const result = await financeRepo.resolveDispute(id, adjusted_amount, tx);

    // Write immutable finance audit trail (TASK-R9-019)
    await financeRepo.insertAuditLog(
      {
        entityType: 'invoice', entityId: id, action: 'dispute_resolved',
        oldValues: { status: 'disputed', final_amount: lock.final_amount },
        newValues: { status: 'approved', final_amount: adjusted_amount ?? lock.final_amount },
        actorId: req.user?.userId || null, actorRole: req.user?.role || null,
      },
      tx
    );

    return result;
  });

  ok(res, row, 'Dispute resolved successfully');
});

// ── GET /api/finance/summary ─────────────────────────────────────────────────
export const getFinancialSummary = asyncHandler(async (req, res) => {
  const queryParams = req.validatedQuery || req.query;
  const timeRange = queryParams.range || 'month';
  const organizationId = req.orgContext?.organizationId;

  // Whitelist → parameterized interval: eliminates SQL string interpolation
  const INTERVAL_MAP = { day: '1 day', week: '7 days', month: '30 days', year: '1 year' };
  const intervalStr = INTERVAL_MAP[timeRange] || '30 days';

  const { invoices, refunds, disputes } = await financeRepo.getFinancialSummary(
    intervalStr, organizationId
  );

  ok(res, { timeRange, invoices, refunds, disputes });
});
