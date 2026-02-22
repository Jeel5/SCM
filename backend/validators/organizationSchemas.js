// Validation schemas for organization operations
import Joi from 'joi';

// Create organization schema (for superadmin)
export const createOrganizationSchema = Joi.object({
  code: Joi.string().uppercase().min(2).max(50).pattern(/^[A-Z0-9-]+$/).optional().messages({
    'string.pattern.base': 'Organization code must contain only uppercase letters, numbers, and hyphens'
  }),
  name: Joi.string().min(3).max(255).required(),
  
  // Contact Info
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^\+?[\d\s\-()]+$/).optional().allow(null, '').messages({
    'string.pattern.base': 'Invalid phone number format'
  }),
  website: Joi.string().uri().optional().allow(null, ''),
  
  // Address
  address: Joi.string().max(500).optional().allow(null, ''),
  city: Joi.string().max(100).optional().allow(null, ''),
  state: Joi.string().max(100).optional().allow(null, ''),
  country: Joi.string().max(100).default('India'),
  postal_code: Joi.string().max(20).optional().allow(null, ''),
  
  // Settings
  timezone: Joi.string().default('Asia/Kolkata'),
  currency: Joi.string().length(3).uppercase().default('INR'),
  logo_url: Joi.string().uri().optional().allow(null, ''),
  
  subscription_tier: Joi.string().valid('starter', 'standard', 'enterprise').default('standard'),
  is_active: Joi.boolean().default(true),
  
  // Admin user to create with organization
  admin_user: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    phone: Joi.string().pattern(/^\+?[\d\s\-()]+$/).optional().allow(null, '')
  }).required()
});

// Update organization schema
export const updateOrganizationSchema = Joi.object({
  name: Joi.string().min(3).max(255).optional(),
  
  // Contact Info
  email: Joi.string().email().optional(),
  phone: Joi.string().pattern(/^\+?[\d\s\-()]+$/).optional().allow(null, ''),
  website: Joi.string().uri().optional().allow(null, ''),
  
  // Address
  address: Joi.string().max(500).optional().allow(null, ''),
  city: Joi.string().max(100).optional().allow(null, ''),
  state: Joi.string().max(100).optional().allow(null, ''),
  country: Joi.string().max(100).optional(),
  postal_code: Joi.string().max(20).optional().allow(null, ''),
  
  // Settings
  timezone: Joi.string().optional(),
  currency: Joi.string().length(3).uppercase().optional(),
  logo_url: Joi.string().uri().optional().allow(null, ''),
  
  subscription_tier: Joi.string().valid('starter', 'standard', 'enterprise').optional(),
  is_active: Joi.boolean().optional()
}).min(1);

// List organizations query schema
export const listOrganizationsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  is_active: Joi.boolean().optional(),
  search: Joi.string().max(100).optional().allow('')
});
