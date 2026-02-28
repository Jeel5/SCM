// Validation middleware factories — all schemas are Joi schemas (schema.validate exists)
// ValidationError lives in errors/AppError.js; import from there if needed outside this file.

/**
 * Validates req.body against a Joi schema.
 * Strips unknown fields (stripUnknown: true) so controllers receive only declared keys.
 * Replaces req.body with the coerced/sanitised value on success.
 */
export function validateRequest(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { stripUnknown: true });

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: error.details[0].message,
        details: error.details,
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
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, { stripUnknown: true });

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: error.details[0].message,
        details: error.details,
      });
    }

    req.validatedQuery = value;
    return next();
  };
}
