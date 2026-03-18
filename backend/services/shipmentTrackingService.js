import axios from 'axios';
import logger from '../utils/logger.js';
import { withTransaction } from '../utils/dbTransaction.js';
import { NotFoundError } from '../errors/AppError.js';
import shipmentRepo from '../repositories/ShipmentRepository.js';

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

        return updatedShipment;
      });

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
