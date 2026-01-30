// Shipment routes - all require authentication and shipment permissions
import express from 'express';
import { listShipments, getShipment, getShipmentTimeline, createShipment, updateShipmentStatus } from '../controllers/shipmentsController.js';
import {
  getShipmentDetails,
  updateShipmentTracking,
  calculateRoute,
  simulateTrackingUpdate,
  getTrackingTimeline
} from '../controllers/trackingController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import { 
  createShipmentSchema, 
  updateShipmentStatusSchema, 
  listShipmentsQuerySchema 
} from '../validators/shipmentSchemas.js';

const router = express.Router();

router.get('/shipments', authenticate, authorize('shipments:read'), validateQuery(listShipmentsQuerySchema), listShipments);
router.get('/shipments/:id', authenticate, authorize('shipments:read'), getShipment);
router.get('/shipments/:id/timeline', authenticate, authorize('shipments:read'), getShipmentTimeline);
router.post('/shipments', authenticate, authorize('shipments:create'), validateRequest(createShipmentSchema), createShipment);
router.patch('/shipments/:id/status', authenticate, authorize('shipments:update'), validateRequest(updateShipmentStatusSchema), updateShipmentStatus);

// Tracking endpoints (public for carrier webhooks, authenticated for others)
router.get('/shipments/:trackingNumber/details', getShipmentDetails);
router.get('/shipments/:trackingNumber/timeline', getTrackingTimeline);
router.post('/shipments/:trackingNumber/update-tracking', updateShipmentTracking);
router.post('/shipments/:trackingNumber/calculate-route', calculateRoute);
router.post('/shipments/:trackingNumber/simulate-update', simulateTrackingUpdate); // For testing

export default router;
