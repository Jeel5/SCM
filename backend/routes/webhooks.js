import express from 'express';
import * as webhooksController from '../controllers/webhooksController.js';

const router = express.Router();

/**
 * Webhook Routes
 * Public endpoints for receiving webhooks from external systems
 * Note: These endpoints typically don't require authentication
 * but should validate webhook signatures in production
 */

// Order webhooks from e-commerce platforms
router.post('/orders', webhooksController.handleOrderWebhook);

// Carrier tracking updates
router.post('/tracking', webhooksController.handleTrackingWebhook);

// Warehouse inventory updates
router.post('/inventory', webhooksController.handleInventoryWebhook);

// Return requests
router.post('/returns', webhooksController.handleReturnWebhook);

// Carrier rate responses
router.post('/rates', webhooksController.handleRatesWebhook);

// Generic webhook endpoint (for testing)
router.post('/generic', webhooksController.handleGenericWebhook);

// Check webhook processing status
router.get('/status/:jobId', webhooksController.getWebhookStatus);

// Generate sample webhook data (for testing)
router.get('/sample/:type', webhooksController.generateSampleWebhook);

export default router;
