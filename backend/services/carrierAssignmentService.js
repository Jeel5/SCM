import pool from '../configs/db.js';
import logger from '../utils/logger.js';
import axios from 'axios';

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

      // Get order details
      const orderResult = await pool.query(
        `SELECT id, customer_name, customer_email, customer_phone, priority, 
                status, shipping_address, total_amount, created_at
         FROM orders WHERE id = $1`,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        throw new Error(`Order ${orderId} not found`);
      }

      const order = orderResult.rows[0];

      // Find eligible carriers based on service type
      const serviceType = order.priority || 'standard'; // standard, express, bulk
      const carriersResult = await pool.query(
        `SELECT id, code, name, contact_email, service_type, is_active
         FROM carriers 
         WHERE is_active = true 
         AND (service_type = $1 OR service_type = 'all')
         ORDER BY reliability_score DESC
         LIMIT 3`,
        [serviceType]
      );

      if (carriersResult.rows.length === 0) {
        throw new Error(`No available carriers for service type: ${serviceType}`);
      }

      const assignments = [];

      for (const carrier of carriersResult.rows) {
        // Create assignment record
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour window for acceptance

        const requestPayload = {
          orderId,
          orderNumber: order.order_number,
          customerName: order.customer_name,
          customerEmail: order.customer_email,
          customerPhone: order.customer_phone,
          serviceType,
          totalAmount: parseFloat(order.total_amount),
          shippingAddress: order.shipping_address,
          items: orderData.items || [],
          requestedAt: new Date()
        };

        const assignmentResult = await pool.query(
          `INSERT INTO carrier_assignments 
           (order_id, carrier_id, service_type, status, pickup_address, delivery_address,
            estimated_pickup, estimated_delivery, request_payload, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, carrier_id, order_id, status, created_at`,
          [
            orderId,
            carrier.id,
            serviceType,
            'pending',
            order.shipping_address, // Using this as pickup (from warehouse)
            order.shipping_address, // Using this as delivery
            new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
            new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
            JSON.stringify(requestPayload),
            expiresAt
          ]
        );

        const assignment = assignmentResult.rows[0];
        assignments.push(assignment);

        logger.info(`Created carrier assignment request`, {
          assignmentId: assignment.id,
          carrierId: carrier.id,
          carrierName: carrier.name,
          orderId
        });

        // Simulate sending assignment request to carrier's webhook
        // In real system, this would call carrier's API endpoint
        this.sendAssignmentThancarrier(assignment.id, carrier, requestPayload);
      }

      return {
        orderId,
        assignments,
        pendingAcceptance: assignments.length,
        message: `Assignment request sent to ${assignments.length} carriers. Waiting for acceptance.`
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
      let query = `
        SELECT 
          ca.id, ca.order_id, ca.carrier_id, ca.service_type, ca.status,
          ca.request_payload, ca.requested_at, ca.expires_at,
          o.order_number, o.customer_name, o.customer_email, o.total_amount,
          o.shipping_address, o.created_at as order_created_at
        FROM carrier_assignments ca
        JOIN orders o ON ca.order_id = o.id
        WHERE ca.carrier_id = $1 AND ca.status IN ('pending', 'assigned')
      `;

      const params = [carrierId];
      let paramCount = 2;

      // Add filters
      if (filters.status) {
        query += ` AND ca.status = $${paramCount}`;
        params.push(filters.status);
        paramCount++;
      }

      if (filters.serviceType) {
        query += ` AND ca.service_type = $${paramCount}`;
        params.push(filters.serviceType);
        paramCount++;
      }

      query += ` ORDER BY ca.requested_at DESC`;

      const result = await pool.query(query, params);

      const assignments = result.rows.map(row => ({
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
      const carrierResult = await pool.query(
        'SELECT * FROM carriers WHERE code = $1',
        [carrierCode]
      );
      
      if (carrierResult.rows.length === 0) {
        throw new Error(`Carrier not found: ${carrierCode}`);
      }
      
      const carrier = carrierResult.rows[0];
      
      // Update carrier availability status
      await pool.query(
        `UPDATE carriers 
         SET availability_status = 'available', 
             last_status_change = NOW()
         WHERE id = $1`,
        [carrier.id]
      );
      
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
   * Accept an assignment and create shipment
   */
  async acceptAssignment(assignmentId, carrierId, acceptanceData = {}) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get assignment
      const assignmentResult = await client.query(
        `SELECT ca.*, o.id as order_id, o.shipping_address, o.customer_name,
                o.total_amount, c.id as carrier_id
         FROM carrier_assignments ca
         JOIN orders o ON ca.order_id = o.id
         JOIN carriers c ON ca.carrier_id = c.id
         WHERE ca.id = $1 AND ca.carrier_id = $2`,
        [assignmentId, carrierId]
      );

      if (assignmentResult.rows.length === 0) {
        throw new Error('Assignment not found or unauthorized');
      }

      const assignment = assignmentResult.rows[0];

      // Update assignment to accepted
      const acceptancePayload = {
        carrierReferenceId: acceptanceData.carrierReferenceId || `JOB-${Date.now()}`,
        dispatchTime: acceptanceData.dispatchTime || new Date(),
        estimatedPickup: acceptanceData.estimatedPickup || assignment.estimated_pickup,
        estimatedDelivery: acceptanceData.estimatedDelivery || assignment.estimated_delivery,
        driverName: acceptanceData.driverName,
        driverPhone: acceptanceData.driverPhone,
        vehicleInfo: acceptanceData.vehicleInfo,
        additionalInfo: acceptanceData.additionalInfo
      };

      const updateResult = await client.query(
        `UPDATE carrier_assignments 
         SET status = 'accepted', 
             accepted_at = NOW(),
             carrier_reference_id = $1,
             acceptance_payload = $2
         WHERE id = $3
         RETURNING *`,
        [
          acceptancePayload.carrierReferenceId,
          JSON.stringify(acceptancePayload),
          assignmentId
        ]
      );

      const updatedAssignment = updateResult.rows[0];

      // Create shipment from accepted assignment
      const trackingNumber = `TRACK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const shipmentResult = await client.query(
        `INSERT INTO shipments 
         (tracking_number, order_id, carrier_assignment_id, carrier_id, warehouse_id,
          status, origin_address, destination_address, delivery_scheduled,
          created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING *`,
        [
          trackingNumber,
          assignment.order_id,
          assignmentId,
          assignment.carrier_id,
          null, // warehouse_id would come from order allocation
          'pending',
          assignment.pickup_address,
          assignment.delivery_address,
          acceptancePayload.estimatedDelivery
        ]
      );

      const shipment = shipmentResult.rows[0];

      // Update order status to 'shipped'
      await client.query(
        `UPDATE orders 
         SET status = 'shipped', updated_at = NOW()
         WHERE id = $1`,
        [assignment.order_id]
      );

      await client.query('COMMIT');

      logger.info('Assignment accepted and shipment created', {
        assignmentId,
        shipmentId: shipment.id,
        trackingNumber,
        carrierId
      });

      return {
        assignment: updatedAssignment,
        shipment: {
          id: shipment.id,
          trackingNumber,
          status: shipment.status,
          createdAt: shipment.created_at
        },
        message: 'Assignment accepted. Shipment created successfully.'
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to accept assignment', {
        assignmentId,
        carrierId,
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reject an assignment
   */
  async rejectAssignment(assignmentId, carrierId, reason) {
    try {
      const result = await pool.query(
        `UPDATE carrier_assignments 
         SET status = 'rejected', 
             rejected_reason = $1,
             updated_at = NOW()
         WHERE id = $2 AND carrier_id = $3
         RETURNING *`,
        [reason || 'No reason provided', assignmentId, carrierId]
      );

      if (result.rows.length === 0) {
        throw new Error('Assignment not found or unauthorized');
      }

      logger.info('Assignment rejected', {
        assignmentId,
        carrierId,
        reason
      });

      return {
        assignment: result.rows[0],
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
      const expiredResult = await pool.query(
        `SELECT id, order_id, carrier_id FROM carrier_assignments
         WHERE status = 'pending' AND expires_at < NOW()`
      );

      logger.info(`Found ${expiredResult.rows.length} expired assignments`);

      for (const expired of expiredResult.rows) {
        // Mark as cancelled
        await pool.query(
          `UPDATE carrier_assignments 
           SET status = 'cancelled', updated_at = NOW()
           WHERE id = $1`,
          [expired.id]
        );

        // Try to reassign
        const orderResult = await pool.query(
          `SELECT o.*, array_agg(oi.*) as items FROM orders o
           LEFT JOIN order_items oi ON o.id = oi.order_id
           WHERE o.id = $1
           GROUP BY o.id`,
          [expired.order_id]
        );

        if (orderResult.rows.length > 0) {
          const order = orderResult.rows[0];
          logger.info(`Reassigning expired assignment for order ${expired.order_id}`);
          // Recursively request new assignment
          await this.requestCarrierAssignment(expired.order_id, { items: order.items });
        }
      }

      return expiredResult.rows.length;
    } catch (error) {
      logger.error('Failed to handle expired assignments', {
        error: error.message
      });
    }
  }
}

export default new CarrierAssignmentService();
