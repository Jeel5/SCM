// Returns Controller - handles HTTP requests for product returns
import returnRepo from '../repositories/ReturnRepository.js';
import returnsService from '../services/returnsService.js';
import { withTransaction } from '../utils/dbTransaction.js';
import logger from '../utils/logger.js';
import { asyncHandler, NotFoundError, AppError, ValidationError } from '../errors/index.js';

// Get returns list with filters and pagination
export const listReturns = asyncHandler(async (req, res) => {
  const queryParams = req.validatedQuery || req.query;
  const { page = 1, limit = 20, status, reason } = queryParams;
  const organizationId = req.orgContext?.organizationId;

  const { returns, totalCount } = await returnRepo.findReturnsWithDetails({
    page:  parseInt(page)  || 1,
    limit: Math.min(parseInt(limit) || 20, 100),
    status:  status  || null,
    reason:  reason  || null,
    organizationId,
  });

  res.json({
    success: true,
    data: returns.map(r => ({
      id: r.id,
      rmaNumber: r.rma_number,
      orderId: r.order_id,
      orderNumber: r.order_number,
      quantity: r.quantity,
      reason: r.reason,
      status: r.status,
      refundAmount: parseFloat(r.refund_amount || 0),
      restockFee: parseFloat(r.restock_fee || 0),
      returnTrackingNumber: r.return_tracking_number,
      notes: r.notes,
      createdAt: r.created_at,
      processedAt: r.processed_at,
      completedAt: r.completed_at,
    })),
    pagination: {
      page: parseInt(page),
      limit: Math.min(parseInt(limit) || 20, 100),
      total: totalCount,
    },
  });
});

export const getReturn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;

  const ret = await returnRepo.findReturnDetails(id, organizationId);
  if (!ret) throw new NotFoundError('Return');

  res.json({
    success: true,
    data: {
      id: ret.id,
      rmaNumber: ret.rma_number,
      orderId: ret.order_id,
      orderNumber: ret.order_number,
      quantity: ret.quantity,
      reason: ret.reason,
      status: ret.status,
      refundAmount: parseFloat(ret.refund_amount || 0),
      restockFee: parseFloat(ret.restock_fee || 0),
      returnTrackingNumber: ret.return_tracking_number,
      notes: ret.notes,
      customerAddress: ret.customer_address,
      items: ret.items || [],
      createdAt: ret.created_at,
      processedAt: ret.processed_at,
      completedAt: ret.completed_at,
    },
  });
});

export const createReturn = asyncHandler(async (req, res) => {
  const { order_id, items, reason, reason_details, customer_email, refund_amount } = req.body;

  if (!items || items.length === 0) {
    throw new ValidationError('At least one return item is required');
  }

  const rmaNumber = `RMA-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const organizationId = req.orgContext?.organizationId;

  const returnRecord = await withTransaction(async (tx) => {
    return await returnRepo.createReturnWithItems(
      {
        rma_number:    rmaNumber,
        order_id,
        reason,
        reason_detail: reason_details ?? null,
        customer_email,
        refund_amount:  refund_amount ?? null,
        organization_id: organizationId,
      },
      items.map(item => ({
        product_id:   item.product_id,
        sku:          item.sku          || null,
        product_name: item.product_name || null,
        quantity:     item.quantity,
        condition:    item.condition    || null,
        reason,
      })),
      tx
    );
  });

  res.status(201).json({ success: true, data: returnRecord });
});

export const updateReturn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, inspection_notes, refund_amount, refund_method } = req.body;
  const organizationId = req.orgContext?.organizationId;

  // ── State machine validation ────────────────────────────────────────────
  if (status) {
    const current = await returnRepo.findById(id, organizationId);
    if (!current) throw new NotFoundError('Return');
    returnsService.validateTransition(current.status, status);
  }
  // ───────────────────────────────────────────────────────────────────────

  if (!status && refund_amount === undefined && !refund_method && !inspection_notes) {
    throw new ValidationError('No fields to update');
  }

  const updated = await returnRepo.updateStatus(id, status, organizationId, {
    notes: inspection_notes,
    refund_amount,
    refund_method,
  });

  if (!updated) throw new NotFoundError('Return');
  res.json({ success: true, data: updated });
});

export const getReturnStats = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;

  const { stats, reasons } = await returnRepo.getLast30DayStats(organizationId);

  res.json({
    success: true,
    data: {
      totalReturns: parseInt(stats.total_returns),
      byStatus: {
        pending:    parseInt(stats.pending),
        approved:   parseInt(stats.approved),
        processing: parseInt(stats.processing),
        completed:  parseInt(stats.completed),
        rejected:   parseInt(stats.rejected),
      },
      totalRefunds:     parseFloat(stats.total_refunds),
      totalRestockFees: parseFloat(stats.total_restock_fees),
      byReason: reasons.map(r => ({ reason: r.reason, count: parseInt(r.count) })),
    },
  });
});
