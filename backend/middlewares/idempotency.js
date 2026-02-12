/**
 * Idempotency Middleware
 * Handles idempotency keys for Phase 2 quote requests
 * 
 * Frontend should send: Idempotency-Key header
 * Format: <orderId>-<timestamp> or any unique string
 * 
 * If request with same key already processed, returns cached result
 */

import { IdempotencyManager } from '../utils/shippingHelpers.js';
import logger from '../utils/logger.js';

/**
 * Check if request has idempotency key and return cached result if available
 */
export const handleIdempotency = async (req, res, next) => {
  try {
    // Get idempotency key from header
    const idempotencyKey = req.headers['idempotency-key'] || 
                           req.headers['x-idempotency-key'];

    if (!idempotencyKey) {
      // No idempotency key - proceed normally but log warning for Phase 2 endpoints
      if (req.path.includes('/quotes')) {
        logger.warn('No idempotency key provided for quote request', {
          path: req.path,
          orderId: req.body.orderId
        });
      }
      return next();
    }

    // Check if we've seen this key before
    const cached = await IdempotencyManager.checkIdempotency(idempotencyKey);

    if (cached.cached) {
      // Return cached result
      logger.info('Returning cached response for idempotency key', {
        idempotencyKey,
        cachedAt: cached.cachedAt
      });

      return res.status(200).json({
        ...cached.result,
        cached: true,
        cachedAt: cached.cachedAt,
        message: 'This request was already processed. Returning cached result.'
      });
    }

    // Not cached - attach key to request for later caching
    req.idempotencyKey = idempotencyKey;
    next();

  } catch (error) {
    logger.error('Error in idempotency middleware', { error: error.message });
    // Fail open - don't block request if idempotency check fails
    next();
  }
};

/**
 * Cache response for idempotency (call after successful response)
 */
export const cacheResponse = async (req, result) => {
  if (req.idempotencyKey) {
    await IdempotencyManager.cacheResult(req.idempotencyKey, result);
  }
};

export default {
  handleIdempotency,
  cacheResponse
};
