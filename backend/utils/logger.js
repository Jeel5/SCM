// Winston logger configuration - writes logs to files with rotation
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log severity levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan',
};

winston.addColors(colors);

// Determine log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    let log = `${timestamp} [${level}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
  }),
  
  // Error log file
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/error.log'),
    level: 'error',
    format,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // Combined log file
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/combined.log'),
    format,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // HTTP requests log file
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/http.log'),
    level: 'http',
    format,
    maxsize: 5242880, // 5MB
    maxFiles: 3,
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create a stream object for Morgan HTTP logger
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

/**
 * Log with context
 */
export function logWithContext(level, message, context = {}) {
  logger.log(level, message, {
    ...context,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log HTTP request
 */
export function logRequest(req, res, responseTime) {
  logger.http('HTTP Request', {
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
}

/**
 * Log database query
 */
export function logQuery(query, params, duration) {
  logger.debug('Database Query', {
    query,
    params,
    duration: `${duration}ms`,
  });
}

/**
 * Log error with full context
 */
export function logError(error, context = {}) {
  logger.error(error.message, {
    name: error.name,
    stack: error.stack,
    statusCode: error.statusCode,
    ...context,
  });
}

/**
 * Log business event
 */
export function logEvent(event, data = {}) {
  logger.info(`Event: ${event}`, data);
}

/**
 * Log authentication event
 */
export function logAuth(event, userId, details = {}) {
  logger.info(`Auth: ${event}`, {
    userId,
    ...details,
  });
}

/**
 * Log performance metric
 */
export function logPerformance(operation, duration, metadata = {}) {
  logger.info(`Performance: ${operation}`, {
    duration: `${duration}ms`,
    ...metadata,
  });
}

/**
 * Log info message
 */
export function logInfo(message, metadata = {}) {
  logger.info(message, metadata);
}

export default logger;
