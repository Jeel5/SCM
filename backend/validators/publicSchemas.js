import Joi from 'joi';

const basePublicInquirySchema = {
  firstName: Joi.string().trim().min(1).max(120).required(),
  lastName: Joi.string().trim().min(1).max(120).required(),
  workEmail: Joi.string().email().max(255).required(),
  company: Joi.string().trim().min(1).max(255).required(),
  message: Joi.string().trim().max(4000).allow('', null),
};

export const requestDemoSchema = Joi.object({
  ...basePublicInquirySchema,
  source: Joi.string().trim().max(120).optional().allow('', null),
  pageUrl: Joi.string().uri().max(1000).optional().allow('', null),
});

export const contactMessageSchema = Joi.object({
  ...basePublicInquirySchema,
  message: Joi.string().trim().min(1).max(4000).required(),
  inquiry: Joi.string().trim().max(120).optional().allow('', null),
  source: Joi.string().trim().max(120).optional().allow('', null),
  pageUrl: Joi.string().uri().max(1000).optional().allow('', null),
});