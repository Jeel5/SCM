import shipmentRepo from '../repositories/ShipmentRepository.js';
import shipmentTrackingService from '../services/shipmentTrackingService.js';
import operationalNotificationService from '../services/operationalNotificationService.js';
import { asyncHandler, NotFoundError, AppError, AuthorizationError } from '../errors/index.js';
import { emitToOrg } from '../sockets/emitter.js';
import { invalidatePatterns, invalidationTargets } from '../utils/cache.js';

// ========== SHIPMENT TRACKING ==========

/**
 * Get shipment details with tracking history
 * GET /api/shipments/{trackingNumber}/details
 */
export const getShipmentDetails = asyncHandler(async (req, res) => {
  const { trackingNumber } = req.params;
  const organizationId = req.orgContext?.organizationId;

  // Find shipment by tracking number
  const shipment = await shipmentRepo.findByTrackingNumber(trackingNumber, organizationId);
  if (!shipment) throw new NotFoundError('Shipment');

  const shipmentDetails = await shipmentTrackingService.getShipmentDetails(shipment.id);

  res.json({ success: true, data: shipmentDetails });
});

/**
 * Update shipment with tracking event (from carrier webhook)
 * POST /api/shipments/{trackingNumber}/update-tracking
 */
export const updateShipmentTracking = asyncHandler(async (req, res) => {
  const { trackingNumber } = req.params;
  const { eventType, location, description } = req.body;

  if (!eventType) throw new AppError('eventType required', 400);

  // Find shipment by tracking number
  const shipment = await shipmentRepo.findByTrackingNumberWithCarrier(trackingNumber);
  if (!shipment) throw new NotFoundError('Shipment');

  // Verify the authenticated carrier owns this shipment (prevent fake delivery injection)
  const authenticatedCarrierId = req.authenticatedCarrier?.id;
  const shipmentCarrierId = shipment.authenticated_carrier_id || shipment.carrier_id;
  if (authenticatedCarrierId && shipmentCarrierId !== authenticatedCarrierId) {
    throw new AuthorizationError('Carrier not authorized to update this shipment');
  }

  const shipmentId = shipment.id;

  const trackingEvent = {
    eventType,
    location: location || null,
    description: description || ''
  };

  const updatedShipment = await shipmentTrackingService.updateShipmentTracking(
    shipmentId,
    trackingEvent
  );

  const organizationId = updatedShipment.organization_id || shipment.organization_id || req.orgContext?.organizationId;
  const orderId = updatedShipment.order_id || shipment.order_id || null;

  emitToOrg(organizationId, 'shipment:updated', {
    shipmentId,
    status: updatedShipment.status,
    trackingNumber,
  });

  operationalNotificationService.queueOrganizationNotification({
    organizationId,
    type: 'shipment',
    title: 'Tracking Updated',
    message: `Shipment ${trackingNumber} updated to '${updatedShipment.status}'.`,
    link: '/shipments',
    metadata: { event: 'tracking_updated', shipmentId, trackingNumber, status: updatedShipment.status },
  });

  if (updatedShipment.created_exception) {
    emitToOrg(organizationId, 'exception:created', updatedShipment.created_exception);
  }

  if (orderId) {
    emitToOrg(organizationId, 'order:updated', {
      orderId,
      shipmentStatus: updatedShipment.status,
    });
  }

  await invalidatePatterns(invalidationTargets(
    organizationId,
    'ship:list',
    'ship:details',
    'orders:list',
    'orders:detail',
    'exceptions:list',
    'dash',
    'analytics',
  ));

  res.json({
    success: true,
    data: {
      trackingNumber,
      status: updatedShipment.status,
      currentLocation: updatedShipment.current_location,
      message: 'Tracking updated successfully'
    }
  });
});

/**
 * Calculate and update route for shipment
 * POST /api/shipments/{trackingNumber}/calculate-route
 */
export const calculateRoute = asyncHandler(async (req, res) => {
  const { trackingNumber } = req.params;
  const organizationId = req.orgContext?.organizationId;

  // Get shipment
  const shipment = await shipmentRepo.findByTrackingNumber(trackingNumber, organizationId);
  if (!shipment) throw new NotFoundError('Shipment');

  const route = await shipmentTrackingService.calculateRoute(
    shipment.origin_address,
    shipment.destination_address
  );

  if (!route) throw new AppError('Could not calculate route', 400);

  // Update shipment with route geometry
  await shipmentRepo.updateRouteGeometry(trackingNumber, organizationId, route.geometry);

  res.json({
    success: true,
    data: {
      trackingNumber,
      route: {
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry
      },
      message: 'Route calculated successfully'
    }
  });
});

/**
 * Simulate tracking update (for testing/demonstration)
 * POST /api/shipments/{trackingNumber}/simulate-update
 */
export const simulateTrackingUpdate = asyncHandler(async (req, res) => {
  const { trackingNumber } = req.params;
  const { status, location, description } = req.body;
  const organizationId = req.orgContext?.organizationId;

  // Find shipment
  const shipment = await shipmentRepo.findByTrackingNumber(trackingNumber, organizationId);
  if (!shipment) throw new NotFoundError('Shipment');

  const updatedShipment = await shipmentTrackingService.simulateCarrierUpdate(
    shipment.id,
    status,
    location,
    description
  );

  res.json({
    success: true,
    data: {
      trackingNumber,
      status: updatedShipment.status,
      currentLocation: updatedShipment.current_location,
      message: 'Tracking simulated successfully'
    }
  });
});

/**
 * Get shipment tracking events timeline
 * GET /api/shipments/tracking/{trackingNumber}/timeline
 */
export const getTrackingTimeline = asyncHandler(async (req, res) => {
  const { trackingNumber } = req.params;
  const organizationId = req.orgContext?.organizationId;

  const events = await shipmentRepo.findTimelineByTrackingNumber(trackingNumber, organizationId);

  const mappedEvents = events.map(row => ({
    id: row.id,
    eventType: row.event_type,
    location: row.location,
    description: row.description,
    timestamp: row.event_timestamp
  }));

  res.json({ success: true, data: mappedEvents });
});
