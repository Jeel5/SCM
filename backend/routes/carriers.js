/**
 * Carrier webhook and quote-status routes.
 *
 * WHY no authentication on the webhook endpoint:
 *   Real carrier systems send webhooks from their own servers using a shared
 *   HMAC secret — they do NOT hold a user JWT.  The endpoint is therefore
 *   protected by verifyWebhookSignature() rather than authenticate().
 */

import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
import { verifyWebhookSignature } from '../middlewares/webhookAuth.js';
import { handleCarrierWebhook, getCarrierQuoteStatus } from '../controllers/carriersController.js';
import { validateRequest } from '../validators/index.js';
import { carrierWebhookSchema } from '../validators/carrierSchemas.js';

const router = express.Router();

// Async acceptance / rejection callback from carrier partner.
// Protected by HMAC signature — no JWT required.
router.post('/carriers/webhook/:carrierId', verifyWebhookSignature(), validateRequest(carrierWebhookSchema), handleCarrierWebhook);

// View accepted quotes and rejections recorded for a given order.
router.get('/carriers/orders/:orderId/quote-status', authenticate, authorize('orders.view'), getCarrierQuoteStatus);

export default router;
