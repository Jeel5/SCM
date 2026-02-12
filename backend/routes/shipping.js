import express from 'express';
import * as shippingQuoteController from '../controllers/shippingQuoteController.js';
import { authenticate } from '../middlewares/auth.js';
import { handleIdempotency } from '../middlewares/idempotency.js';

const router = express.Router();

// Optional authentication middleware (skip for demo)
// Note: In production, all routes should require authentication
const optionalAuth = (req, res, next) => {
  // For demo purposes, check if auth header exists
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }
  // Skip auth for demo - set dummy user
  req.user = { id: 'demo-user', role: 'customer' };
  next();
};

router.use(optionalAuth);

/**
 * @route   POST /api/shipping/quick-estimate
 * @desc    PHASE 1: Get quick shipping estimate for e-commerce checkout (BEFORE payment)
 * @access  Private
 * @body    { fromPincode, toPincode, weightKg, serviceType }
 */
router.post('/shipping/quick-estimate', shippingQuoteController.getQuickEstimate);

// Alias for demo (same endpoint)
router.post('/shipping/estimate', shippingQuoteController.getQuickEstimate);

/**
 * @route   POST /api/shipping/quotes
 * @desc    PHASE 2: Get REAL quotes from ALL carriers (AFTER order placed)
 * @access  Private
 * @header  Idempotency-Key (recommended) - Prevents duplicate processing
 * @body    { origin, destination, items, orderId }
 * 
 * Production features:
 * - 10 second timeout per carrier
 * - Minimum 2 quotes required (retries once if needed)
 * - Idempotent (safe to retry)
 * - Concurrency guard (shipping lock)
 * - Capacity reservation
 */
router.post('/shipping/quotes', handleIdempotency, shippingQuoteController.getRealShippingQuotes);

// Alias for demo
router.post('/shipping/quotes/real', handleIdempotency, shippingQuoteController.getRealShippingQuotes);

/**
 * @route   POST /api/shipping/quotes/legacy
 * @desc    DEPRECATED: Old endpoint for backward compatibility
 * @access  Private
 * @body    { origin, destination, items, orderId }
 */
router.post('/shipping/quotes/legacy', shippingQuoteController.getShippingQuotes);

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
