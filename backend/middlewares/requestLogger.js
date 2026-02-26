// HTTP request logging middleware - tracks all API requests with timing
import crypto from 'crypto';
import logger, { logRequest } from '../utils/logger.js';

// Log all HTTP requests with response time
export function requestLogger(req, res, next) {
  const startTime = Date.now();
  let logged = false;

  const doLog = () => {
    if (logged) return;
    logged = true;
    const responseTime = Date.now() - startTime;
    if (res.statusCode >= 400 || responseTime > 1000) {
      logRequest(req, res, responseTime);
    }
  };

  // Log when response finishes normally
  res.on('finish', doLog);

  // Also capture aborted/closed connections (client disconnects before response)
  res.on('close', doLog);

  next();
}

// Assign unique ID to each request for tracing
export function requestId(req, res, next) {
  // Honour upstream x-request-id (load balancer / gateway) if present; otherwise generate one
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
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
