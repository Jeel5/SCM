// Shipments Controller - handles HTTP requests for shipment tracking
import shipmentRepo from '../repositories/ShipmentRepository.js';
import orderRepo from '../repositories/OrderRepository.js';
import shipmentService from '../services/shipmentService.js';
import orderService from '../services/orderService.js';
import { emitToOrg, emitToShipment } from '../sockets/emitter.js';
import { matchSlaPolicyForShipment } from '../services/slaPolicyMatchingService.js';
import { withTransaction } from '../utils/dbTransaction.js';
import { asyncHandler, NotFoundError, ValidationError } from '../errors/index.js';
import logger from '../utils/logger.js';
import { cacheWrap, orgSeg, hashParams, invalidatePatterns, invalidationTargets } from '../utils/cache.js';

// ─── Shipment State Machine lives in services/shipmentService.js ───────────────────────
// Import SHIPMENT_VALID_TRANSITIONS from there if needed in other controller functions.

// Get shipments list with filters and pagination
export const listShipments = asyncHandler(async (req, res) => {
  const queryParams = req.validatedQuery || req.query;
  const { status, carrier_id, search, page, limit } = queryParams;
  const organizationId = req.orgContext?.organizationId;

  const pageNum  = parseInt(page)  || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);

  // Cache paginated + filtered list (including batch-loaded events) for 30 seconds
  const cacheKey = `ship:list:${orgSeg(organizationId)}:${hashParams({ status, carrier_id, search, page: pageNum, limit: limitNum })}`;
  const cached = await cacheWrap(cacheKey, 30, async () => {
    const { shipments: rows, totalCount } = await shipmentRepo.findShipmentsWithDetails({
      page: pageNum, limit: limitNum, status, carrier_id, search, organizationId,
    });

    const shipmentIds = rows.map(r => r.id);
    const allEvents = await shipmentRepo.findTrackingEventsByIds(shipmentIds);
    const eventsByShipment = allEvents.reduce((acc, e) => {
      (acc[e.shipment_id] = acc[e.shipment_id] || []).push(e);
      return acc;
    }, {});

    return {
      data: rows.map(row => ({
        id: row.id,
        trackingNumber: row.tracking_number,
        orderId: row.order_id,
        orderNumber: row.order_number,
        carrierId: row.carrier_id,
        carrierName: row.carrier_name,
        carrierCode: row.carrier_code,
        warehouseId: row.warehouse_id,
        warehouseName: row.warehouse_name,
        status: row.status,
        origin: row.origin_address,
        destination: row.destination_address,
        currentLocation: row.current_location,
        weight: parseFloat(row.weight || 0),
        cost: parseFloat(row.shipping_cost || 0),
        estimatedDelivery: row.delivery_scheduled,
        slaDeadline: row.delivery_scheduled,
        pickupScheduled: row.pickup_scheduled,
        pickupActual: row.pickup_actual,
        deliveryActual: row.delivery_actual,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        events: (eventsByShipment[row.id] || []).map(e => ({
          id: e.id,
          shipmentId: e.shipment_id,
          status: e.event_type,
          location: e.location,
          timestamp: e.event_timestamp,
          description: e.description
        }))
      })),
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    };
  });

  res.json({ success: true, ...cached });
});

// Get single shipment
export const getShipment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;

  const row = await shipmentRepo.findShipmentDetails(id, organizationId);
  if (!row) throw new NotFoundError('Shipment');

  const eventsResult = await shipmentRepo.findTrackingEvents(id);

  res.json({
    success: true,
    data: {
      id: row.id,
      trackingNumber: row.tracking_number,
      orderId: row.order_id,
      orderNumber: row.order_number,
      carrierId: row.carrier_id,
      carrierName: row.carrier_name,
      status: row.status,
      origin: row.origin_address,
      destination: row.destination_address,
      currentLocation: row.current_location,
      weight: parseFloat(row.weight || 0),
      cost: parseFloat(row.shipping_cost || 0),
      estimatedDelivery: row.delivery_scheduled,
      createdAt: row.created_at,
      events: eventsResult.map(e => ({
        id: e.id,
        status: e.event_type,
        location: e.location,
        timestamp: e.event_timestamp,
        description: e.description
      }))
    }
  });
});

