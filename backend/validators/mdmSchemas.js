// MDM (Master Data Management) validation schemas
import Joi from 'joi';

// ─── Carrier schemas ──────────────────────────────────────────────────────────

export const createCarrierSchema = Joi.object({
  code: Joi.string().max(50).pattern(/^[A-Z0-9][A-Z0-9-]{0,48}$/i).optional(),
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
  is_active: Joi.boolean().optional(),
  availability_status: Joi.string().valid('available', 'busy', 'offline', 'suspended').optional()
});

export const updateCarrierSchema = Joi.object({
  name: Joi.string().min(2).max(255).optional(),
  service_type: Joi.string().valid('express', 'standard', 'economy', 'overnight', 'two_day', 'surface', 'air', 'all').optional(),
  contact_email: Joi.string().email().max(255).optional().allow(''),
  contact_phone: Joi.string().max(50).optional().allow(''),
  website: Joi.string().uri().max(500).optional().allow(''),
  api_endpoint: Joi.string().uri().max(500).optional().allow(''),
  webhook_url: Joi.string().uri().max(500).optional().allow(''),
  reliability_score: Joi.number().min(0).max(1).optional(),
  avg_delivery_days: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional(),
  availability_status: Joi.string().valid('available', 'busy', 'offline', 'suspended').optional()
});

// ─── Product schemas ───────────────────────────────────────────────────────────

const dimensionsSchema = Joi.object({
  length: Joi.number().min(0),
  width: Joi.number().min(0),
  height: Joi.number().min(0),
  unit: Joi.string().valid('cm', 'in').default('cm')
});

const newProductFields = {
  brand: Joi.string().max(255).optional(),
  country_of_origin: Joi.string().max(100).optional(),
  warranty_period_days: Joi.number().integer().min(0).optional(),
  shelf_life_days: Joi.number().integer().min(0).allow(null).optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  supplier_id: Joi.string().uuid().allow(null).optional(),
  mrp: Joi.number().min(0).optional(),
};

export const createProductSchema = Joi.object({
  sku: Joi.string().max(100).optional(),
  name: Joi.string().min(1).max(255).required(),
  category: Joi.string().max(100).optional(),
  description: Joi.string().max(2000).optional(),
  weight: Joi.number().min(0).optional(),
  dimensions: dimensionsSchema.optional(),
  selling_price: Joi.number().min(0).optional(),
  cost_price: Joi.number().min(0).optional(),
  currency: Joi.string().length(3).uppercase().default('INR'),
  is_fragile: Joi.boolean().optional(),
  requires_cold_storage: Joi.boolean().optional(),
  is_hazmat: Joi.boolean().optional(),
  is_perishable: Joi.boolean().optional(),
  package_type: Joi.string().valid('box', 'envelope', 'tube', 'pallet', 'custom').optional(),
  handling_instructions: Joi.string().max(1000).optional(),
  requires_insurance: Joi.boolean().optional(),
  attributes: Joi.object().optional(),
  ...newProductFields,
});

export const updateProductSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  category: Joi.string().max(100).optional(),
  description: Joi.string().max(2000).optional(),
  weight: Joi.number().min(0).optional(),
  dimensions: dimensionsSchema.optional(),
  selling_price: Joi.number().min(0).optional(),
  cost_price: Joi.number().min(0).optional(),
  currency: Joi.string().length(3).uppercase().optional(),
  is_fragile: Joi.boolean().optional(),
  requires_cold_storage: Joi.boolean().optional(),
  is_hazmat: Joi.boolean().optional(),
  is_perishable: Joi.boolean().optional(),
  is_active: Joi.boolean().optional(),
  package_type: Joi.string().valid('box', 'envelope', 'tube', 'pallet', 'custom').optional(),
  handling_instructions: Joi.string().max(1000).optional(),
  requires_insurance: Joi.boolean().optional(),
  attributes: Joi.object().optional(),
  ...newProductFields,
});
