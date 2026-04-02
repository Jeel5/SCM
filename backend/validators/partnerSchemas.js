// Sales Channel & Supplier validation schemas
import Joi from 'joi';

// ==================== SALES CHANNELS ====================

export const createChannelSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  platform_type: Joi.string().valid('marketplace', 'd2c', 'b2b', 'wholesale', 'internal').default('marketplace'),
  api_endpoint: Joi.string().uri().allow('', null),
  contact_name: Joi.string().max(255).allow('', null),
  contact_email: Joi.string().email().allow('', null),
  contact_phone: Joi.string().min(10).max(20).allow('', null),
  config: Joi.object().default({}),
  default_warehouse_id: Joi.string().uuid().allow(null),
  is_active: Joi.boolean().default(true),
});

export const updateChannelSchema = Joi.object({
  name: Joi.string().min(2).max(255),
  platform_type: Joi.string().valid('marketplace', 'd2c', 'b2b', 'wholesale', 'internal'),
  api_endpoint: Joi.string().uri().allow('', null),
  contact_name: Joi.string().max(255).allow('', null),
  contact_email: Joi.string().email().allow('', null),
  contact_phone: Joi.string().min(10).max(20).allow('', null),
  config: Joi.object(),
  default_warehouse_id: Joi.string().uuid().allow(null),
  is_active: Joi.boolean(),
}).min(1);

export const listChannelsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  is_active: Joi.boolean(),
  platform_type: Joi.string().valid('marketplace', 'd2c', 'b2b', 'wholesale', 'internal'),
  search: Joi.string().max(100),
});

// ==================== SUPPLIERS ====================

export const createSupplierSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  contact_name: Joi.string().max(255).allow('', null),
  contact_email: Joi.string().email().allow('', null),
  contact_phone: Joi.string().min(10).max(20).allow('', null),
  api_endpoint: Joi.string().uri().allow('', null),
  inbound_contact_name: Joi.string().max(255).allow('', null),
  inbound_contact_email: Joi.string().email().allow('', null),
  address: Joi.string().max(500).allow('', null),
  city: Joi.string().max(100).allow('', null),
  state: Joi.string().max(100).allow('', null),
  country: Joi.string().max(100).default('India'),
  postal_code: Joi.string().max(20).allow('', null),
  is_active: Joi.boolean().default(true),
});

export const updateSupplierSchema = Joi.object({
  name: Joi.string().min(2).max(255),
  contact_name: Joi.string().max(255).allow('', null),
  contact_email: Joi.string().email().allow('', null),
  contact_phone: Joi.string().min(10).max(20).allow('', null),
  api_endpoint: Joi.string().uri().allow('', null),
  inbound_contact_name: Joi.string().max(255).allow('', null),
  inbound_contact_email: Joi.string().email().allow('', null),
  address: Joi.string().max(500).allow('', null),
  city: Joi.string().max(100).allow('', null),
  state: Joi.string().max(100).allow('', null),
  country: Joi.string().max(100),
  postal_code: Joi.string().max(20).allow('', null),
  is_active: Joi.boolean(),
}).min(1);

export const listSuppliersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  is_active: Joi.boolean(),
  search: Joi.string().max(100),
});
