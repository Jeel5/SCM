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
import { injectOrgContext } from '../middlewares/multiTenant.js';
import { verifyWebhookSignature } from '../middlewares/webhookAuth.js';

const router = express.Router();

// ========== INTERNAL ASSIGNMENT ROUTES (JWT authenticated) ==========

// Request carrier assignment for an order
router.post('/orders/:orderId/request-carriers', authenticate, injectOrgContext, authorize('shipments:update'), requestCarrierAssignment);

// Get assignments for an order
router.get('/orders/:orderId/assignments', authenticate, injectOrgContext, authorize('shipments:read'), getOrderAssignments);

// Carrier notifies availability (HMAC — called from carrier system)
router.post('/carriers/:code/availability', verifyWebhookSignature(), updateCarrierAvailability);

// Carrier portal - get pending assignments (carrier-facing, no JWT — carriers identify by carrierId param)
router.get('/carriers/assignments/pending', getPendingAssignments);

// Get assignment details
router.get('/assignments/:assignmentId', authenticate, injectOrgContext, authorize('shipments:read'), getAssignmentDetails);

// ========== WEBHOOK-PROTECTED CARRIER ENDPOINTS (HMAC Authenticated) ==========

// Accept assignment - Protected with HMAC signature verification
router.post('/assignments/:assignmentId/accept', verifyWebhookSignature(), acceptAssignment);

// Reject assignment - Protected with HMAC signature verification
router.post('/assignments/:assignmentId/reject', verifyWebhookSignature(), rejectAssignment);

// Mark assignment as busy - Protected with HMAC signature verification
router.post('/assignments/:assignmentId/busy', verifyWebhookSignature(), markAsBusy);

export default router;
