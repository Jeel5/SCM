// Param validation middleware — ensures :id and other UUID params are valid before hitting the DB.
// Without this, malformed UUIDs cause raw PostgreSQL 22P02 errors.

import Joi from 'joi';
import { ValidationError } from '../errors/AppError.js';
import logger from '../utils/logger.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Middleware that validates all UUID-shaped route params (:id, :carrierId, etc.)
 * Attach early in the middleware chain — before any DB access.
 *
 * Usage:
 *   router.get('/:id', validateUUIDParams, handler)            — single param
 *   router.get('/:carrierId/rates', validateUUIDParams, handler) — any *Id param
 */
export function validateUUIDParams(req, res, next) {
  // Params whose names end with "id" (case-insensitive) or are exactly "id" are expected to be UUIDs.
  const paramNames = Object.keys(req.params);

  for (const name of paramNames) {
    const val = req.params[name];
    if (/id$/i.test(name) && val) {
      if (!UUID_REGEX.test(val)) {
        logger.warn('Invalid UUID in route param', {
          param: name,
          value: val,
          path: req.originalUrl,
          method: req.method,
          ip: req.ip,
        });
        throw new ValidationError(
          `Invalid ${name}: '${val}' is not a valid UUID. Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
        );
      }
    }
  }
  next();
}

/**
 * Factory to validate specific named params against Joi schemas.
 *
 * Usage:
 *   router.get('/:id', validateParams({ id: Joi.string().uuid().required() }), handler)
 */
export function validateParams(schemaMap) {
  const schema = Joi.object(schemaMap);
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, { stripUnknown: false });
    if (error) {
      logger.warn('Route param validation failed', {
        path: req.originalUrl,
        params: req.params,
        error: error.details[0].message,
      });
      throw new ValidationError(error.details[0].message);
    }
    req.params = value;
    next();
  };
}
