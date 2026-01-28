// Lightweight validation utilities for request data

class ValidationError extends Error {
  constructor(errors) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.errors = errors;
    this.statusCode = 400;
  }
}

// Validate data against schema definition, returns array of errors if any
function validate(schema, data) {
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({ field, message: `${field} is required` });
      continue;
    }

    // Skip other validations if field is not required and not provided
    if (!rules.required && (value === undefined || value === null)) {
      continue;
    }

    // Type check
    if (rules.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rules.type) {
        errors.push({ field, message: `${field} must be of type ${rules.type}` });
        continue;
      }
    }

    // String validations
    if (rules.type === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push({ field, message: `${field} must be at least ${rules.minLength} characters` });
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push({ field, message: `${field} must be at most ${rules.maxLength} characters` });
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push({ field, message: `${field} format is invalid` });
      }
      if (rules.email && !isValidEmail(value)) {
        errors.push({ field, message: `${field} must be a valid email` });
      }
    }

    // Number validations
    if (rules.type === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push({ field, message: `${field} must be at least ${rules.min}` });
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push({ field, message: `${field} must be at most ${rules.max}` });
      }
      if (rules.integer && !Number.isInteger(value)) {
        errors.push({ field, message: `${field} must be an integer` });
      }
    }

    // Array validations
    if (rules.type === 'array') {
      if (rules.minItems && value.length < rules.minItems) {
        errors.push({ field, message: `${field} must have at least ${rules.minItems} items` });
      }
      if (rules.maxItems && value.length > rules.maxItems) {
        errors.push({ field, message: `${field} must have at most ${rules.maxItems} items` });
      }
      if (rules.items) {
        value.forEach((item, index) => {
          const itemErrors = validate(rules.items, item);
          if (itemErrors.length > 0) {
            itemErrors.forEach(err => {
              errors.push({ field: `${field}[${index}].${err.field}`, message: err.message });
            });
          }
        });
      }
    }

    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push({ field, message: `${field} must be one of: ${rules.enum.join(', ')}` });
    }

    // Custom validation
    if (rules.custom) {
      const customError = rules.custom(value, data);
      if (customError) {
        errors.push({ field, message: customError });
      }
    }
  }

  return errors;
}

/**
 * Email validation
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validation middleware factory
 */
function validateRequest(schema) {
  return (req, res, next) => {
    const errors = validate(schema, req.body);
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors
      });
    }
    
    next();
  };
}

/**
 * Query validation middleware factory
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const errors = validate(schema, req.query);
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors
      });
    }
    
    next();
  };
}

export { validate, validateRequest, validateQuery, ValidationError };
