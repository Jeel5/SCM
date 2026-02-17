import express from 'express';
import * as shippingQuoteController from '../controllers/shippingQuoteController.js';
import { authenticate } from '../middlewares/auth.js';
import { handleIdempotency } from '../middlewares/idempotency.js';

const router = express.Router();

// Optional authentication middleware
// Production systems should enforce authentication on all routes
const optionalAuth = (req, res, next) => {
  // Check if auth header exists
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }
  // Allow unauthenticated access with generic user context
  req.user = { id: 'anonymous-user', role: 'customer' };
  next();
};

router.use(optionalAuth);

/**
 * @route   POST /api/shipping/quick-estimate
 * @desc    Get quick shipping estimate for e-commerce checkout (before payment)
 * @access  Private
 * @body    { fromPincode, toPincode, weightKg, serviceType }
 */
router.post('/shipping/quick-estimate', shippingQuoteController.getQuickEstimate);

// Backward compatibility alias
router.post('/shipping/estimate', shippingQuoteController.getQuickEstimate);

/**
 * @route   POST /api/shipping/quotes
 * @desc    Get shipping quotes from all carriers after order is placed
 * @access  Private
 * @header  Idempotency-Key (recommended) - Prevents duplicate processing
 * @body    { origin, destination, items, orderId }
 * 
 * Features:
 * - 10 second timeout per carrier
 * - Minimum 2 quotes required (retries once if needed)
 * - Idempotent (safe to retry)
 * - Concurrency guard (shipping lock)
 * - Capacity reservation
 */
router.post('/shipping/quotes', handleIdempotency, shippingQuoteController.getShippingQuotes);

/**
 * @route   POST /api/shipping/quotes/legacy
 * @desc    DEPRECATED: Old endpoint for backward compatibility
 * @access  Private
 * @body    { origin, destination, items, orderId }
 */
router.post('/shipping/quotes/legacy', shippingQuoteController.getShippingQuotesLegacy);

/**
 * @route   POST /api/shipping/quotes/custom
 * @desc    Get shipping quotes with custom selection criteria
 * @access  Private
 * @body    { origin, destination, items, orderId, criteria }
 */
router.post('/shipping/quotes/custom', shippingQuoteController.getShippingQuotesWithCriteria);

/**
 * @route   POST /api/shipping/quotes/:carrierId
 * @desc    Get quote from a specific carrier
 * @access  Private
 * @body    { origin, destination, items, orderId }
 */
router.post('/shipping/quotes/:carrierId', shippingQuoteController.getQuoteFromCarrier);

/**
 * @route   POST /api/shipping/quotes/:quoteId/select
 * @desc    Select a specific quote for an order
 * @access  Private
 * @body    { orderId }
 */
router.post('/shipping/quotes/:quoteId/select', shippingQuoteController.selectQuote);

/**
 * @route   GET /api/shipping/quotes/order/:orderId
 * @desc    Get all quotes for an order
 * @access  Private
 */
router.get('/shipping/quotes/order/:orderId', shippingQuoteController.getQuotesForOrder);

export default router;
