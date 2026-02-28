import express from 'express';
import * as shippingQuoteController from '../controllers/shippingQuoteController.js';
import { authenticate } from '../middlewares/auth.js';
import { handleIdempotency } from '../middlewares/idempotency.js';
import { validateRequest } from '../validators/index.js';
import {
  quickEstimateSchema,
  getShippingQuotesSchema,
  getShippingQuotesWithCriteriaSchema,
  getQuoteFromCarrierSchema,
  selectQuoteSchema,
} from '../validators/shippingSchemas.js';

const router = express.Router();

// Public — called pre-auth during checkout
router.post('/shipping/quick-estimate', validateRequest(quickEstimateSchema), shippingQuoteController.getQuickEstimate);
router.post('/shipping/estimate', validateRequest(quickEstimateSchema), shippingQuoteController.getQuickEstimate);

// All quote routes require authentication
router.post('/shipping/quotes', authenticate, handleIdempotency, validateRequest(getShippingQuotesSchema), shippingQuoteController.getShippingQuotes);
router.post('/shipping/quotes/legacy', authenticate, validateRequest(getShippingQuotesSchema), shippingQuoteController.getShippingQuotesLegacy);
router.post('/shipping/quotes/custom', authenticate, validateRequest(getShippingQuotesWithCriteriaSchema), shippingQuoteController.getShippingQuotesWithCriteria);
router.post('/shipping/quotes/:carrierId', authenticate, validateRequest(getQuoteFromCarrierSchema), shippingQuoteController.getQuoteFromCarrier);
router.post('/shipping/quotes/:quoteId/select', authenticate, validateRequest(selectQuoteSchema), shippingQuoteController.selectQuote);
router.get('/shipping/quotes/order/:orderId', authenticate, shippingQuoteController.getQuotesForOrder);

export default router;
