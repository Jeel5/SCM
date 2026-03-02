// Return validation schemas - defines rules for return requests
// IMPORTANT: Status values MUST match RETURN_VALID_TRANSITIONS in services/returnsService.js

import Joi from 'joi';

// All valid return statuses — keep in sync with returnsService.RETURN_VALID_TRANSITIONS
const RETURN_STATUSES = [
  'requested', 'approved', 'rejected', 'received',
  'inspecting', 'inspection_passed', 'inspection_failed',
  'refunded', 'restocked', 'cancelled',
  'pickup_scheduled', 'picked_up', 'in_transit',
  // Legacy values kept for backward compatibility
  'inspected', 'completed',
];

// All valid return reasons — keep in sync with createReturnSchema
const RETURN_REASONS = [
  'damaged', 'defective', 'wrong_item', 'not_as_described',
  'unwanted', 'size_issue', 'late_delivery', 'changed_mind',
  'quality_issue', 'other',
];

const returnItemSchema = Joi.object({
  product_id: Joi.string().allow('', null),
  sku: Joi.string().allow('', null),
  product_name: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  condition: Joi.string().valid('new', 'like_new', 'good', 'acceptable', 'poor', 'damaged')
});

export const createReturnSchema = Joi.object({
  order_id: Joi.string().required(),
  reason: Joi.string().valid(...RETURN_REASONS).required(),
  reason_details: Joi.string().max(1000),
  customer_email: Joi.string().email(),
  refund_amount: Joi.number().min(0),
  items: Joi.array().items(returnItemSchema).min(1).required()
});

export const updateReturnStatusSchema = Joi.object({
  status: Joi.string().valid(...RETURN_STATUSES).required(),
  inspection_notes: Joi.string().max(1000),
  refund_amount: Joi.number().min(0),
  refund_method: Joi.string().valid('original_payment', 'store_credit', 'bank_transfer', 'check')
});

export const listReturnsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid(...RETURN_STATUSES),
  reason: Joi.string().valid(...RETURN_REASONS),
  search: Joi.string().max(100)
});
