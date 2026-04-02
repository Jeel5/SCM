// Returns Controller - handles HTTP requests for product returns
import returnRepo from '../repositories/ReturnRepository.js';
import OrderRepository from '../repositories/OrderRepository.js';
import ShipmentRepository from '../repositories/ShipmentRepository.js';
import returnsService from '../services/returnsService.js';
import { withTransaction } from '../utils/dbTransaction.js';
import logger from '../utils/logger.js';
import { emitToOrg } from '../sockets/emitter.js';
import { asyncHandler, NotFoundError, AppError, ValidationError } from '../errors/index.js';
import { cacheWrap, orgSeg, hashParams, invalidatePatterns, invalidationTargets } from '../utils/cache.js';

// Get returns list with filters and pagination
export const listReturns = asyncHandler(async (req, res) => {
  const queryParams = req.validatedQuery || req.query;
  const { page = 1, limit = 20, status, reason } = queryParams;
  const organizationId = req.orgContext?.organizationId;

  const pageNum  = parseInt(page, 10)  || 1;
  const limitNum = Math.min(parseInt(limit, 10) || 20, 100);

  // Cache filtered paginated list for 30 seconds
  const cacheKey = `returns:list:${orgSeg(organizationId)}:${hashParams({ page: pageNum, limit: limitNum, status, reason })}`;
  const cached = await cacheWrap(cacheKey, 30, async () => {
    const [{ returns, totalCount }, statsRow] = await Promise.all([
      returnRepo.findReturnsWithDetails({
        page: pageNum, limit: limitNum, status: status || null, reason: reason || null, organizationId,
      }),
      returnRepo.getReturnStatusStats(organizationId),
    ]);
    return {
      stats: {
        totalReturns: parseInt(statsRow.total_returns || 0, 10),
        pending: parseInt(statsRow.pending || 0, 10),
        requested: parseInt(statsRow.pending || 0, 10),
        approved: parseInt(statsRow.approved || 0, 10),
        rejected: parseInt(statsRow.rejected || 0, 10),
        completed: parseInt(statsRow.completed || 0, 10),
      },
      data: returns.map(r => ({
        id: r.id,
        rmaNumber: r.rma_number,
        orderId: r.order_id,
        orderNumber: r.order_number,
        reason: r.reason,
        status: r.status,
        refundAmount: parseFloat(r.refund_amount || 0),
        restockingFee: parseFloat(r.restocking_fee || 0),
        customerName: r.customer_name,
        customerEmail: r.customer_email,
        items: r.items || [],
        notes: r.quality_check_notes,
        requestedAt: r.requested_at,
        createdAt: r.created_at,
        approvedAt: r.approved_at,
        resolvedAt: r.resolved_at,
      })),
      totalCount
    };
  });

  res.json({
    success: true,
    stats: cached.stats,
    data: cached.data,
    pagination: { page: pageNum, limit: limitNum, total: cached.totalCount },
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
      reason: ret.reason,
      reasonDetail: ret.reason_detail,
      status: ret.status,
      refundAmount: parseFloat(ret.refund_amount || 0),
      restockingFee: parseFloat(ret.restocking_fee || 0),
      refundStatus: ret.refund_status,
      customerName: ret.customer_name,
      customerEmail: ret.customer_email,
      customerPhone: ret.customer_phone,
      notes: ret.quality_check_notes,
      qualityCheckResult: ret.quality_check_result,
      customerAddress: ret.customer_address,
      pickupAddress: ret.pickup_address,
      items: (ret.items || []).map(i => ({
        id: i.id,
        productId: i.product_id,
        productName: i.product_name,
        sku: i.sku,
        quantity: i.quantity,
        condition: i.condition,
        reason: i.reason,
      })),
      createdAt: ret.created_at,
      approvedAt: ret.approved_at,
      receivedAt: ret.received_at,
      resolvedAt: ret.resolved_at,
    },
  });
});

