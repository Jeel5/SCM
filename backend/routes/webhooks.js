import express from 'express';
import * as webhooksController from '../controllers/webhooksController.js';
import { authenticate } from '../middlewares/auth.js';
import { resolveWebhookOrg } from '../middlewares/webhookOrgContext.js';

const router = express.Router();

/**
 * Webhook Routes
 * 
 * Multi-tenant webhooks: Org is identified by a secret token in the URL.
 * Each organization gets a unique webhook_token (see organizations.webhook_token).
 *
 *   POST /api/webhooks/:orgToken/orders     → order from Croma, Amazon etc.
 *   POST /api/webhooks/:orgToken/inventory  → warehouse sync for that org
 *   POST /api/webhooks/:orgToken/returns    → return requests for that org
 *
 * Legacy/demo routes (no token → organization_id = null, for testing only):
 *   POST /api/webhooks/orders
 *   POST /api/webhooks/generic
 */

// ── Org-scoped webhook routes ─────────────────────────────────────────────────
// resolveWebhookOrg looks up :orgToken against organizations.webhook_token
// and sets req.webhookOrganizationId. Returns 401 if token is invalid.

router.post('/:orgToken/orders', resolveWebhookOrg, webhooksController.handleOrderWebhook);
router.post('/:orgToken/inventory', resolveWebhookOrg, webhooksController.handleInventoryWebhook);
router.post('/:orgToken/returns', resolveWebhookOrg, webhooksController.handleReturnWebhook);
router.post('/:orgToken/tracking', resolveWebhookOrg, webhooksController.handleTrackingWebhook);
router.post('/:orgToken/rates', resolveWebhookOrg, webhooksController.handleRatesWebhook);

// ── Legacy / demo routes (organization_id = null) ─────────────────────────────
// These remain for the demo site and backward compatibility.
// In production, clients MUST use the org-scoped token URLs above.
router.post('/orders', webhooksController.handleOrderWebhook);
router.post('/tracking', webhooksController.handleTrackingWebhook);
router.post('/inventory', webhooksController.handleInventoryWebhook);
router.post('/returns', webhooksController.handleReturnWebhook);
router.post('/rates', webhooksController.handleRatesWebhook);
router.post('/generic', webhooksController.handleGenericWebhook);

// ── Management endpoints (require auth) ───────────────────────────────────────

// Check webhook processing status
router.get('/status/:jobId', authenticate, webhooksController.getWebhookStatus);

export default router;
