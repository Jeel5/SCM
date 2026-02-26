// Return validation schemas - defines rules for return requests

import Joi from 'joi';

const returnItemSchema = Joi.object({
  product_id: Joi.string().required(),
  sku: Joi.string().required(),
  product_name: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  condition: Joi.string().valid('new', 'like_new', 'good', 'acceptable', 'poor', 'damaged')
});

export const createReturnSchema = Joi.object({
  order_id: Joi.string().required(),
  return_number: Joi.string().min(5).max(50),
  reason: Joi.string().valid('damaged', 'defective', 'wrong_item', 'not_as_described', 'unwanted', 'size_issue', 'late_delivery', 'other').required(),
  reason_details: Joi.string().max(1000),
  // status is intentionally excluded — server always starts returns at 'requested'
  requested_by: Joi.string().min(2).max(255).required(),
  customer_email: Joi.string().email().required(),
  // refund_amount is intentionally excluded — system calculates from original order
  refund_method: Joi.string().valid('original_payment', 'store_credit', 'bank_transfer', 'check'),
  items: Joi.array().items(returnItemSchema).min(1).required()
});

export const updateReturnStatusSchema = Joi.object({
  status: Joi.string().valid('requested', 'approved', 'rejected', 'received', 'inspecting', 'completed', 'refunded').required(),
  inspection_notes: Joi.string().max(1000),
  refund_amount: Joi.number().min(0),
  refund_method: Joi.string().valid('original_payment', 'store_credit', 'bank_transfer', 'check')
});

export const listReturnsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('requested', 'approved', 'rejected', 'received', 'inspecting', 'completed', 'refunded'),
  reason: Joi.string().valid('damaged', 'defective', 'wrong_item', 'not_as_described', 'unwanted', 'size_issue', 'late_delivery', 'other'),
  search: Joi.string().max(100)
});
