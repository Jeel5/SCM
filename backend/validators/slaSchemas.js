// SLA and exception validation schemas

import Joi from 'joi';

// ── Query schemas (used on GET list / filter endpoints) ──────────────────────

export const slaViolationsQuerySchema = Joi.object({
  page:   Joi.number().integer().min(1).default(1),
  limit:  Joi.number().integer().min(1).max(100).default(20),
  // DB CHECK: open | acknowledged | investigating | resolved | waived | disputed
  status: Joi.string().valid('open', 'acknowledged', 'investigating', 'resolved', 'waived', 'disputed'),
});

export const exceptionsQuerySchema = Joi.object({
  page:     Joi.number().integer().min(1).default(1),
  limit:    Joi.number().integer().min(1).max(100).default(20),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical'),
  // DB CHECK: open|acknowledged|investigating|pending_resolution|resolved|escalated|closed
  status:   Joi.string().valid(
    'open', 'acknowledged', 'investigating', 'pending_resolution',
    'resolved', 'escalated', 'closed'
  ),
});

// ── Exception body schemas ────────────────────────────────────────────────────

export const createExceptionSchema = Joi.object({
  shipmentId:  Joi.string().uuid().required(),
  orderId:     Joi.string().uuid(),
  // Field name is 'type' — matches DB column exception_type and frontend Exception.type
  // DB CHECK: delay|damage|lost_shipment|address_issue|carrier_issue|
  //           inventory_issue|sla_breach|delivery_failed|customer_not_available|other
  type: Joi.string().valid(
    'delay', 'damage', 'lost_shipment', 'address_issue', 'carrier_issue',
    'inventory_issue', 'sla_breach', 'delivery_failed', 'customer_not_available', 'other'
  ).required(),
  severity:    Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  title:       Joi.string().min(3).max(200),
  description: Joi.string().min(5).max(2000).required(),
});

export const resolveExceptionSchema = Joi.object({
  resolution: Joi.string().min(5).max(2000).required(),
});

// ── SLA Policy body schemas ───────────────────────────────────────────────────

const SERVICE_TYPES = ['same_day', 'express', 'standard', 'economy', 'bulk'];

export const createSLAPolicySchema = Joi.object({
  name:                    Joi.string().min(2).max(100).required(),
  serviceType:             Joi.string().valid(...SERVICE_TYPES).required(),
  carrierId:               Joi.string().uuid().allow(null),
  deliveryHours:           Joi.number().integer().min(1).max(720).required(),
  pickupHours:             Joi.number().integer().min(1).max(72).default(4),
  penaltyPerHour:          Joi.number().min(0).max(10000).default(0),
  maxPenaltyAmount:        Joi.number().min(0).allow(null),
  penaltyType:             Joi.string().valid('fixed', 'percentage').default('fixed'),
  warningThresholdPercent: Joi.number().integer().min(1).max(100).default(80),
  isActive:                Joi.boolean().default(true),
  priority:                Joi.number().integer().min(1).max(100).default(5),
});

export const updateSLAPolicySchema = Joi.object({
  name:                    Joi.string().min(2).max(100),
  serviceType:             Joi.string().valid(...SERVICE_TYPES),
  carrierId:               Joi.string().uuid().allow(null),
  deliveryHours:           Joi.number().integer().min(1).max(720),
  pickupHours:             Joi.number().integer().min(1).max(72),
  penaltyPerHour:          Joi.number().min(0).max(10000),
  maxPenaltyAmount:        Joi.number().min(0).allow(null),
  penaltyType:             Joi.string().valid('fixed', 'percentage'),
  warningThresholdPercent: Joi.number().integer().min(1).max(100),
  isActive:                Joi.boolean(),
  priority:                Joi.number().integer().min(1).max(100),
}).min(1);
