// Global error handler - catches all errors and sends formatted responses

import { AppError } from './AppError.js';
import { logError } from '../utils/logger.js';

// Development mode - include full error details and stack trace
function sendErrorDev(err, res) {
  res.status(err.statusCode || 500).json({
    success: false,
    error: {
      message: err.message,
      statusCode: err.statusCode,
      name: err.name,
      stack: err.stack,
      errors: err.errors || undefined,
      timestamp: err.timestamp || new Date().toISOString()
    }
  });
}

// Production mode - minimal error details for security
function sendErrorProd(err, res) {
  // Operational, trusted error: send details to client
  if (err.isOperational) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: {
        message: err.message,
        statusCode: err.statusCode,
        errors: err.errors || undefined,
        timestamp: err.timestamp || new Date().toISOString()
      }
    });
  } 
  // Programming or unknown error: don't leak details
  else {
    logError(err, { type: 'Unhandled Error', operational: false });
    res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
}

/**
 * Handle specific database errors
 */
function handleDatabaseError(err) {
  // PostgreSQL unique violation
  if (err.code === '23505') {
    const match = err.detail?.match(/Key \((.*?)\)=\((.*?)\)/);
    const field = match ? match[1] : 'field';
    return new AppError(`Duplicate value for ${field}`, 409, true);
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return new AppError('Referenced record does not exist', 400, true);
  }

  // PostgreSQL not null violation
  if (err.code === '23502') {
    return new AppError(`Missing required field: ${err.column}`, 400, true);
  }

  // PostgreSQL invalid input syntax
  if (err.code === '22P02') {
    return new AppError('Invalid data format', 400, true);
  }

  // Generic database error
  return new AppError('Database operation failed', 500, false);
}

/**
 * Handle JWT errors
 */
function handleJWTError() {
  return new AppError('Invalid token. Please log in again', 401, true);
}

function handleJWTExpiredError() {
  return new AppError('Token expired. Please log in again', 401, true);
}

/**
 * Global Error Handler Middleware
 */
export function errorHandler(err, req, res, next) {
  let error = { ...err };
  error.message = err.message;
  error.name = err.name;
  error.statusCode = err.statusCode || 500;
  error.isOperational = err.isOperational !== undefined ? err.isOperational : false;

  // Log error with full context
  logError(error, {
    path: req.path,
    method: req.method,
    requestId: req.id,
    userId: req.user?.id,
    ip: req.ip,
  });

  // Handle specific error types
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
  if (err.code && err.code.startsWith('23')) error = handleDatabaseError(err);

  // Send response based on environment
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
}

/**
 * 404 Not Found Handler
 */
export function notFoundHandler(req, res, next) {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404, true);
  next(error);
}

/**
 * Async Error Wrapper
 * Wraps async route handlers to catch errors automatically
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