export const createReturn = asyncHandler(async (req, res) => {
  const { order_id, items, reason, reason_details, customer_email, refund_amount } = req.body;

  if (!items || items.length === 0) {
    throw new ValidationError('At least one return item is required');
  }

  if (!order_id) {
    throw new ValidationError('order_id is required');
  }

  if (!reason) {
    throw new ValidationError('reason is required');
  }

  // Defensive: log all items being returned for audit trail
  logger.info('Return creation requested', {
    orderId: order_id,
    reason,
    itemCount: items.length,
    customerEmail: customer_email || 'not provided',
    refundAmount: refund_amount ?? 'not specified',
    items: items.map(i => ({ sku: i.sku, productName: i.product_name, qty: i.quantity })),
  });

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

  if (!returnRecord || !returnRecord.id) {
    logger.error('Return creation returned empty result', { orderId: order_id, rmaNumber });
    throw new AppError('Return creation failed unexpectedly', 500);
  }

  logger.info('Return created successfully', {
    returnId: returnRecord.id,
    rmaNumber,
    orderId: order_id,
    itemCount: items.length,
  });

  emitToOrg(organizationId, 'return:created', returnRecord);
  await invalidatePatterns(invalidationTargets(organizationId, 'returns:list', 'dash', 'analytics'));

  res.status(201).json({ success: true, message: 'Return created successfully', data: returnRecord });
});

export const updateReturn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, inspection_notes, refund_amount, refund_method } = req.body;
  const organizationId = req.orgContext?.organizationId;

  logger.info('Return update requested', {
    returnId: id,
    newStatus: status || 'unchanged',
    hasInspectionNotes: !!inspection_notes,
    refundAmount: refund_amount,
    refundMethod: refund_method,
    organizationId,
  });

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

  const txResult = await withTransaction(async (tx) => {
    const updated = await returnRepo.updateStatus(id, status, organizationId, {
      notes: inspection_notes,
      refund_amount,
      refund_method,
    }, tx);

    if (!updated) throw new NotFoundError('Return');

    let returnShipment = null;
    if (status === 'approved') {
      const order = await OrderRepository.findById(updated.order_id, tx);
      if (!order) {
        throw new NotFoundError('Order');
      }

      const warehouse = await OrderRepository.findWarehouseByOrderId(updated.order_id, tx);

      const originAddress = typeof order.shipping_address === 'string'
        ? JSON.parse(order.shipping_address)
        : (order.shipping_address || {});
      const destinationAddress = typeof warehouse?.address === 'string'
        ? JSON.parse(warehouse.address)
        : (warehouse?.address || originAddress);

      const trackingSuffix = String(Date.now()).slice(-8);
      const trackingNumber = `RET-${trackingSuffix}-${updated.id.slice(0, 6).toUpperCase()}`;

      returnShipment = await ShipmentRepository.createReverseShipment({
        trackingNumber,
        orderId: updated.order_id,
        carrierId: null,
        organizationId: organizationId || updated.organization_id || order.organization_id || null,
        originAddress,
        destinationAddress,
        notes: `Return pickup shipment created automatically for return_id:${updated.id}`,
      }, tx);
    }

    return { updated, returnShipment };
  });

  logger.info('Return updated successfully', {
    returnId: id,
    newStatus: txResult.updated.status,
    returnShipmentId: txResult.returnShipment?.id || null,
  });

  emitToOrg(organizationId, 'return:updated', { id: txResult.updated.id, status: txResult.updated.status });
  if (txResult.returnShipment) {
    emitToOrg(organizationId, 'shipment:created', txResult.returnShipment);
  }
  await invalidatePatterns(invalidationTargets(organizationId, 'returns:list', 'ship:list', 'orders:list', 'dash', 'analytics'));

  res.json({
    success: true,
    message: `Return updated${status ? ` to '${status}'` : ''}`,
    data: {
      ...txResult.updated,
      return_shipment: txResult.returnShipment,
    },
  });
});

export const getReturnStats = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;

  const { stats, reasons } = await returnRepo.getLast30DayStats(organizationId);

  res.json({
    success: true,
    data: {
      totalReturns: parseInt(stats.total_returns, 10),
      byStatus: {
        pending:    parseInt(stats.pending, 10),
        requested:  parseInt(stats.pending, 10),
        approved:   parseInt(stats.approved, 10),
        processing: parseInt(stats.processing, 10),
        completed:  parseInt(stats.completed, 10),
        rejected:   parseInt(stats.rejected, 10),
      },
      totalRefunds:     parseFloat(stats.total_refunds),
      totalRestockFees: parseFloat(stats.total_restock_fees),
      byReason: reasons.map(r => ({ reason: r.reason, count: parseInt(r.count, 10) })),
    },
  });
});
