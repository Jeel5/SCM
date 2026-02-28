// SLA and exception validation schemas

import Joi from 'joi';

// ── Query schemas (used on GET list / filter endpoints) ──────────────────────

export const slaViolationsQuerySchema = Joi.object({
  page:   Joi.number().integer().min(1).default(1),
  limit:  Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('pending', 'resolved', 'waived'),
});

export const exceptionsQuerySchema = Joi.object({
  page:     Joi.number().integer().min(1).default(1),
  limit:    Joi.number().integer().min(1).max(100).default(20),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical'),
  status:   Joi.string().valid('open', 'resolved', 'dismissed'),
});

// ── Body schemas ─────────────────────────────────────────────────────────────

export const createExceptionSchema = Joi.object({
  shipmentId:    Joi.string().uuid().required(),
  orderId:       Joi.string().uuid(),
  exceptionType: Joi.string().min(2).max(100).required(),
  severity:      Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  description:   Joi.string().min(5).max(2000).required(),
});

export const resolveExceptionSchema = Joi.object({
  resolution: Joi.string().min(5).max(2000).required(),
});
