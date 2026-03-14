import logger from '../utils/logger.js';
import axios from 'axios';
import { withTransaction } from '../utils/dbTransaction.js';
import carrierPayloadBuilder from './carrierPayloadBuilder.js';
import deliveryChargeService from './deliveryChargeService.js';
import { matchSlaPolicyForShipment } from './slaPolicyMatchingService.js';
import { NotFoundError, AppError, AuthorizationError } from '../errors/AppError.js';
import carrierAssignmentRepo from '../repositories/CarrierAssignmentRepository.js';

class CarrierAssignmentService {
  /**
   * Request carrier assignment for an order
   * Finds matching carriers and sends assignment request to them
   */
  async requestCarrierAssignment(orderId, orderData) {
    try {
      logger.info(`Requesting carrier assignment for order ${orderId}`, {
        priority: orderData.priority,
        items: orderData.items?.length
      });

      // Use transaction to ensure atomicity
      const result = await withTransaction(async (tx) => {
        // Get order details
        const order = await carrierAssignmentRepo.findOrderById(orderId, tx);
        if (!order) throw new NotFoundError(`Order ${orderId}`);

        // Get order items with shipping details
        const rawItems = await carrierAssignmentRepo.findOrderItemsWithProducts(orderId, tx);
        const items = rawItems.map(item => ({
          ...item,
          weight: item.weight || item.product_weight || 0,
          dimensions: item.dimensions || item.product_dimensions || { length: 30, width: 20, height: 15 },
          is_fragile: item.is_fragile || item.product_is_fragile || false,
          is_hazardous: item.is_hazardous || item.product_is_hazardous || false
        }));

        // Get warehouse details for pickup address
        const warehouse = await carrierAssignmentRepo.findWarehouseForOrder(orderId, tx);

        // Check if max retry attempts reached (3 batches × 3 carriers = 9 max)
        const triedCount = await carrierAssignmentRepo.countTriedCarriers(orderId, tx);

        if (triedCount >= 9) {
          logger.error(`Order ${orderId} has exhausted all carrier retries`, { triedCount });
          await carrierAssignmentRepo.markOrderOnHold(orderId, tx);
          throw new AppError('Maximum carrier assignment attempts exceeded. Order placed on hold for manual intervention.', 503);
        }

        // Find eligible carriers based on service type and availability
        const serviceType = order.priority || 'standard'; // standard, express, bulk
        const carriers = await carrierAssignmentRepo.findAvailableCarriers(serviceType, tx);
        const carriersResult = { rows: carriers }; // kept for compat with code below

        if (carriersResult.rows.length === 0) {
          logger.warn(`No available carriers for order ${orderId}. Will retry when carriers become available.`, { serviceType, triedCount });
          
          // Don't throw error - keep order in pending_carrier_assignment state
          // Retry service will handle this
          return { assignments: [], carriersToNotify: [], orderId };
        }

        const assignments = [];
        const carriersToNotify = [];

        for (const carrier of carriersResult.rows) {
          // Create assignment record
          const expiresAt = new Date();
          expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minute window per batch

          // Build comprehensive payload using payload builder
          const requestPayload = await carrierPayloadBuilder.buildRequestPayload(
            order,
            items,
            warehouse,
            carrier,
            serviceType
          );

          // Generate idempotency key
          const idempotencyKey = `${orderId}-carrier-${carrier.id}-${Date.now()}`;

          // Store assignment ID in payload
          requestPayload.assignmentId = idempotencyKey;

          // Use proper addresses from payload
          const pickupAddress = requestPayload.pickup.address;
          const deliveryAddress = requestPayload.delivery.address;

          const assignmentResult = await carrierAssignmentRepo.createAssignment({
            orderId,
            carrierId: carrier.id,
            organizationId: order.organization_id || null,
            serviceType,
            pickupAddress,
            deliveryAddress,
            estimatedPickup: new Date(requestPayload.service.estimatedDeliveryDate) || new Date(Date.now() + 2 * 60 * 60 * 1000),
            estimatedDelivery: new Date(requestPayload.service.estimatedDeliveryDate) || new Date(Date.now() + 24 * 60 * 60 * 1000),
            requestPayload,
            expiresAt,
            idempotencyKey
          }, tx);
          const assignment = assignmentResult;
          assignments.push(assignment);

          logger.info(`Created carrier assignment request`, {
            assignmentId: assignment.id,
            carrierId: carrier.id,
            carrierName: carrier.name,
            orderId,
            idempotencyKey
          });

          // Store carrier info for notification after transaction commits
          carriersToNotify.push({ assignment, carrier, requestPayload });
        }

        // Update order status to pending_carrier_assignment
        await carrierAssignmentRepo.updateOrderStatus(orderId, 'pending_carrier_assignment', tx);

        return { assignments, carriersToNotify, orderId };
      });

      // After transaction commits, send notifications to carriers
      // This happens outside transaction because external API calls can't be rolled back
      for (const { assignment, carrier, requestPayload } of result.carriersToNotify) {
        // Fire and forget - don't await
        this.sendAssignmentToCarrier(assignment.id, carrier, requestPayload).catch(err => {
          logger.error('Failed to notify carrier', {
            assignmentId: assignment.id,
            carrierCode: carrier.code,
            error: err.message
          });
        });
      }

      return {
        orderId: result.orderId,
        assignments: result.assignments,
        pendingAcceptance: result.assignments.length,
        message: `Assignment request sent to ${result.assignments.length} carriers. Waiting for acceptance.`
      };
    } catch (error) {
      logger.error('Carrier assignment request failed', {
        orderId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Send assignment notification to carrier
   * In production, this would POST to carrier's webhook URL
   */
  async sendAssignmentToCarrier(assignmentId, carrier, payload) {
    try {
      logger.info(`Sending assignment to carrier: ${carrier.name}`, {
        assignmentId,
        carrierId: carrier.id,
        carrierCode: carrier.code
      });

      // In real production:
      // const webhookUrl = carrier.webhook_url;
      // await axios.post(webhookUrl, payload, { timeout: 5000 });
      
      // For now, we simulate - carrier must poll/refresh to see assignments
    } catch (error) {
      logger.error('Failed to send carrier assignment', {
        assignmentId,
        carrierCode: carrier.code,
        error: error.message
      });
    }
  }

  /**
   * Get pending assignments for a carrier
   * Used by carrier partner portal
   */
  async getPendingAssignments(carrierId, filters = {}) {
    try {
      const rows = await carrierAssignmentRepo.findPendingByCarrier(carrierId, filters);

      const assignments = rows.map(row => ({
        id: row.id,
        orderId: row.order_id,
        carrierId: row.carrier_id,
        serviceType: row.service_type,
        status: row.status,
        orderNumber: row.order_number,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        totalAmount: parseFloat(row.total_amount),
        shippingAddress: row.shipping_address,
        requestedAt: row.requested_at,
        expiresAt: row.expires_at,
        orderData: row.request_payload,
        hoursUntilExpiry: Math.round(
          (new Date(row.expires_at).getTime() - Date.now()) / (1000 * 60 * 60)
        )
      }));

      return assignments;
    } catch (error) {
      logger.error('Failed to get pending assignments', {
        carrierId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Notify carrier of pending assignments when they become available
   * Called when carrier sends "I'm active now" webhook to our system
   */
  async notifyCarrierOfPendingAssignments(carrierCode) {
    try {
      // Get carrier by code
      const carrier = await carrierAssignmentRepo.findCarrierByCode(carrierCode);
      if (!carrier) throw new NotFoundError(`Carrier '${carrierCode}'`);
      
      // Update carrier availability status
      await carrierAssignmentRepo.setCarrierAvailable(carrier.id);
      
      // Get all pending assignments for this carrier
      const assignments = await this.getPendingAssignments(carrier.id, { status: 'pending' });
      
      logger.info(`Carrier ${carrierCode} is now active with ${assignments.length} pending assignments`);
      
      // In real production: POST each assignment to carrier's webhook
      // For simulation: carrier will see them when they open portal/refresh
      
      return {
        success: true,
        carrierCode,
        pendingCount: assignments.length,
        message: `You have ${assignments.length} pending assignment${assignments.length !== 1 ? 's' : ''}`
      };
    } catch (error) {
      logger.error('Failed to notify carrier of pending assignments', {
        carrierCode,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Accept an assignment as a bid response.
   * Shipment is created only after bidding window closure / finalization.
   */
  async acceptAssignment(assignmentId, carrierId, acceptanceData = {}) {
    try {
      const result = await withTransaction(async (tx) => {
        // Get assignment with complete order data
        logger.debug('Querying assignment for acceptance', { assignmentId, carrierId });
        
        const assignment = await carrierAssignmentRepo.findForAcceptance(assignmentId, carrierId, tx);

        logger.debug('Assignment query result', { 
          found: !!assignment,
          assignment: assignment || null 
        });

        if (!assignment) {
          // Query to see if assignment exists with different carrier
          const actualAssignment = await carrierAssignmentRepo.findByIdWithCarrier(assignmentId, tx);
          
          if (actualAssignment) {
            logger.error('Assignment exists but belongs to different carrier', {
              requestedCarrierId: carrierId,
              actualCarrierId: actualAssignment.carrier_id,
              actualCarrierName: actualAssignment.carrier_name,
              assignmentStatus: actualAssignment.status
            });
            throw new AuthorizationError(`Assignment belongs to ${actualAssignment.carrier_name} (not your carrier)`);
          }
          
          throw new NotFoundError('Assignment');
        }

        // Parse and validate acceptance payload
        const acceptancePayload = carrierPayloadBuilder.parseAcceptancePayload(acceptanceData);

        const updatedAssignment = await carrierAssignmentRepo.acceptAssignment(
          assignmentId,
          acceptancePayload.tracking.carrierReferenceId,
          acceptancePayload.tracking.trackingNumber,
          acceptancePayload,
          tx
        );

        if (!updatedAssignment) {
          throw new AppError('Assignment is no longer available (already accepted or cancelled)', 409);
        }

        return {
          updatedAssignment,
          orderId: assignment.order_id,
        };
      });

      const finalization = await this.tryFinalizeBiddingWindow(result.orderId);

      logger.info('Assignment accepted during bidding window', {
        assignmentId,
        orderId: result.orderId,
        finalized: finalization.finalized,
        carrierId
      });

      if (finalization.finalized) {
        return {
          assignment: result.updatedAssignment,
          shipment: finalization.shipment,
          message: 'Assignment accepted and bidding finalized. Shipment created successfully.',
        };
      }

      return {
        assignment: result.updatedAssignment,
        message: 'Assignment accepted. Waiting for bidding window closure before shipment creation.',
        biddingWindow: {
          finalized: false,
          openAssignments: finalization.openAssignments ?? null,
        },
      };
    } catch (error) {
      logger.error('Failed to accept assignment', {
        assignmentId,
        carrierId,
        error: error.message
      });
      throw error;
    }
  }

  async tryFinalizeBiddingWindow(orderId) {
    return withTransaction(async (tx) => {
      const existingShipment = await carrierAssignmentRepo.findShipmentByOrderId(orderId, tx);
      if (existingShipment) {
        return { finalized: false, alreadyFinalized: true, shipment: existingShipment };
      }

      const openAssignments = await carrierAssignmentRepo.countOpenWindowAssignments(orderId, tx);
      if (openAssignments > 0) {
        return { finalized: false, openAssignments };
      }

      const acceptedAssignments = await carrierAssignmentRepo.findAcceptedAssignmentsByOrder(orderId, tx);
      if (acceptedAssignments.length === 0) {
        return { finalized: false, noAcceptedBids: true };
      }

      const winner = this._selectBestAcceptedAssignment(acceptedAssignments);

      await carrierAssignmentRepo.markWinnerAndCloseOrderWindow(orderId, winner.id, tx);
      const shipment = await this._createShipmentFromAcceptedAssignment(winner, tx);

      logger.info('Bidding window finalized', {
        orderId,
        winnerAssignmentId: winner.id,
        winnerCarrierId: winner.carrier_id,
        score: winner._selectionScore,
      });

      return {
        finalized: true,
        winnerAssignmentId: winner.id,
        shipment: {
          id: shipment.id,
          trackingNumber: shipment.tracking_number,
          status: shipment.status,
          createdAt: shipment.created_at,
        },
      };
    });
  }

  async finalizeReadyBiddingWindows() {
    const readyOrders = await carrierAssignmentRepo.findOrdersReadyForBiddingFinalization();
    let finalizedCount = 0;

    for (const orderId of readyOrders) {
      try {
        const result = await this.tryFinalizeBiddingWindow(orderId);
        if (result.finalized) finalizedCount += 1;
      } catch (error) {
        logger.error('Failed to finalize bidding window', { orderId, error: error.message });
      }
    }

    return finalizedCount;
  }

  /**
   * Reject an assignment
   */
  async rejectAssignment(assignmentId, carrierId, reason) {
    try {
      const row = await carrierAssignmentRepo.rejectAssignment(assignmentId, carrierId, reason);

      if (!row) {
        throw new NotFoundError('Assignment');
      }

      logger.info('Assignment rejected', {
        assignmentId,
        carrierId,
        reason
      });

      // If this was the last open response, finalize immediately.
      await this.tryFinalizeBiddingWindow(row.order_id);

      return {
        assignment: row,
        message: 'Assignment rejected. Will reassign to another carrier.'
      };
    } catch (error) {
      logger.error('Failed to reject assignment', {
        assignmentId,
        carrierId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check for expired assignments and reassign
   */
  async handleExpiredAssignments() {
    try {
      // Find expired pending assignments
      const expiredRows = await carrierAssignmentRepo.findExpiredPending();

      logger.info(`Found ${expiredRows.length} expired assignments`);

      for (const expired of expiredRows) {
        // Mark as cancelled
        await carrierAssignmentRepo.cancelById(expired.id);

        // Try to reassign
        const order = await carrierAssignmentRepo.findOrderWithItems(expired.order_id);

        if (order) {
          logger.info(`Reassigning expired assignment for order ${expired.order_id}`);
          // Recursively request new assignment
          await this.requestCarrierAssignment(expired.order_id, { items: order.items });
        }
      }

      return expiredRows.length;
    } catch (error) {
      logger.error('Failed to handle expired assignments', {
        error: error.message
      });
    }
  }

  /**
   * Helper: Get most restrictive item type from a list
   * Priority: hazardous > valuable > perishable > electronics > fragile > documents > general
   */
  _getMostRestrictiveItemType(types) {
    const priority = {
      'hazardous': 7,
      'valuable': 6,
      'perishable': 5,
      'electronics': 4,
      'fragile': 3,
      'documents': 2,
      'general': 1
    };

    let mostRestrictive = 'general';
    let highestPriority = 0;

    types.forEach(type => {
      const p = priority[type] || 0;
      if (p > highestPriority) {
        highestPriority = p;
        mostRestrictive = type;
      }
    });

    return mostRestrictive;
  }

  /**
   * Helper: Get most common package type from a list
   */
  _getMostCommonPackageType(types) {
    if (!types || types.length === 0) return 'box';
    
    const counts = {};
    types.forEach(type => {
      counts[type] = (counts[type] || 0) + 1;
    });

    let mostCommon = 'box';
    let highestCount = 0;

    Object.entries(counts).forEach(([type, count]) => {
      if (count > highestCount) {
        highestCount = count;
        mostCommon = type;
      }
    });

    return mostCommon;
  }

  /**
   * Helper: Aggregate dimensions from multiple items
   * Returns the largest single item dimensions (for simplicity)
   * In production, this could be more sophisticated (stacking, bin packing, etc.)
   */
  _aggregateDimensions(dimensionsArray) {
    if (!dimensionsArray || dimensionsArray.length === 0) {
      return { length: 0, width: 0, height: 0 };
    }

    let largest = { length: 0, width: 0, height: 0 };
    let largestVolume = 0;

    dimensionsArray.forEach(dim => {
      if (dim && typeof dim === 'object') {
        const volume = (dim.length || 0) * (dim.width || 0) * (dim.height || 0);
        if (volume > largestVolume) {
          largestVolume = volume;
          largest = {
            length: dim.length || 0,
            width: dim.width || 0,
            height: dim.height || 0
          };
        }
      }
    });

    return largest;
  }

  _selectBestAcceptedAssignment(assignments) {
    const enriched = assignments.map((a) => {
      const payload = typeof a.acceptance_payload === 'string'
        ? JSON.parse(a.acceptance_payload)
        : (a.acceptance_payload || {});

      const quotedPrice = Number(payload?.pricing?.quotedPrice ?? 0);
      const promisedTs = payload?.delivery?.estimatedDeliveryTime || payload?.delivery?.estimatedDeliveryDate || null;
      const promisedDate = promisedTs ? new Date(promisedTs) : null;
      const etaHours = promisedDate && !Number.isNaN(promisedDate.getTime())
        ? Math.max((promisedDate.getTime() - Date.now()) / (1000 * 60 * 60), 1)
        : 72;

      return {
        ...a,
        _quotedPrice: quotedPrice,
        _etaHours: etaHours,
        _reliability: Number(a.reliability_score || 0.8),
      };
    });

    const minPrice = Math.min(...enriched.map(e => e._quotedPrice));
    const maxPrice = Math.max(...enriched.map(e => e._quotedPrice));
    const minEta = Math.min(...enriched.map(e => e._etaHours));
    const maxEta = Math.max(...enriched.map(e => e._etaHours));

    const normalizeDescending = (value, min, max) => {
      if (max === min) return 1;
      return 1 - ((value - min) / (max - min));
    };

    for (const item of enriched) {
      const priceScore = normalizeDescending(item._quotedPrice, minPrice, maxPrice);
      const etaScore = normalizeDescending(item._etaHours, minEta, maxEta);
      const reliabilityScore = Math.max(0, Math.min(item._reliability, 1));
      item._selectionScore = (0.5 * priceScore) + (0.3 * etaScore) + (0.2 * reliabilityScore);
    }

    enriched.sort((a, b) => b._selectionScore - a._selectionScore);
    return enriched[0];
  }

  async _createShipmentFromAcceptedAssignment(assignment, tx) {
    const acceptancePayload = typeof assignment.acceptance_payload === 'string'
      ? JSON.parse(assignment.acceptance_payload)
      : (assignment.acceptance_payload || {});

    const trackingNumber = acceptancePayload?.tracking?.trackingNumber ||
      assignment.carrier_tracking_number ||
      `TRACK-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const items = await carrierAssignmentRepo.findOrderItemsForShipment(assignment.order_id, tx);
    const aggregatedData = {
      totalItems: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
      totalWeight: items.reduce((sum, item) => sum + ((item.weight || 0) * (item.quantity || 1)), 0),
      totalVolumetricWeight: items.reduce((sum, item) => sum + ((item.volumetric_weight || 0) * (item.quantity || 1)), 0),
      totalDeclaredValue: items.reduce((sum, item) => sum + (item.declared_value || 0), 0),
      packageCount: items.length,
      isFragile: items.some(item => item.is_fragile),
      isHazardous: items.some(item => item.is_hazardous),
      isPerishable: items.some(item => item.is_perishable),
      requiresColdStorage: items.some(item => item.requires_cold_storage),
      requiresInsurance: items.some(item => item.requires_insurance),
      itemType: this._getMostRestrictiveItemType(items.map(i => i.item_type)),
      packageType: this._getMostCommonPackageType(items.map(i => i.package_type)),
      handlingInstructions: items.filter(i => i.handling_instructions).map(i => i.handling_instructions).join('; '),
      dimensions: this._aggregateDimensions(items.map(i => i.dimensions)),
    };

    const requestPayload = typeof assignment.request_payload === 'string'
      ? JSON.parse(assignment.request_payload)
      : assignment.request_payload;
    const shipmentWeight = requestPayload?.shipment?.chargeableWeight ||
      Math.max(aggregatedData.totalWeight, aggregatedData.totalVolumetricWeight);

    const slaMatch = await matchSlaPolicyForShipment({
      organizationId: assignment.organization_id,
      carrierId: assignment.carrier_id,
      originAddress: assignment.pickup_address,
      destinationAddress: assignment.delivery_address,
      serviceType: assignment.service_type || null,
      client: tx,
    });

    const promisedTs = acceptancePayload?.delivery?.estimatedDeliveryTime || acceptancePayload?.delivery?.estimatedDeliveryDate;
    const carrierPromised = promisedTs ? new Date(promisedTs) : null;
    const slaDeadline = slaMatch.deliveryScheduled;
    const deliveryScheduled = (carrierPromised && carrierPromised < slaDeadline) ? carrierPromised : slaDeadline;

    const shipment = await carrierAssignmentRepo.createShipment({
      trackingNumber,
      carrierTrackingNumber: acceptancePayload?.tracking?.carrierReferenceId || assignment.carrier_reference_id,
      orderId: assignment.order_id,
      assignmentId: assignment.id,
      carrierId: assignment.carrier_id,
      warehouseId: items[0]?.warehouse_id || null,
      organizationId: assignment.organization_id,
      pickupAddress: assignment.pickup_address,
      deliveryAddress: assignment.delivery_address,
      deliveryScheduled,
      pickupScheduled: slaMatch.pickupDeadline,
      slaPolicyId: slaMatch.policyId,
      weight: shipmentWeight,
      volumetricWeight: aggregatedData.totalVolumetricWeight,
      dimensions: aggregatedData.dimensions,
      packageCount: aggregatedData.packageCount,
      totalItems: aggregatedData.totalItems,
      shippingCost: acceptancePayload?.pricing?.quotedPrice || 0,
      codAmount: assignment.is_cod ? assignment.total_amount : 0,
      isFragile: aggregatedData.isFragile,
      isHazardous: aggregatedData.isHazardous,
      isPerishable: aggregatedData.isPerishable,
      requiresColdStorage: aggregatedData.requiresColdStorage,
      itemType: aggregatedData.itemType,
      packageType: aggregatedData.packageType,
      handlingInstructions: aggregatedData.handlingInstructions || null,
      requiresInsurance: aggregatedData.requiresInsurance,
      declaredValue: aggregatedData.totalDeclaredValue,
    }, tx);

    await carrierAssignmentRepo.insertShipmentCreatedEvent(shipment.id, tx);
    await carrierAssignmentRepo.updateOrderCarrier(assignment.order_id, 'ready_to_ship', assignment.carrier_id, tx);

    return shipment;
  }
}

export default new CarrierAssignmentService();
