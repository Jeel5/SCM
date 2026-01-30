import pool from '../configs/db.js';
import shipmentTrackingService from '../services/shipmentTrackingService.js';
import logger from '../utils/logger.js';

// ========== SHIPMENT TRACKING ==========

/**
 * Get shipment details with tracking history
 * GET /api/shipments/{trackingNumber}/details
 */
export async function getShipmentDetails(req, res) {
  try {
    const { trackingNumber } = req.params;

    // Find shipment by tracking number
    const result = await pool.query(
      'SELECT id FROM shipments WHERE tracking_number = $1',
      [trackingNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const shipmentDetails = await shipmentTrackingService.getShipmentDetails(
      result.rows[0].id
    );

    res.json({ success: true, data: shipmentDetails });
  } catch (error) {
    logger.error('Get shipment details error:', error);
    res.status(500).json({ error: 'Failed to get shipment details' });
  }
}

/**
 * Update shipment with tracking event (from carrier webhook)
 * POST /api/shipments/{trackingNumber}/update-tracking
 */
export async function updateShipmentTracking(req, res) {
  try {
    const { trackingNumber } = req.params;
    const { eventType, location, description } = req.body;

    if (!eventType) {
      return res.status(400).json({ error: 'eventType required' });
    }

    // Find shipment by tracking number
    const result = await pool.query(
      'SELECT id FROM shipments WHERE tracking_number = $1',
      [trackingNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const shipmentId = result.rows[0].id;

    const trackingEvent = {
      eventType,
      location: location || null,
      description: description || ''
    };

    const updatedShipment = await shipmentTrackingService.updateShipmentTracking(
      shipmentId,
      trackingEvent
    );

    res.json({
      success: true,
      data: {
        trackingNumber,
        status: updatedShipment.status,
        currentLocation: updatedShipment.current_location,
        message: 'Tracking updated successfully'
      }
    });
  } catch (error) {
    logger.error('Update shipment tracking error:', error);
    res.status(500).json({ error: 'Failed to update tracking' });
  }
}

/**
 * Calculate and update route for shipment
 * POST /api/shipments/{trackingNumber}/calculate-route
 */
export async function calculateRoute(req, res) {
  try {
    const { trackingNumber } = req.params;

    // Get shipment
    const result = await pool.query(
      `SELECT id, origin_address, destination_address FROM shipments 
       WHERE tracking_number = $1`,
      [trackingNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const shipment = result.rows[0];
    const route = await shipmentTrackingService.calculateRoute(
      shipment.origin_address,
      shipment.destination_address
    );

    if (!route) {
      return res.status(400).json({ error: 'Could not calculate route' });
    }

    // Update shipment with route geometry
    const updateResult = await pool.query(
      `UPDATE shipments 
       SET route_geometry = $1, updated_at = NOW()
       WHERE tracking_number = $2
       RETURNING *`,
      [JSON.stringify(route.geometry), trackingNumber]
    );

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
  } catch (error) {
    logger.error('Calculate route error:', error);
    res.status(500).json({ error: 'Failed to calculate route' });
  }
}

/**
 * Simulate tracking update (for testing/demonstration)
 * POST /api/shipments/{trackingNumber}/simulate-update
 */
export async function simulateTrackingUpdate(req, res) {
  try {
    const { trackingNumber } = req.params;
    const { status, location, description } = req.body;

    // Find shipment
    const result = await pool.query(
      'SELECT id FROM shipments WHERE tracking_number = $1',
      [trackingNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const updatedShipment = await shipmentTrackingService.simulateCarrierUpdate(
      result.rows[0].id,
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
  } catch (error) {
    logger.error('Simulate tracking update error:', error);
    res.status(500).json({ error: 'Failed to simulate tracking' });
  }
}

/**
 * Get shipment tracking events timeline
 * GET /api/shipments/{trackingNumber}/timeline
 */
export async function getTrackingTimeline(req, res) {
  try {
    const { trackingNumber } = req.params;

    const result = await pool.query(
      `SELECT se.id, se.event_type, se.location, se.description, se.event_timestamp,
              s.tracking_number, s.status
       FROM shipment_events se
       JOIN shipments s ON se.shipment_id = s.id
       WHERE s.tracking_number = $1
       ORDER BY se.event_timestamp ASC`,
      [trackingNumber]
    );

    const events = result.rows.map(row => ({
      id: row.id,
      eventType: row.event_type,
      location: row.location,
      description: row.description,
      timestamp: row.event_timestamp
    }));

    res.json({ success: true, data: events });
  } catch (error) {
    logger.error('Get tracking timeline error:', error);
    res.status(500).json({ error: 'Failed to get tracking timeline' });
  }
}
