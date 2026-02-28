// User validation schemas - defines rules for authentication and registration

import Joi from 'joi';

export const registerUserSchema = Joi.object({
  username: Joi.string().min(3).max(50).pattern(/^[a-zA-Z0-9_]+$/).required().messages({
    'string.pattern.base': 'Username can only contain letters, numbers, and underscores'
  }),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
    'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number'
  }),
  full_name: Joi.string().min(2).max(255).required(),
  // role is intentionally excluded — server always assigns 'user' on self-registration
  department: Joi.string().max(100),
  phone: Joi.string().min(10).max(20)
});

export const loginUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

export const updateUserSchema = Joi.object({
  email: Joi.string().email(),
  full_name: Joi.string().min(2).max(255),
  role: Joi.string().valid('admin', 'manager', 'operator', 'viewer'),
  department: Joi.string().max(100),
  phone: Joi.string().min(10).max(20),
  is_active: Joi.boolean()
}).min(1);

export const changePasswordSchema = Joi.object({
  current_password: Joi.string().required(),
  new_password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
    'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number'
  })
});

export const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(255),
  email: Joi.string().email(),
  phone: Joi.string().min(10).max(20),
  company: Joi.string().max(255),
  avatar: Joi.string().uri().max(500)
}).min(1);

// Org user management schemas (admin creating/editing users within their org)
const ORG_ROLES = Joi.string().valid(
  'operations_manager',
  'warehouse_manager',
  'carrier_partner',
  'finance',
  'customer_support'
);

export const createOrgUserSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
    'string.pattern.base': 'Password must contain uppercase, lowercase, and a number'
  }),
  role: ORG_ROLES.required(),
  phone: Joi.string().min(10).max(20).allow('', null)
});

export const updateOrgUserSchema = Joi.object({
  name: Joi.string().min(2).max(255),
  role: ORG_ROLES,
  is_active: Joi.boolean()
}).min(1);

export const notificationPreferencesSchema = Joi.object({
  email_enabled: Joi.boolean(),
  push_enabled: Joi.boolean(),
  sms_enabled: Joi.boolean(),
  notification_types: Joi.object({
    orders: Joi.boolean(),
    shipments: Joi.boolean(),
    sla_alerts: Joi.boolean(),
    exceptions: Joi.boolean(),
    returns: Joi.boolean(),
    system_updates: Joi.boolean()
  })
});

export const listUsersQuerySchema = Joi.object({
  page:      Joi.number().integer().min(1).default(1),
  limit:     Joi.number().integer().min(1).max(100).default(20),
  role:      Joi.string().valid(
               'admin', 'operations_manager', 'warehouse_manager',
               'carrier_partner', 'finance', 'customer_support'
             ),
  is_active: Joi.boolean(),
  search:    Joi.string().max(200),
});