// Get shipment timeline
export const getShipmentTimeline = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;

  const events = await shipmentRepo.findTimelineByShipmentId(id, organizationId);

  res.json({
    success: true,
    data: events.map(e => ({
      id: e.id,
      shipmentId: e.shipment_id,
      status: e.event_type,
      location: e.location,
      timestamp: e.event_timestamp,
      description: e.description
    }))
  });
});

// Create shipment
export const createShipment = asyncHandler(async (req, res) => {
  const { order_id, carrier_id, origin, destination } = req.body;
  // Inject org context so the shipment is scoped to the creating org (T1-03)
  const organizationId = req.orgContext?.organizationId;

  // Defensive: log the incoming request for traceability
  logger.info('Shipment creation requested', {
    orderId: order_id,
    carrierId: carrier_id,
    organizationId,
    hasOrigin: !!origin,
    hasDestination: !!destination,
  });

  if (!order_id) throw new ValidationError('order_id is required');
  if (!carrier_id) throw new ValidationError('carrier_id is required');

  const shipment = await withTransaction(async (tx) => {
    const order = await orderRepo.findOrderWithItems(order_id, undefined, tx);
    if (!order) throw new NotFoundError('Order');

    // Defensive: warn if order is already shipped
    if (order.status === 'shipped' || order.status === 'delivered') {
      logger.warn('Creating shipment for order that is already shipped/delivered', {
        orderId: order_id,
        currentStatus: order.status,
      });
    }

    const trackingNumber = req.body.tracking_number
      || `TRK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // Match SLA policy and derive delivery_scheduled
    const slaMatch = await matchSlaPolicyForShipment({
      organizationId,
      carrierId:          carrier_id,
      originAddress:      origin,
      destinationAddress: destination,
      serviceType:        req.body.service_type || null,
      client:             tx,
    });

    const row = await shipmentRepo.createShipment(
      {
        tracking_number:    trackingNumber,
        order_id,
        carrier_id,
        origin,
        destination,
        organization_id:    organizationId,
        delivery_scheduled: slaMatch.deliveryScheduled,
        pickup_scheduled:   slaMatch.pickupDeadline,
        sla_policy_id:      slaMatch.policyId,
      },
      tx
    );

    if (!row || !row.id) {
      logger.error('Shipment creation returned empty result', { orderId: order_id });
      throw new Error('Shipment creation failed unexpectedly');
    }

    await shipmentRepo.addTrackingEvent(
      { shipment_id: row.id, event_type: 'created', description: 'Shipment created and pickup scheduled' },
      tx
    );

    await orderRepo.updateStatus(order_id, 'shipped', tx);

    // Deduct stock from inventory and refresh warehouse utilization
    await orderService.commitOrderStock(order_id, tx);

    logger.info('Shipment created successfully', {
      shipmentId: row.id,
      trackingNumber,
      orderId: order_id,
    });

    return row;
  });

  emitToOrg(organizationId, 'shipment:created', shipment);
  emitToShipment(shipment.id, 'shipment:updated', shipment);
  await invalidatePatterns(invalidationTargets(organizationId, 'ship:list', 'orders:list', 'dash', 'analytics'));

  res.status(201).json({
    success: true,
    message: 'Shipment created',
    data: { ...shipment, trackingNumber: shipment.tracking_number }
  });
});

// Update shipment status
export const updateShipmentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, location, notes } = req.body;
  const organizationId = req.orgContext?.organizationId;

  if (!status) throw new ValidationError('status is required');

  logger.info('Shipment status update requested', {
    shipmentId: id,
    newStatus: status,
    location: location || null,
    organizationId,
  });

  await shipmentService.updateStatus(id, status, location, notes, organizationId);

  emitToOrg(organizationId, 'shipment:updated', { id, status, location });
  emitToShipment(id, 'shipment:updated', { id, status, location });
  await invalidatePatterns(invalidationTargets(organizationId, 'ship:list', 'dash', 'analytics'));

  res.json({ success: true, message: `Shipment status updated to '${status}'` });
});

/**
 * Carrier confirms pickup - Method A: Carrier-Only Control
 * Only carrier can mark shipment as in_transit
 * SLA timer starts from this timestamp
 */
export const confirmPickup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const requestedCarrierId = req.authenticatedCarrier?.id || req.user?.carrier_id || req.body.carrierId;

  const data = await shipmentService.confirmPickup(id, req.body, requestedCarrierId);

  res.json({
    success: true,
    message: 'Pickup confirmed. Shipment is now in transit.',
    data,
  });
});

