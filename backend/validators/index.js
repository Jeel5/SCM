// Validation middleware factories — all schemas are Joi schemas (schema.validate exists)
// ValidationError lives in errors/AppError.js; import from there if needed outside this file.

import logger from '../utils/logger.js';

/**
 * Validates req.body against a Joi schema.
 * Strips unknown fields (stripUnknown: true) so controllers receive only declared keys.
 * Replaces req.body with the coerced/sanitised value on success.
 *
 * DEFENSIVE: Logs a warning when incoming fields are silently stripped so
 * developers discover misnamed or unexpected fields during development.
 */
export function validateRequest(schema) {
  return (req, res, next) => {
    // Capture keys BEFORE validation to detect silently-stripped fields
    const incomingKeys = Object.keys(req.body || {});

    const { error, value } = schema.validate(req.body, { stripUnknown: true });

    if (error) {
      logger.warn('Body validation failed', {
        path: req.originalUrl,
        method: req.method,
        errors: error.details.map(d => d.message),
      });
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: error.details[0].message,
        details: error.details.map(d => ({
          field: d.context?.key || d.path?.join('.'),
          message: d.message,
          type: d.type,
        })),
      });
    }

    // Detect silently-stripped fields and log them
    const validatedKeys = Object.keys(value || {});
    const strippedKeys = incomingKeys.filter(k => !validatedKeys.includes(k));
    if (strippedKeys.length > 0) {
      logger.warn('Unknown fields stripped from request body', {
        path: req.originalUrl,
        method: req.method,
        strippedFields: strippedKeys,
        hint: 'If these fields are intentional, add them to the Joi schema.',
      });
    }

    req.body = value;
    return next();
  };
}

/**
 * Validates req.query against a Joi schema.
 * Stores the coerced result in req.validatedQuery because req.query is read-only.
 * Controllers should read from req.validatedQuery (or req.query for unvalidated routes).
 *
 * DEFENSIVE: Logs a warning when query params are silently stripped.
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const incomingKeys = Object.keys(req.query || {});

    const { error, value } = schema.validate(req.query, { stripUnknown: true });

    if (error) {
      logger.warn('Query validation failed', {
        path: req.originalUrl,
        method: req.method,
        errors: error.details.map(d => d.message),
      });
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: error.details[0].message,
        details: error.details.map(d => ({
          field: d.context?.key || d.path?.join('.'),
          message: d.message,
          type: d.type,
        })),
      });
    }

    // Detect silently-stripped query params
    const validatedKeys = Object.keys(value || {});
    const strippedKeys = incomingKeys.filter(k => !validatedKeys.includes(k));
    if (strippedKeys.length > 0) {
      logger.warn('Unknown query params stripped', {
        path: req.originalUrl,
        method: req.method,
        strippedParams: strippedKeys,
        hint: 'If these params are intentional, add them to the Joi schema.',
      });
    }

    req.validatedQuery = value;
    return next();
  };
}
