// Helper functions for throwing errors consistently

import {
  ValidationError,
  NotFoundError,
  ConflictError,
  BusinessLogicError,
  DatabaseError
} from './AppError.js';

// Throw error if condition is true
export function throwIf(condition, ErrorClass, message) {
  if (condition) {
    throw new ErrorClass(message);
  }
}

// Throw validation error with field-level details
export function throwValidationError(message, errors = []) {
  throw new ValidationError(message, errors);
}

// Throw 404 error for missing resource
export function throwNotFound(resource = 'Resource') {
  throw new NotFoundError(resource);
}

// Throw 409 conflict error
export function throwConflict(message) {
  throw new ConflictError(message);
}

// Throw business rule violation error
export function throwBusinessError(message) {
  throw new BusinessLogicError(message);
}

// Check if resource exists, throw 404 if not
export function assertExists(resource, name = 'Resource') {
  if (!resource) {
    throw new NotFoundError(name);
  }
  return resource;
}

/**
 * Safe database operation with error handling
 */
export async function safeDatabaseOperation(operation, errorMessage = 'Database operation failed') {
  try {
    return await operation();
  } catch (error) {
    console.error('Database error:', error);
    throw new DatabaseError(errorMessage, error);
  }
}

/**
 * Validate and throw if invalid
 */
export function validateOrThrow(condition, message) {
  if (!condition) {
    throw new ValidationError(message);
  }
}
