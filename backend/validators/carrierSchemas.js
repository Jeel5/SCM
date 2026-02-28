// Carrier webhook and quote-status validation schemas

import Joi from 'joi';

/**
 * POST /carriers/webhook/:carrierId
 *
 * Two possible shapes depending on `accepted`:
 *   accepted = true  → must have quotedPrice + estimatedDeliveryDays
 *   accepted = false → reason/message are optional but no price fields expected
 */
export const carrierWebhookSchema = Joi.object({
  orderId: Joi.string().required(),
  accepted: Joi.boolean().required(),

  // ─── acceptance fields (required when accepted = true) ─────────────────
  quotedPrice: Joi.when('accepted', {
    is: true,
    then: Joi.number().min(0).required(),
    otherwise: Joi.number().min(0).optional()
  }),
  estimatedDeliveryDays: Joi.when('accepted', {
    is: true,
    then: Joi.number().integer().min(0).required(),
    otherwise: Joi.number().integer().min(0).optional()
  }),
  serviceType: Joi.string().max(100).optional(),
  currency: Joi.string().length(3).uppercase().optional(),
  validUntil: Joi.date().iso().optional(),
  breakdown: Joi.object().optional(),

  // ─── rejection fields ──────────────────────────────────────────────────
  reason: Joi.string().max(1000).optional(),
  message: Joi.string().max(2000).optional()
});
