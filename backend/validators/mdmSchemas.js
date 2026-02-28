// MDM (Master Data Management) validation schemas
import Joi from 'joi';

// ─── Carrier schemas ──────────────────────────────────────────────────────────

export const createCarrierSchema = Joi.object({
  code: Joi.string().max(50).pattern(/^[A-Z0-9][A-Z0-9-]{0,48}$/i).required(),
  name: Joi.string().min(2).max(255).required(),
  service_type: Joi.string().valid('express', 'standard', 'economy', 'overnight', 'two_day', 'surface', 'air', 'all').default('standard'),
  service_areas: Joi.array().items(Joi.string()).optional(),
  contact_email: Joi.string().email().max(255).optional(),
  contact_phone: Joi.string().max(50).optional(),
  website: Joi.string().uri().max(500).optional(),
  api_endpoint: Joi.string().uri().max(500).optional(),
  webhook_url: Joi.string().uri().max(500).optional(),
  reliability_score: Joi.number().min(0).max(1).optional(),
  avg_delivery_days: Joi.number().integer().min(0).optional(),
  daily_capacity: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional(),
  availability_status: Joi.string().valid('available', 'busy', 'offline').optional()
});

export const updateCarrierSchema = Joi.object({
  name: Joi.string().min(2).max(255).optional(),
  service_type: Joi.string().valid('express', 'standard', 'economy', 'overnight', 'two_day', 'surface', 'air', 'all').optional(),
  contact_email: Joi.string().email().max(255).optional(),
  contact_phone: Joi.string().max(50).optional(),
  website: Joi.string().uri().max(500).optional(),
  api_endpoint: Joi.string().uri().max(500).optional(),
  webhook_url: Joi.string().uri().max(500).optional(),
  reliability_score: Joi.number().min(0).max(1).optional(),
  avg_delivery_days: Joi.number().integer().min(0).optional(),
  daily_capacity: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional(),
  availability_status: Joi.string().valid('available', 'busy', 'offline').optional()
});

// ─── Product schemas ───────────────────────────────────────────────────────────

const dimensionsSchema = Joi.object({
  length: Joi.number().min(0),
  width: Joi.number().min(0),
  height: Joi.number().min(0),
  unit: Joi.string().valid('cm', 'in').default('cm')
});

export const createProductSchema = Joi.object({
  sku: Joi.string().max(100).optional(),
  name: Joi.string().min(1).max(255).required(),
  category: Joi.string().max(100).optional(),
  description: Joi.string().max(2000).optional(),
  weight: Joi.number().min(0).optional(),
  dimensions: dimensionsSchema.optional(),
  unit_price: Joi.number().min(0).optional(),
  cost_price: Joi.number().min(0).optional(),
  currency: Joi.string().length(3).uppercase().default('INR'),
  is_fragile: Joi.boolean().optional(),
  requires_cold_storage: Joi.boolean().optional(),
  is_hazmat: Joi.boolean().optional(),
  is_perishable: Joi.boolean().optional(),
  item_type: Joi.string().valid('general', 'electronics', 'clothing', 'food', 'furniture', 'other').optional(),
  package_type: Joi.string().valid('box', 'envelope', 'tube', 'pallet', 'custom').optional(),
  handling_instructions: Joi.string().max(1000).optional(),
  requires_insurance: Joi.boolean().optional(),
  declared_value: Joi.number().min(0).optional(),
  attributes: Joi.object().optional()
});

export const updateProductSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  category: Joi.string().max(100).optional(),
  description: Joi.string().max(2000).optional(),
  weight: Joi.number().min(0).optional(),
  dimensions: dimensionsSchema.optional(),
  unit_price: Joi.number().min(0).optional(),
  cost_price: Joi.number().min(0).optional(),
  currency: Joi.string().length(3).uppercase().optional(),
  is_fragile: Joi.boolean().optional(),
  requires_cold_storage: Joi.boolean().optional(),
  is_hazmat: Joi.boolean().optional(),
  is_perishable: Joi.boolean().optional(),
  is_active: Joi.boolean().optional(),
  item_type: Joi.string().valid('general', 'electronics', 'clothing', 'food', 'furniture', 'other').optional(),
  package_type: Joi.string().valid('box', 'envelope', 'tube', 'pallet', 'custom').optional(),
  handling_instructions: Joi.string().max(1000).optional(),
  requires_insurance: Joi.boolean().optional(),
  declared_value: Joi.number().min(0).optional(),
  attributes: Joi.object().optional(),
  images: Joi.array().items(Joi.string().uri()).optional()
});
