import express from 'express';
import {
  requestCarrierAssignment,
  getPendingAssignments,
  getAssignmentDetails,
  acceptAssignment,
  rejectAssignment,
  markAsBusy,
  getOrderAssignments,
  updateCarrierAvailability
} from '../controllers/assignmentController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
import { verifyWebhookSignature } from '../middlewares/webhookAuth.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import {
  acceptAssignmentSchema,
  rejectAssignmentSchema,
  busyAssignmentSchema,
  updateCarrierAvailabilitySchema,
  pendingAssignmentsQuerySchema
} from '../validators/assignmentSchemas.js';

const router = express.Router();

// ========== INTERNAL ASSIGNMENT ROUTES (JWT authenticated) ==========

// Request carrier assignment for an order
router.post('/orders/:orderId/request-carriers', authenticate, authorize('shipments:update'), requestCarrierAssignment);

// Get assignments for an order
router.get('/orders/:orderId/assignments', authenticate, authorize('shipments:read'), getOrderAssignments);

// Carrier notifies availability (HMAC — called from carrier system)
router.post('/carriers/:code/availability', verifyWebhookSignature(), validateRequest(updateCarrierAvailabilitySchema), updateCarrierAvailability);

// Carrier portal - get pending assignments (carrier-facing, no JWT — carriers identify by carrierId param)
router.get('/carriers/assignments/pending', validateQuery(pendingAssignmentsQuerySchema), getPendingAssignments);

// Get assignment details
router.get('/assignments/:assignmentId', authenticate, authorize('shipments:read'), getAssignmentDetails);

// ========== WEBHOOK-PROTECTED CARRIER ENDPOINTS (HMAC Authenticated) ==========

// Accept assignment - Protected with HMAC signature verification
router.post('/assignments/:assignmentId/accept', verifyWebhookSignature(), validateRequest(acceptAssignmentSchema), acceptAssignment);

// Reject assignment - Protected with HMAC signature verification
router.post('/assignments/:assignmentId/reject', verifyWebhookSignature(), validateRequest(rejectAssignmentSchema), rejectAssignment);

// Mark assignment as busy - Protected with HMAC signature verification
router.post('/assignments/:assignmentId/busy', verifyWebhookSignature(), validateRequest(busyAssignmentSchema), markAsBusy);

export default router;
