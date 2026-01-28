// Custom error classes for different HTTP status codes and error types

// Base error class - all custom errors extend this
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

// 400 - Invalid input data
class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

// 401 - Not logged in or invalid token
class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
  }
}

// 403 - Logged in but lacks required permissions
class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}

// 404 - Resource not found
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
    this.resource = resource;
  }
}

/**
 * Conflict Error (409)
 */
class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
  }
}

/**
 * Database Error (500)
 */
class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', originalError = null) {
    super(message, 500);
    this.originalError = originalError;
  }
}

/**
 * External Service Error (502)
 */
class ExternalServiceError extends AppError {
  constructor(service, message = 'External service error') {
    super(`${service}: ${message}`, 502);
    this.service = service;
  }
}

/**
 * Business Logic Error (422)
 */
class BusinessLogicError extends AppError {
  constructor(message) {
    super(message, 422);
  }
}

/**
 * Rate Limit Error (429)
 */
class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
  }
}

export {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  AuthorizationError as ForbiddenError, // Alias for 403 errors
  NotFoundError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  BusinessLogicError,
  RateLimitError
};
