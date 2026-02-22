import carrierAssignmentService from '../services/carrierAssignmentService.js';
import logger from '../utils/logger.js';
import { asyncHandler } from '../errors/index.js';
import OrderRepository from '../repositories/OrderRepository.js';
import CarrierAssignmentRepository from '../repositories/CarrierAssignmentRepository.js';
import CarrierRepository from '../repositories/CarrierRepository.js';

// ========== CARRIER ASSIGNMENTS ==========

/**
 * Request carrier assignment for an order
 * POST /api/orders/{orderId}/request-carriers
 */
export const requestCarrierAssignment = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { force } = req.query;

  // Get order details with items
  const order = await OrderRepository.findOrderWithItems(orderId);

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // Check if assignment already exists (unless force flag)
  if (!force) {
    const existingAssignments = await CarrierAssignmentRepository.findActiveByOrderId(orderId);

    if (existingAssignments.length > 0) {
      return res.json({
        success: true,
        data: {
          orderId,
          message: 'Assignment request already exists',
          existingAssignments
        }
      });
    }
  }

  const result = await carrierAssignmentService.requestCarrierAssignment(
    orderId,
    { items: order.items || [] }
  );

  res.status(201).json({ success: true, data: result });
});

/**
 * Get pending assignments for current carrier
 * GET /api/carriers/assignments/pending
 */
export const getPendingAssignments = asyncHandler(async (req, res) => {
  // Get carrier ID or code from query
  const { carrierId } = req.query;

  if (!carrierId) {
    return res.status(400).json({ error: 'carrierId required' });
  }

  // Check if carrierId is a code (e.g., "DHL-001") or numeric ID
  let actualCarrierId = carrierId;
  if (isNaN(carrierId) && !carrierId.includes('-')) {
    // If not UUID format or number, it might be a code
    const carrier = await CarrierRepository.findByCode(carrierId);

    if (!carrier) {
      return res.status(404).json({ error: `Carrier not found: ${carrierId}` });
    }

    actualCarrierId = carrier.id;
  }

  const result = await carrierAssignmentService.getPendingAssignments(actualCarrierId, {
    status: req.query.status,
    serviceType: req.query.serviceType
  });

  res.json({ success: true, data: result });
});

/**
 * Get assignment details
 * GET /api/assignments/{assignmentId}
 */
export const getAssignmentDetails = asyncHandler(async (req, res) => {
  const { assignmentId } = req.params;

  const assignment = await CarrierAssignmentRepository.findDetailsById(assignmentId);

  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found' });
  }

  // Parse JSON payloads
  assignment.requestPayload = typeof assignment.request_payload === 'string'
    ? JSON.parse(assignment.request_payload)
    : assignment.request_payload;

  assignment.acceptancePayload = assignment.acceptance_payload
    ? (typeof assignment.acceptance_payload === 'string'
      ? JSON.parse(assignment.acceptance_payload)
      : assignment.acceptance_payload)
    : null;

  // Cleanup DB fields
  delete assignment.request_payload;
  delete assignment.acceptance_payload;
  assignment.totalAmount = parseFloat(assignment.total_amount);
  delete assignment.total_amount;

  res.json({ success: true, data: assignment });
});

/**
 * Accept a carrier assignment
 * POST /api/assignments/{assignmentId}/accept
 */
export const acceptAssignment = asyncHandler(async (req, res) => {
  const { assignmentId } = req.params;
  // Get carrierId from webhook authentication or query param (backward compatibility)
  const carrierId = req.authenticatedCarrier?.id || req.query.carrierId || req.body.carrierId;
  const acceptanceData = req.body;

  logger.debug('Accept assignment request', {
    assignmentId,
    carrierId,
    fromWebhook: !!req.authenticatedCarrier,
    authenticatedCarrier: req.authenticatedCarrier
  });

  if (!carrierId) {
    return res.status(400).json({ error: 'carrierId required (provide via webhook auth or query param)' });
  }

  const result = await carrierAssignmentService.acceptAssignment(
    assignmentId,
    carrierId,
    acceptanceData
  );

  res.json({ success: true, data: result });
});

/**
 * Reject a carrier assignment
 * POST /api/assignments/{assignmentId}/reject
 */
export const rejectAssignment = asyncHandler(async (req, res) => {
  const { assignmentId } = req.params;
  // Get carrierId from webhook authentication or query param (backward compatibility)
  const carrierId = req.authenticatedCarrier?.id || req.query.carrierId || req.body.carrierId;
  const { reason } = req.body;

  if (!carrierId) {
    return res.status(400).json({ error: 'carrierId required (provide via webhook auth or query param)' });
  }

  const result = await carrierAssignmentService.rejectAssignment(
    assignmentId,
    carrierId,
    reason
  );

  res.json({ success: true, data: result });
});

/**
 * Get all assignments for an order
 * GET /api/orders/{orderId}/assignments
 */
export const getOrderAssignments = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const assignments = await CarrierAssignmentRepository.findByOrderId(orderId);

  // Formatting variables if needed
  const formattedAssignments = assignments.map(row => ({
    id: row.id,
    orderId: row.order_id,
    carrierId: row.carrier_id,
    carrierCode: row.code,
    carrierName: row.name,
    serviceType: row.service_type,
    status: row.status,
    requestedAt: row.requested_at,
    acceptedAt: row.accepted_at,
    expiresAt: row.expires_at
  }));

  res.json({ success: true, data: formattedAssignments });
});

/**
 * Mark assignment as busy (temporary rejection - can be accepted later)
 * POST /api/assignments/{assignmentId}/busy?carrierId={carrierId}
 */
export const markAsBusy = asyncHandler(async (req, res) => {
  const { assignmentId } = req.params;
  const { carrierId } = req.query;
  const { reason } = req.body;

  if (!carrierId) {
    return res.status(400).json({ error: 'Carrier ID required' });
  }

  const assignment = await CarrierAssignmentRepository.markAsBusy(assignmentId, carrierId, reason);

  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found or unauthorized' });
  }

  logger.info(`Assignment ${assignmentId} marked as busy by carrier ${carrierId}`);

  res.json({
    success: true,
    message: 'Assignment marked as busy. You can accept later if still available.',
    data: assignment
  });
});

/**
 * Carrier notifies they are now available/active
 * POST /api/carriers/:code/availability
 */
export const updateCarrierAvailability = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const { status } = req.body; // 'available', 'busy', 'offline'

  if (!code) {
    return res.status(400).json({ error: 'Carrier code required' });
  }

  if (!status || !['available', 'busy', 'offline'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be: available, busy, or offline' });
  }

  // Update carrier status and get pending assignments if becoming available
  if (status === 'available') {
    const result = await carrierAssignmentService.notifyCarrierOfPendingAssignments(code);
    return res.json(result);
  } else {
    // Just update status
    const carrier = await CarrierRepository.findByCode(code);
    if (!carrier) return res.status(404).json({ error: 'Carrier not found' });

    await CarrierRepository.updateCarrier(carrier.id, { availability_status: status });

    res.json({
      success: true,
      message: `Carrier ${code} status updated to ${status}`
    });
  }
});
