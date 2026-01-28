/**
 * Standardized Response Utility
 * Provides consistent response formatting across all API endpoints
 */

/**
 * Send successful response with data
 * @param {object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
export function sendSuccess(res, data, message = null, statusCode = 200) {
  const response = {
    success: true,
    data,
  };

  if (message) {
    response.message = message;
  }

  return res.status(statusCode).json(response);
}

/**
 * Send successful response with pagination
 * @param {object} res - Express response object
 * @param {Array} data - Response data array
 * @param {object} pagination - Pagination metadata
 * @param {string} message - Optional success message
 */
export function sendPaginated(res, data, pagination, message = null) {
  const response = {
    success: true,
    data,
    pagination: {
      total: pagination.total || 0,
      page: pagination.page || 1,
      limit: pagination.limit || 20,
      totalPages: Math.ceil((pagination.total || 0) / (pagination.limit || 20)),
    },
  };

  if (message) {
    response.message = message;
  }

  return res.status(200).json(response);
}

/**
 * Send error response
 * @param {object} res - Express response object
 * @param {string} error - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {*} details - Optional error details
 */
export function sendError(res, error, statusCode = 500, details = null) {
  const response = {
    success: false,
    error,
  };

  if (details) {
    response.details = details;
  }

  return res.status(statusCode).json(response);
}

/**
 * Send validation error response
 * @param {object} res - Express response object
 * @param {Array|object} errors - Validation errors
 */
export function sendValidationError(res, errors) {
  return res.status(400).json({
    success: false,
    error: 'Validation failed',
    details: errors,
  });
}

/**
 * Send not found error
 * @param {object} res - Express response object
 * @param {string} resource - Resource name
 */
export function sendNotFound(res, resource = 'Resource') {
  return res.status(404).json({
    success: false,
    error: `${resource} not found`,
  });
}

/**
 * Send unauthorized error
 * @param {object} res - Express response object
 * @param {string} message - Optional custom message
 */
export function sendUnauthorized(res, message = 'Unauthorized') {
  return res.status(401).json({
    success: false,
    error: message,
  });
}

/**
 * Send forbidden error
 * @param {object} res - Express response object
 * @param {string} message - Optional custom message
 */
export function sendForbidden(res, message = 'Access forbidden') {
  return res.status(403).json({
    success: false,
    error: message,
  });
}

/**
 * Send created response
 * @param {object} res - Express response object
 * @param {*} data - Created resource data
 * @param {string} message - Optional success message
 */
export function sendCreated(res, data, message = 'Resource created successfully') {
  return res.status(201).json({
    success: true,
    data,
    message,
  });
}

/**
 * Send no content response
 * @param {object} res - Express response object
 */
export function sendNoContent(res) {
  return res.status(204).send();
}
