// Finance validation schemas
import Joi from 'joi';
import { RETURN_REFUND_ELIGIBLE_STATUSES } from '../config/returnStatuses.js';

const INVOICE_STATUSES = ['pending', 'approved', 'disputed', 'paid', 'cancelled'];
const DISPUTE_RESOLUTIONS = ['approved', 'rejected', 'partial'];

// ── Queries ──────────────────────────────────────────────────────────────────

export const listInvoicesQuerySchema = Joi.object({
  page:       Joi.number().integer().min(1).default(1),
  limit:      Joi.number().integer().min(1).max(100).default(20),
  status:     Joi.string().valid(...INVOICE_STATUSES).optional(),
  carrier_id: Joi.string().uuid().optional(),
  date_range: Joi.string().valid('day', 'week', 'month', 'year').optional(),
});

export const listRefundsQuerySchema = Joi.object({
  page:       Joi.number().integer().min(1).default(1),
  limit:      Joi.number().integer().min(1).max(100).default(20),
  status:     Joi.string().valid(...RETURN_REFUND_ELIGIBLE_STATUSES).optional(),
  date_range: Joi.string().valid('day', 'week', 'month', 'year').optional(),
});

export const listDisputesQuerySchema = Joi.object({
  page:       Joi.number().integer().min(1).default(1),
  limit:      Joi.number().integer().min(1).max(100).default(20),
  status:     Joi.string().valid('disputed', 'approved', 'rejected', 'pending', 'paid', 'cancelled').optional(),
  date_range: Joi.string().valid('day', 'week', 'month', 'year').optional(),
});

export const financialSummaryQuerySchema = Joi.object({
  range: Joi.string().valid('day', 'week', 'month', 'year').optional().default('month'),
});

// ── Mutations ────────────────────────────────────────────────────────────────

export const createInvoiceSchema = Joi.object({
  invoice_number:       Joi.string().min(3).max(100).required(),
  carrier_id:           Joi.string().uuid().required(),
  billing_period_start: Joi.string().isoDate().required(),
  billing_period_end:   Joi.string().isoDate().required(),
  total_shipments:      Joi.number().integer().min(0).required(),
  base_amount:          Joi.number().min(0).required(),
  penalties:            Joi.number().min(0).optional().default(0),
  adjustments:          Joi.number().optional().default(0), // can be negative (credits)
  final_amount:         Joi.number().required(),
  status:               Joi.string().valid(...INVOICE_STATUSES).optional().default('pending'),
});

export const updateInvoiceSchema = Joi.object({
  status:       Joi.string().valid(...INVOICE_STATUSES).optional(),
  penalties:    Joi.number().min(0).optional(),
  adjustments:  Joi.number().optional(),
  final_amount: Joi.number().min(0).optional(),
}).min(1); // at least one field required

export const approveInvoiceSchema = Joi.object({
  notes: Joi.string().max(2000).optional().allow(''),
});

export const markInvoicePaidSchema = Joi.object({
  payment_method: Joi.string().min(2).max(50).required(),
  payment_date: Joi.string().isoDate().optional(),
  reference_number: Joi.string().max(100).optional().allow(''),
  notes: Joi.string().max(2000).optional().allow(''),
});

export const processRefundSchema = Joi.object({
  refund_amount:   Joi.number().min(0).optional(),
  restocking_fee:  Joi.number().min(0).optional().default(0),
});

export const resolveDisputeSchema = Joi.object({
  adjusted_amount: Joi.number().min(0).optional(),
  resolution:      Joi.string().valid(...DISPUTE_RESOLUTIONS).optional(),
  notes:           Joi.string().max(2000).optional().allow(''),
});
