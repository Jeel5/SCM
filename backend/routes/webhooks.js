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
// Blocked by default. Set ALLOW_LEGACY_WEBHOOKS=true (env) only for local demo.
// Production deployments MUST use org-scoped token URLs above.
const legacyWebhookGuard = (_req, res, next) => {
  if (process.env.ALLOW_LEGACY_WEBHOOKS === 'true') return next();
  return res.status(410).json({
    success: false,
    message: 'Deprecated endpoint. Use the org-scoped URL: POST /api/webhooks/:orgToken/<event>'
  });
};

router.post('/orders',    legacyWebhookGuard, webhooksController.handleOrderWebhook);
router.post('/tracking',  legacyWebhookGuard, webhooksController.handleTrackingWebhook);
router.post('/inventory', legacyWebhookGuard, webhooksController.handleInventoryWebhook);
router.post('/returns',   legacyWebhookGuard, webhooksController.handleReturnWebhook);
router.post('/rates',     legacyWebhookGuard, webhooksController.handleRatesWebhook);
router.post('/generic',   legacyWebhookGuard, webhooksController.handleGenericWebhook);

// ── Management endpoints (require auth) ───────────────────────────────────────

// Check webhook processing status
router.get('/status/:jobId', authenticate, webhooksController.getWebhookStatus);

export default router;
