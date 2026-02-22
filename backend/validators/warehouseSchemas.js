// Validation schemas for warehouse operations
import Joi from 'joi';

// Create warehouse schema
export const createWarehouseSchema = Joi.object({
  code: Joi.string().uppercase().min(2).max(20).pattern(/^[A-Z0-9-]+$/).optional().messages({
    'string.pattern.base': 'Warehouse code must contain only uppercase letters, numbers, and hyphens'
  }),
  name: Joi.string().min(3).max(200).required(),
  warehouse_type: Joi.string().valid('standard', 'cold_storage', 'hazmat', 'distribution', 'fulfillment').default('standard'),
  address: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    postal_code: Joi.string().required(),
    country: Joi.string().default('India')
  }).required(),
  coordinates: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required()
  }).optional().allow(null),
  capacity: Joi.number().integer().min(0).default(10000),
  current_utilization: Joi.number().min(0).max(100).default(0),
  manager_id: Joi.number().integer().min(1).optional().allow(null),
  contact_email: Joi.string().email().required(),
  contact_phone: Joi.string().pattern(/^\+?[\d\s\-()]+$/).optional().allow(null, '').messages({
    'string.pattern.base': 'Invalid phone number format'
  }),
  is_active: Joi.boolean().default(true)
  // organization_id is set from authenticated user, not from request
});

// Update warehouse schema (all fields optional)
export const updateWarehouseSchema = Joi.object({
  name: Joi.string().min(3).max(200).optional(),
  warehouse_type: Joi.string().valid('standard', 'cold_storage', 'hazmat', 'distribution', 'fulfillment').optional(),
  address: Joi.object({
    street: Joi.string().optional(),
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    postal_code: Joi.string().optional(),
    country: Joi.string().optional()
  }).optional(),
  coordinates: Joi.object({
    lat: Joi.number().min(-90).max(90).optional(),
    lng: Joi.number().min(-180).max(180).optional()
  }).optional().allow(null),
  capacity: Joi.number().integer().min(0).optional(),
  current_utilization: Joi.number().min(0).max(100).optional(),
  manager_id: Joi.number().integer().min(1).optional().allow(null),
  contact_email: Joi.string().email().optional(),
  contact_phone: Joi.string().pattern(/^\+?[\d\s\-()]+$/).optional().allow(null, ''),
  is_active: Joi.boolean().optional()
}).min(1);

// List warehouses query schema
export const listWarehousesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  is_active: Joi.boolean().optional(),
  warehouse_type: Joi.string().valid('standard', 'cold_storage', 'hazmat', 'distribution', 'fulfillment').optional(),
  search: Joi.string().max(100).optional().allow('')
});

// Warehouse inventory query schema
export const warehouseInventoryQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().max(100).optional().allow(''),
  low_stock: Joi.boolean().optional().default(false)
});

