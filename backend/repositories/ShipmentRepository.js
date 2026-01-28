// Shipment Repository - handles shipment tracking and status updates
import BaseRepository from './BaseRepository.js';

class ShipmentRepository extends BaseRepository {
  constructor() {
    super('shipments');
  }

  // Get shipments with pagination and filters (status, carrier, search)
  async findShipments({ page = 1, limit = 20, status = null, carrier_id = null, search = null }, client = null) {
    const offset = (page - 1) * limit;
    const params = [];
    let paramCount = 1;
    
    let query = `
      SELECT s.*,
        COUNT(*) OVER() as total_count
      FROM shipments s
      WHERE 1=1
    `;

    if (status) {
      query += ` AND s.status = $${paramCount++}`;
      params.push(status);
    }

    if (carrier_id) {
      query += ` AND s.carrier_id = $${paramCount++}`;
      params.push(carrier_id);
    }

    if (search) {
      query += ` AND (
        s.tracking_number ILIKE $${paramCount} OR
        s.carrier_name ILIKE $${paramCount} OR
        s.order_id::text ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY s.created_at DESC`;
    query += ` LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    
    return {
      shipments: result.rows,
      totalCount: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0
    };
  }

  /**
   * Find shipment by tracking number
   */
  async findByTrackingNumber(trackingNumber, client = null) {
    const query = `SELECT * FROM shipments WHERE tracking_number = $1`;
    const result = await this.query(query, [trackingNumber], client);
    return result.rows[0] || null;
  }

  /**
   * Find shipments by order ID
   */
  async findByOrderId(orderId, client = null) {
    const query = `
      SELECT * FROM shipments 
      WHERE order_id = $1 
      ORDER BY created_at DESC
    `;
    const result = await this.query(query, [orderId], client);
    return result.rows;
  }

  /**
   * Update shipment status
   */
  async updateStatus(shipmentId, status, location = null, client = null) {
    const params = [status];
    let paramCount = 2;
    
    let query = `
      UPDATE shipments
      SET status = $1, updated_at = NOW()
    `;

    if (status === 'delivered') {
      query += `, actual_delivery = NOW()`;
    }

    if (location) {
      query += `, current_location = $${paramCount++}`;
      params.push(JSON.stringify(location));
    }

    query += ` WHERE id = $${paramCount} RETURNING *`;
    params.push(shipmentId);

    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  /**
   * Get shipment tracking events
   */
  async findTrackingEvents(shipmentId, client = null) {
    const query = `
      SELECT * FROM shipment_tracking 
      WHERE shipment_id = $1 
      ORDER BY event_time DESC
    `;
    const result = await this.query(query, [shipmentId], client);
    return result.rows;
  }

  /**
   * Add tracking event
   */
  async addTrackingEvent(eventData, client = null) {
    const query = `
      INSERT INTO shipment_tracking 
      (shipment_id, status, location, event_time, description, carrier_status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const params = [
      eventData.shipment_id,
      eventData.status,
      JSON.stringify(eventData.location || {}),
      eventData.event_time || new Date(),
      eventData.description || null,
      eventData.carrier_status || null
    ];

    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  /**
   * Get shipments by status
   */
  async findByStatus(status, limit = 100, client = null) {
    const query = `
      SELECT * FROM shipments 
      WHERE status = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await this.query(query, [status, limit], client);
    return result.rows;
  }

  /**
   * Get delayed shipments
   */
  async findDelayed(client = null) {
    const query = `
      SELECT * FROM shipments 
      WHERE status NOT IN ('delivered', 'failed', 'returned')
        AND estimated_delivery < NOW()
      ORDER BY estimated_delivery ASC
    `;
    const result = await this.query(query, [], client);
    return result.rows;
  }

  /**
   * Get shipment statistics
   */
  async getShipmentStats(dateFrom = null, dateTo = null, client = null) {
    const params = [];
    let paramCount = 1;
    
    let query = `
      SELECT 
        COUNT(*) as total_shipments,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered_shipments,
        COUNT(*) FILTER (WHERE status = 'in_transit') as in_transit_shipments,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_shipments,
        AVG(EXTRACT(EPOCH FROM (actual_delivery - created_at))/86400) 
          FILTER (WHERE actual_delivery IS NOT NULL) as avg_delivery_days,
        SUM(cost) as total_shipping_cost
      FROM shipments
      WHERE 1=1
    `;

    if (dateFrom) {
      query += ` AND created_at >= $${paramCount++}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ` AND created_at <= $${paramCount++}`;
      params.push(dateTo);
    }

    const result = await this.query(query, params, client);
    return result.rows[0];
  }

  /**
   * Get carrier performance
   */
  async getCarrierPerformance(dateFrom = null, dateTo = null, client = null) {
    const params = [];
    let paramCount = 1;
    
    let query = `
      SELECT 
        carrier_id,
        carrier_name,
        COUNT(*) as total_shipments,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
        AVG(EXTRACT(EPOCH FROM (actual_delivery - created_at))/86400) 
          FILTER (WHERE actual_delivery IS NOT NULL) as avg_delivery_days,
        SUM(cost) as total_cost
      FROM shipments
      WHERE 1=1
    `;

    if (dateFrom) {
      query += ` AND created_at >= $${paramCount++}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ` AND created_at <= $${paramCount++}`;
      params.push(dateTo);
    }

    query += ` GROUP BY carrier_id, carrier_name ORDER BY total_shipments DESC`;

    const result = await this.query(query, params, client);
    return result.rows;
  }
}

export default new ShipmentRepository();
