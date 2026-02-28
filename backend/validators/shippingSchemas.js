// Shipping / quote validation schemas
import Joi from 'joi';

const SERVICE_TYPES = ['express', 'standard', 'economy', 'overnight', 'two_day', 'same_day'];

// ── Shared sub-schemas ───────────────────────────────────────────────────────

const coordinateSchema = Joi.object({
  lat:        Joi.number().min(-90).max(90).required(),
  lon:        Joi.number().min(-180).max(180).required(),
  postalCode: Joi.string().max(20).optional().allow(''),
  address:    Joi.string().max(500).optional().allow(''),
});

const originSchema = Joi.alternatives().try(
  // Warehouse reference
  Joi.object({ warehouse_id: Joi.string().uuid().required() }),
  // Coordinate reference (same shape as destination)
  coordinateSchema
).required();

const destinationSchema = Joi.object({
  lat:        Joi.number().min(-90).max(90).required(),
  lon:        Joi.number().min(-180).max(180).required(),
  postalCode: Joi.string().max(20).optional().allow(''),
  address:    Joi.string().max(500).optional().allow(''),
}).required();

const dimensionsSchema = Joi.object({
  length: Joi.number().min(0).required(),
  width:  Joi.number().min(0).required(),
  height: Joi.number().min(0).required(),
  unit:   Joi.string().valid('cm', 'in').optional().default('cm'),
});

const quoteItemSchema = Joi.object({
  sku:         Joi.string().max(100).optional(),
  description: Joi.string().max(500).optional().allow(''),
  quantity:    Joi.number().integer().min(1).required(),
  weightKg:    Joi.number().min(0).optional(),
  dimensions:  dimensionsSchema.optional(),
  value:       Joi.number().min(0).optional(), // declared value for insurance
});

const criteriaSchema = Joi.object({
  maxPrice:       Joi.number().min(0).optional(),
  maxTransitDays: Joi.number().integer().min(1).optional(),
  preferredCarriers: Joi.array().items(Joi.string()).optional(),
  serviceType:    Joi.string().valid(...SERVICE_TYPES).optional(),
}).optional();

// ── Schemas ──────────────────────────────────────────────────────────────────

/** POST /shipping/quick-estimate  AND  POST /shipping/estimate */
export const quickEstimateSchema = Joi.alternatives().try(
  // New coordinate format
  Joi.object({
    origin:      originSchema,
    destination: destinationSchema,
    weightKg:    Joi.number().min(0).required(),
    dimensions:  dimensionsSchema.optional(),
    serviceType: Joi.string().valid(...SERVICE_TYPES).optional().default('standard'),
  }),
  // Legacy pincode format
  Joi.object({
    fromPincode: Joi.string().min(3).max(20).required(),
    toPincode:   Joi.string().min(3).max(20).required(),
    weightKg:    Joi.number().min(0).optional().default(1),
    serviceType: Joi.string().valid(...SERVICE_TYPES).optional().default('standard'),
  })
);

/** POST /shipping/quotes  and  POST /shipping/quotes/legacy */
export const getShippingQuotesSchema = Joi.object({
  origin:      originSchema,
  destination: destinationSchema,
  items:       Joi.array().items(quoteItemSchema).min(1).required(),
  orderId:     Joi.string().uuid().optional(),
});

/** POST /shipping/quotes/custom */
export const getShippingQuotesWithCriteriaSchema = Joi.object({
  origin:      originSchema,
  destination: destinationSchema,
  items:       Joi.array().items(quoteItemSchema).min(1).required(),
  orderId:     Joi.string().uuid().optional(),
  criteria:    criteriaSchema,
});

/** POST /shipping/quotes/:carrierId */
export const getQuoteFromCarrierSchema = Joi.object({
  origin:      originSchema,
  destination: destinationSchema,
  items:       Joi.array().items(quoteItemSchema).min(1).required(),
  orderId:     Joi.string().uuid().optional(),
});

/** POST /shipping/quotes/:quoteId/select */
export const selectQuoteSchema = Joi.object({
  orderId: Joi.string().uuid().required(),
});
