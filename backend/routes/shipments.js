// Shipment routes - all require authentication and shipment permissions
import express from 'express';
import { listShipments, getShipment, getShipmentTimeline, createShipment, updateShipmentStatus, confirmPickup } from '../controllers/shipmentsController.js';
import {
  getShipmentDetails,
  updateShipmentTracking,
  calculateRoute,
  simulateTrackingUpdate,
  getTrackingTimeline
} from '../controllers/trackingController.js';
import { authenticate, optionalAuth } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
import { verifyWebhookSignature } from '../middlewares/webhookAuth.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import { 
  createShipmentSchema, 
  updateShipmentStatusSchema, 
  listShipmentsQuerySchema 
} from '../validators/shipmentSchemas.js';
import { validateUUIDParams } from '../middlewares/validateParams.js';

const router = express.Router();

// Carrier portal — carriers filter by carrier_id param; authenticated users see org-scoped results
router.get('/shipments', optionalAuth, validateQuery(listShipmentsQuerySchema), listShipments);

router.get('/shipments/:id', authenticate, authorize('shipments:read'), validateUUIDParams, getShipment);
router.get('/shipments/:id/timeline', authenticate, authorize('shipments:read'), validateUUIDParams, getShipmentTimeline);
router.post('/shipments', authenticate, authorize('shipments:create'), validateRequest(createShipmentSchema), createShipment);
router.patch('/shipments/:id/status', authenticate, authorize('shipments:update'), validateUUIDParams, validateRequest(updateShipmentStatusSchema), updateShipmentStatus);

// Carrier-only endpoint: Confirm pickup (Method A - Carrier Only Control)
// Protected with HMAC signature verification
router.post('/shipments/:id/confirm-pickup', verifyWebhookSignature(), confirmPickup);

// Tracking endpoints — write endpoints protected with webhook signature, reads require auth
router.get('/shipments/:trackingNumber/details', authenticate, authorize('shipments:read'), getShipmentDetails);
router.get('/shipments/:trackingNumber/timeline', authenticate, authorize('shipments:read'), getTrackingTimeline);
router.post('/shipments/:trackingNumber/update-tracking', verifyWebhookSignature(), updateShipmentTracking);
router.post('/shipments/:trackingNumber/calculate-route', authenticate, authorize('shipments:update'), calculateRoute);
// Only expose the simulate-update endpoint in non-production environments.
// This endpoint writes fake tracking events and must never be reachable in production.
if (process.env.NODE_ENV !== 'production') {
  router.post('/shipments/:trackingNumber/simulate-update', authenticate, authorize('shipments:update'), simulateTrackingUpdate);
}

export default router;
