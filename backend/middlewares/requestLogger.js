// HTTP request logging middleware - tracks all API requests with timing
import logger, { logRequest } from '../utils/logger.js';

// Log all HTTP requests with response time
export function requestLogger(req, res, next) {
  const startTime = Date.now();
  
  // Log when response finishes
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    logRequest(req, res, responseTime);
  });
  
  next();
}

// Assign unique ID to each request for tracing
export function requestId(req, res, next) {
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
}

// Log warning for requests exceeding threshold
export function slowRequestLogger(threshold = 1000) {
  return (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      if (duration > threshold) {
        logger.warn('Slow Request Detected', {
          method: req.method,
          url: req.originalUrl,
          duration: `${duration}ms`,
          threshold: `${threshold}ms`,
          requestId: req.id,
        });
      }
    });
    
    next();
  };
}
