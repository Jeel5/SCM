// Assignment validation schemas

import Joi from 'joi';

// ─── Body schemas ────────────────────────────────────────────────────────────

/** POST /assignments/:id/reject */
export const rejectAssignmentSchema = Joi.object({
  reason: Joi.string().max(1000).optional()
});

/** POST /assignments/:id/busy */
export const busyAssignmentSchema = Joi.object({
  reason: Joi.string().max(1000).optional()
});

/**
 * POST /assignments/:id/accept
 * Fields are forwarded to carrierAssignmentService as opaque acceptanceData,
 * but we validate the common known keys so malformed payloads are rejected early.
 */
export const acceptAssignmentSchema = Joi.object({
  quotedPrice: Joi.number().min(0),
  estimatedDeliveryDays: Joi.number().integer().min(0),
  serviceType: Joi.string().max(100),
  currency: Joi.string().length(3).uppercase(),
  validUntil: Joi.date().iso(),
  breakdown: Joi.object()
}).options({ allowUnknown: true }); // forward extra carrier-specific fields unmodified

/** POST /carriers/:code/availability */
export const updateCarrierAvailabilitySchema = Joi.object({
  status: Joi.string().valid('available', 'busy', 'offline').required()
});

// ─── Query schemas ────────────────────────────────────────────────────────────

/** GET /carriers/assignments/pending */
export const pendingAssignmentsQuerySchema = Joi.object({
  carrierId: Joi.string().optional(),
  status: Joi.string().max(50).optional(),
  serviceType: Joi.string().max(100).optional(),
  orgId: Joi.string().uuid().optional()
});
