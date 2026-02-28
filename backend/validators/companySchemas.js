// Company validation schemas
import Joi from 'joi';

const addressSchema = Joi.object({
  street:      Joi.string().max(255).optional().allow(''),
  city:        Joi.string().max(100).optional().allow(''),
  state:       Joi.string().max(100).optional().allow(''),
  postal_code: Joi.string().max(20).optional().allow(''),
  country:     Joi.string().max(100).optional().allow(''),
});

export const createCompanySchema = Joi.object({
  name:    Joi.string().min(2).max(255).required(),
  code:    Joi.string().alphanum().min(2).max(50).required(),
  email:   Joi.string().email().optional().allow(''),
  phone:   Joi.string().max(30).optional().allow(''),
  website: Joi.string().uri().optional().allow(''),
  address: addressSchema.optional(),
});

export const updateCompanySchema = Joi.object({
  name:    Joi.string().min(2).max(255).optional(),
  email:   Joi.string().email().optional().allow(''),
  phone:   Joi.string().max(30).optional().allow(''),
  website: Joi.string().uri().optional().allow(''),
  address: addressSchema.optional(),
}).min(1);

export const listCompaniesQuerySchema = Joi.object({
  page:   Joi.number().integer().min(1).default(1),
  limit:  Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().max(100).optional().allow(''),
});
