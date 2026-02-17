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
import { verifyWebhookSignature } from '../middlewares/webhookAuth.js';

const router = express.Router();

// ========== CARRIER ASSIGNMENT ROUTES ==========

// Request carrier assignment for an order
router.post('/orders/:orderId/request-carriers', requestCarrierAssignment);

// Get assignments for an order
router.get('/orders/:orderId/assignments', getOrderAssignments);

// Carrier notifies availability status (called when carrier becomes active)
router.post('/carriers/:code/availability', updateCarrierAvailability);

// Carrier portal - get pending assignments for a carrier
router.get('/carriers/assignments/pending', getPendingAssignments);

// Get assignment details
router.get('/assignments/:assignmentId', getAssignmentDetails);

// ========== WEBHOOK-PROTECTED CARRIER ENDPOINTS (HMAC Authenticated) ==========

// Accept assignment - Protected with HMAC signature verification
router.post('/assignments/:assignmentId/accept', verifyWebhookSignature(), acceptAssignment);

// Reject assignment - Protected with HMAC signature verification
router.post('/assignments/:assignmentId/reject', verifyWebhookSignature(), rejectAssignment);

// Mark assignment as busy - Protected with HMAC signature verification
router.post('/assignments/:assignmentId/busy', verifyWebhookSignature(), markAsBusy);

export default router;
