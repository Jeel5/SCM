import express from 'express';
import * as shippingQuoteController from '../controllers/shippingQuoteController.js';
import { authenticate } from '../middlewares/auth.js';
import { handleIdempotency } from '../middlewares/idempotency.js';

const router = express.Router();

// Public — called pre-auth during checkout
router.post('/shipping/quick-estimate', shippingQuoteController.getQuickEstimate);
router.post('/shipping/estimate', shippingQuoteController.getQuickEstimate);

// All quote routes require authentication
router.post('/shipping/quotes', authenticate, handleIdempotency, shippingQuoteController.getShippingQuotes);
router.post('/shipping/quotes/legacy', authenticate, shippingQuoteController.getShippingQuotesLegacy);
router.post('/shipping/quotes/custom', authenticate, shippingQuoteController.getShippingQuotesWithCriteria);
router.post('/shipping/quotes/:carrierId', authenticate, shippingQuoteController.getQuoteFromCarrier);
router.post('/shipping/quotes/:quoteId/select', authenticate, shippingQuoteController.selectQuote);
router.get('/shipping/quotes/order/:orderId', authenticate, shippingQuoteController.getQuotesForOrder);

export default router;
