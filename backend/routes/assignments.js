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

// Accept assignment
router.post('/assignments/:assignmentId/accept', acceptAssignment);

// Reject assignment
router.post('/assignments/:assignmentId/reject', rejectAssignment);

// Mark assignment as busy (temporary rejection)
router.post('/assignments/:assignmentId/busy', markAsBusy);

export default router;
