import axios from 'axios';
import logger from '../utils/logger.js';
import { withTransaction } from '../utils/dbTransaction.js';
import { NotFoundError } from '../errors/AppError.js';
import shipmentRepo from '../repositories/ShipmentRepository.js';
import slaRepository from '../repositories/SlaRepository.js';

const OSRM_URL = process.env.OSRM_API_URL || 'http://router.project-osrm.org';

function parseJsonField(value, fallback) {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  return value;
}

class ShipmentTrackingService {
  /**
   * Calculate route between two addresses using OSRM
   * Returns route geometry for Maplibre visualization
   */
  async calculateRoute(originAddress, destinationAddress) {
    try {
      // Extract coordinates from addresses
      const originCoords = originAddress.coordinates || { lat: 40.7128, lng: -74.0060 };
      const destCoords = destinationAddress.coordinates || { lat: 34.0522, lng: -118.2437 };

      const url = `${OSRM_URL}/route/v1/driving/${originCoords.lng},${originCoords.lat};${destCoords.lng},${destCoords.lat}`;

      const response = await axios.get(url, {
        params: {
          overview: 'full',
          geometries: 'geojson',
          steps: true,
          annotations: 'duration,distance'
        }
      });

      if (response.data.routes && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        return {
          geometry: route.geometry,
          distance: route.distance,
          duration: route.duration,
          waypoints: route.waypoints
        };
      }

      return null;
    } catch (error) {
      logger.error('Route calculation failed', {
        origin: originAddress,
        destination: destinationAddress,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Update shipment with tracking event
   * Called when carrier sends tracking webhook
   */
  async updateShipmentTracking(shipmentId, trackingEvent) {
    try {
      const result = await withTransaction(async (tx) => {
        // Get current shipment
        const shipment = await shipmentRepo.findById(shipmentId, tx);
        if (!shipment) throw new NotFoundError('Shipment');

        const trackingEvents = parseJsonField(shipment.tracking_events, []);

        // Add new event with timestamp
        const newEvent = {
          ...trackingEvent,
          timestamp: new Date(),
          id: `EVT-${Date.now()}`
        };

        trackingEvents.push(newEvent);

        // Update shipment status based on event type
        let newStatus = shipment.status;
        switch (trackingEvent.eventType) {
          case 'picked_up':
            newStatus = 'picked_up';
            break;
          case 'in_transit':
            newStatus = 'in_transit';
            break;
          case 'out_for_delivery':
            newStatus = 'out_for_delivery';
            break;
          case 'delivered':
            newStatus = 'delivered';
            break;
          case 'exception':
          case 'failed_delivery':
            // DB allows failed_delivery as the shipment exception-equivalent status.
            newStatus = 'failed_delivery';
            break;
        }

        // If location provided, update current location
        let currentLocation = shipment.current_location;
        if (trackingEvent.location) {
          currentLocation = JSON.stringify(trackingEvent.location);
        }

        // Update shipment
        const updatedShipment = await shipmentRepo.updateTracking(
          shipmentId, newStatus, JSON.stringify(trackingEvents), currentLocation, tx
        );

        // Create shipment event record
        await shipmentRepo.addTrackingEvent({
          shipment_id: shipmentId,
          event_type: trackingEvent.eventType,
          location: trackingEvent.location || null,
          description: trackingEvent.description || '',
          event_timestamp: new Date(trackingEvent.timestamp || Date.now())
        }, tx);

        // If delivered, update order status
        if (newStatus === 'delivered') {
          await shipmentRepo.markOrderDeliveredByShipmentId(shipmentId, tx);
        }

        let createdException = null;
        if (newStatus === 'failed_delivery') {
          const exceptionInsert = await shipmentRepo.query(
            `INSERT INTO exceptions (
               organization_id, shipment_id, order_id, exception_type, severity, status, title, description, created_at, updated_at
             )
             SELECT $1, $2, $3, 'delivery_failed', 'high', 'open', $4, $5, NOW(), NOW()
             WHERE NOT EXISTS (
               SELECT 1
               FROM exceptions e
               WHERE e.shipment_id = $2
                 AND e.exception_type = 'delivery_failed'
                 AND e.status IN ('open', 'acknowledged', 'investigating', 'pending_resolution', 'escalated')
             )
             RETURNING *`,
            [
              shipment.organization_id || null,
              shipmentId,
              shipment.order_id || null,
              'Delivery failed',
              trackingEvent.description || 'Delivery attempt failed',
            ],
            tx
          );
          createdException = exceptionInsert.rows[0] || null;
        }

        return {
          ...updatedShipment,
          created_exception: createdException,
        };
      });

      await this.persistEtaPrediction(result, trackingEvent);

      logger.info('Shipment tracking updated', { shipmentId, status: result.status });

      return result;
    } catch (error) {
      logger.error('Failed to update shipment tracking', {
        shipmentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Build a simple, rule-based ETA prediction from shipment status and schedule.
   */
  buildEtaPrediction(shipment, trackingEvent, latestPrediction = null) {
    const now = new Date();
    const scheduledDelivery = shipment.delivery_scheduled ? new Date(shipment.delivery_scheduled) : null;
    let predictedDelivery = scheduledDelivery ? new Date(scheduledDelivery) : new Date(now.getTime() + (24 * 60 * 60 * 1000));
    let confidenceScore = 0.65;
    let delayRiskScore = 'medium';

    const normalizedStatus = trackingEvent?.eventType || shipment.status;

    if (trackingEvent?.estimatedArrival) {
      const estimated = new Date(trackingEvent.estimatedArrival);
      if (!Number.isNaN(estimated.getTime())) {
        predictedDelivery = estimated;
        confidenceScore = Math.max(confidenceScore, 0.75);
      }
    }

    switch (normalizedStatus) {
      case 'picked_up':
        confidenceScore = Math.max(confidenceScore, 0.68);
        delayRiskScore = 'medium';
        break;
      case 'in_transit':
        confidenceScore = Math.max(confidenceScore, 0.74);
        delayRiskScore = 'medium';
        break;
      case 'out_for_delivery':
        predictedDelivery = new Date(Math.min(
          (scheduledDelivery ? scheduledDelivery.getTime() : now.getTime() + (6 * 60 * 60 * 1000)),
          now.getTime() + (8 * 60 * 60 * 1000)
        ));
        confidenceScore = Math.max(confidenceScore, 0.88);
        delayRiskScore = 'low';
        break;
      case 'failed_delivery':
        predictedDelivery = new Date(now.getTime() + (24 * 60 * 60 * 1000));
        confidenceScore = 0.45;
        delayRiskScore = 'high';
        break;
      case 'delivered':
        predictedDelivery = shipment.delivery_actual ? new Date(shipment.delivery_actual) : now;
        confidenceScore = 1;
        delayRiskScore = 'low';
        break;
      default:
        break;
    }

    if (scheduledDelivery && predictedDelivery > scheduledDelivery) {
      delayRiskScore = 'high';
    }

    let predictionAccuracyHours = null;
    const actualDelivery = shipment.delivery_actual ? new Date(shipment.delivery_actual) : null;
    if (actualDelivery && latestPrediction?.predicted_delivery) {
      const previousEta = new Date(latestPrediction.predicted_delivery);
      const diffMs = Math.abs(actualDelivery.getTime() - previousEta.getTime());
      predictionAccuracyHours = Number((diffMs / (60 * 60 * 1000)).toFixed(2));
    }

    return {
      predictedDelivery,
      confidenceScore,
      delayRiskScore,
      factors: {
        status: normalizedStatus,
        eventType: trackingEvent?.eventType || null,
        hasSchedule: Boolean(scheduledDelivery),
        scheduledDelivery,
      },
      actualDelivery,
      predictionAccuracyHours,
      modelVersion: 'rule-based-v1',
    };
  }

  /**
   * Persist an ETA prediction snapshot; non-blocking for tracking updates.
   */
  async persistEtaPrediction(shipment, trackingEvent) {
    try {
      const latestPrediction = await slaRepository.findLatestEta(
        shipment.id,
        shipment.organization_id || null
      );

      const prediction = this.buildEtaPrediction(shipment, trackingEvent, latestPrediction);
      await slaRepository.createEtaPrediction({
        shipmentId: shipment.id,
        ...prediction,
      });
    } catch (etaError) {
      logger.warn('Failed to persist ETA prediction for tracking update', {
        shipmentId: shipment.id,
        error: etaError.message,
      });
    }
  }

  /**
   * Get shipment details with tracking history
   */
  async getShipmentDetails(shipmentId) {
    try {
      const row = await shipmentRepo.findWithCarrierAndWarehouse(shipmentId);
      if (!row) return null;

      return {
        id: row.id,
        trackingNumber: row.tracking_number,
        orderId: row.order_id,
        orderNumber: row.order_number,
        carrierId: row.carrier_id,
        carrierCode: row.carrier_code,
        carrierName: row.carrier_name,
        warehouseName: row.warehouse_name,
        status: row.status,
        originAddress: row.origin_address,
        destinationAddress: row.destination_address,
        currentLocation: row.current_location,
        routeGeometry: row.route_geometry,
        weight: row.weight,
        shippingCost: row.shipping_cost,
        pickupScheduled: row.pickup_scheduled,
        pickupActual: row.pickup_actual,
        deliveryScheduled: row.delivery_scheduled,
        deliveryActual: row.delivery_actual,
        trackingEvents: parseJsonField(row.tracking_events, []),
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      logger.error('Failed to get shipment details', {
        shipmentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Simulate tracking update from carrier webhook
   * In production, this would be called from actual carrier APIs
   */
  async simulateCarrierUpdate(shipmentId, status, location, description) {
    try {
      const trackingEvent = {
        eventType: status,
        location: location || {
          lat: 40.7128 + Math.random() * 0.1,
          lng: -74.0060 + Math.random() * 0.1,
          city: 'Mumbai',
          state: 'NY'
        },
        description: description || `Shipment ${status.replace('_', ' ')}`
      };

      return await this.updateShipmentTracking(shipmentId, trackingEvent);
    } catch (error) {
      logger.error('Failed to simulate carrier update', {
        shipmentId,
        error: error.message
      });
      throw error;
    }
  }
}

export default new ShipmentTrackingService();
