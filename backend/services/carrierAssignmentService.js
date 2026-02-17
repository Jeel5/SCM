import pool from '../configs/db.js';
import logger from '../utils/logger.js';
import axios from 'axios';
import { withTransaction } from '../utils/dbTransaction.js';
import carrierPayloadBuilder from './carrierPayloadBuilder.js';
import deliveryChargeService from './deliveryChargeService.js';

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
        const orderResult = await tx.query(
          `SELECT id, customer_name, customer_email, customer_phone, priority, 
                  status, shipping_address, total_amount, created_at, order_number
           FROM orders WHERE id = $1`,
          [orderId]
        );

        if (orderResult.rows.length === 0) {
          throw new Error(`Order ${orderId} not found`);
        }

        const order = orderResult.rows[0];

        // Get order items with shipping details
        const itemsResult = await tx.query(
          `SELECT oi.*, p.weight as product_weight, p.dimensions as product_dimensions,
                  p.is_fragile as product_is_fragile, p.is_hazmat as product_is_hazardous
           FROM order_items oi
           LEFT JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = $1`,
          [orderId]
        );

        const items = itemsResult.rows.map(item => ({
          ...item,
          weight: item.weight || item.product_weight || 0,
          dimensions: item.dimensions || item.product_dimensions || { length: 30, width: 20, height: 15 },
          is_fragile: item.is_fragile || item.product_is_fragile || false,
          is_hazardous: item.is_hazardous || item.product_is_hazardous || false
        }));

        // Get warehouse details for pickup address
        const warehouseResult = await tx.query(
          `SELECT w.* FROM warehouses w
           JOIN order_items oi ON w.id = oi.warehouse_id
           WHERE oi.order_id = $1
           LIMIT 1`,
          [orderId]
        );

        const warehouse = warehouseResult.rows[0] || { id: 'default' };

        // Check if max retry attempts reached (3 batches × 3 carriers = 9 max)
        const retryCheckResult = await tx.query(
          `SELECT COUNT(DISTINCT carrier_id) as tried_count
           FROM carrier_assignments
           WHERE order_id = $1`,
          [orderId]
        );

        const triedCount = parseInt(retryCheckResult.rows[0]?.tried_count || 0);

        if (triedCount >= 9) {
          logger.error(`Order ${orderId} has exhausted all carrier retries`, { triedCount });
          
          await tx.query(
            `UPDATE orders 
             SET status = 'on_hold', 
                 notes = CONCAT(COALESCE(notes, ''), '\n[SYSTEM] All carrier assignment attempts exhausted (9 carriers tried). Requires manual carrier assignment.'),
                 updated_at = NOW() 
             WHERE id = $1`,
            [orderId]
          );
          
          throw new Error('Maximum carrier assignment attempts exceeded. Order placed on hold for manual intervention.');
        }

        // Find eligible carriers based on service type and availability
        const serviceType = order.priority || 'standard'; // standard, express, bulk
        const carriersResult = await tx.query(
          `SELECT id, code, name, contact_email, service_type, is_active, availability_status
           FROM carriers 
           WHERE is_active = true 
           AND availability_status = 'available'
           AND (service_type = $1 OR service_type = 'all')
           ORDER BY reliability_score DESC
           LIMIT 3`,
          [serviceType]
        );

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

          const assignmentResult = await tx.query(
            `INSERT INTO carrier_assignments 
             (order_id, carrier_id, service_type, status, pickup_address, delivery_address,
              estimated_pickup, estimated_delivery, request_payload, expires_at, idempotency_key)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING id, carrier_id, order_id, status, created_at`,
            [
              orderId,
              carrier.id,
              serviceType,
              'pending',
              JSON.stringify(pickupAddress),
              JSON.stringify(deliveryAddress),
              new Date(requestPayload.service.estimatedDeliveryDate) || new Date(Date.now() + 2 * 60 * 60 * 1000),
              new Date(requestPayload.service.estimatedDeliveryDate) || new Date(Date.now() + 24 * 60 * 60 * 1000),
              JSON.stringify(requestPayload),
              expiresAt,
              idempotencyKey
            ]
          );

          const assignment = assignmentResult.rows[0];
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
        await tx.query(
          'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
          ['pending_carrier_assignment', orderId]
        );

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
    try {
      const result = await withTransaction(async (tx) => {
        // Get assignment with complete order data
        logger.debug('Querying assignment for acceptance', { assignmentId, carrierId });
        
        const assignmentResult = await tx.query(
          `SELECT ca.*, o.id as order_id, o.shipping_address, o.customer_name,
                  o.total_amount, o.is_cod, o.order_type, c.id as carrier_id
           FROM carrier_assignments ca
           JOIN orders o ON ca.order_id = o.id
           JOIN carriers c ON ca.carrier_id = c.id
           WHERE ca.id = $1 AND ca.carrier_id = $2`,
          [assignmentId, carrierId]
        );

        logger.debug('Assignment query result', { 
          rowCount: assignmentResult.rows.length,
          assignment: assignmentResult.rows[0] || null 
        });

        if (assignmentResult.rows.length === 0) {
          // Query to see if assignment exists with different carrier
          const checkResult = await tx.query(
            `SELECT ca.id, ca.carrier_id, c.name as carrier_name, ca.status
             FROM carrier_assignments ca
             JOIN carriers c ON ca.carrier_id = c.id
             WHERE ca.id = $1`,
            [assignmentId]
          );
          
          if (checkResult.rows.length > 0) {
            const actualAssignment = checkResult.rows[0];
            logger.error('Assignment exists but belongs to different carrier', {
              requestedCarrierId: carrierId,
              actualCarrierId: actualAssignment.carrier_id,
              actualCarrierName: actualAssignment.carrier_name,
              assignmentStatus: actualAssignment.status
            });
            throw new Error(`Assignment belongs to ${actualAssignment.carrier_name} (not your carrier)`);
          }
          
          throw new Error('Assignment not found or unauthorized');
        }

        const assignment = assignmentResult.rows[0];

        // Parse and validate acceptance payload
        const acceptancePayload = carrierPayloadBuilder.parseAcceptancePayload(acceptanceData);

        const updateResult = await tx.query(
          `UPDATE carrier_assignments 
           SET status = 'accepted', 
               accepted_at = NOW(),
               carrier_reference_id = $1,
               carrier_tracking_number = $2,
               acceptance_payload = $3
           WHERE id = $4
           RETURNING *`,
          [
            acceptancePayload.tracking.carrierReferenceId,
            acceptancePayload.tracking.trackingNumber,
            JSON.stringify(acceptancePayload),
            assignmentId
          ]
        );

        const updatedAssignment = updateResult.rows[0];

        // Create shipment from accepted assignment
        const trackingNumber = acceptancePayload.tracking.trackingNumber || 
                              `TRACK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Get order items to aggregate shipping attributes
        const itemsResult = await tx.query(
          `SELECT quantity, weight, dimensions, volumetric_weight,
                  is_fragile, is_hazardous, is_perishable, requires_cold_storage,
                  item_type, package_type, handling_instructions,
                  requires_insurance, declared_value
           FROM order_items
           WHERE order_id = $1`,
          [assignment.order_id]
        );

        const items = itemsResult.rows;
        
        // Aggregate item data for shipment
        const aggregatedData = {
          totalItems: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
          totalWeight: items.reduce((sum, item) => sum + ((item.weight || 0) * (item.quantity || 1)), 0),
          totalVolumetricWeight: items.reduce((sum, item) => sum + ((item.volumetric_weight || 0) * (item.quantity || 1)), 0),
          totalDeclaredValue: items.reduce((sum, item) => sum + (item.declared_value || 0), 0),
          packageCount: items.length,
          
          // Flags: true if ANY item has the attribute
          isFragile: items.some(item => item.is_fragile),
          isHazardous: items.some(item => item.is_hazardous),
          isPerishable: items.some(item => item.is_perishable),
          requiresColdStorage: items.some(item => item.requires_cold_storage),
          requiresInsurance: items.some(item => item.requires_insurance),
          
          // Item type: most restrictive
          itemType: this._getMostRestrictiveItemType(items.map(i => i.item_type)),
          
          // Package type: most common
          packageType: this._getMostCommonPackageType(items.map(i => i.package_type)),
          
          // Handling instructions: concatenate all non-null
          handlingInstructions: items
            .filter(i => i.handling_instructions)
            .map(i => i.handling_instructions)
            .join('; '),
          
          // Dimensions: use largest item or aggregate
          dimensions: this._aggregateDimensions(items.map(i => i.dimensions)),
        };

        // Calculate shipment weight from request payload or aggregated data
        // PostgreSQL JSONB columns are automatically parsed by pg driver
        const requestPayload = typeof assignment.request_payload === 'string' 
          ? JSON.parse(assignment.request_payload) 
          : assignment.request_payload;
        const shipmentWeight = requestPayload.shipment?.chargeableWeight || 
                              Math.max(aggregatedData.totalWeight, aggregatedData.totalVolumetricWeight);

        const shipmentResult = await tx.query(
          `INSERT INTO shipments 
           (tracking_number, carrier_tracking_number, order_id, carrier_assignment_id, carrier_id, 
            warehouse_id, status, origin_address, destination_address, delivery_scheduled,
            weight, volumetric_weight, dimensions, package_count, total_items,
            shipping_cost, cod_amount, 
            is_fragile, is_hazardous, is_perishable, requires_cold_storage,
            item_type, package_type, handling_instructions,
            requires_insurance, declared_value,
            created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, NOW(), NOW())
           RETURNING *`,
          [
            trackingNumber,
            acceptancePayload.tracking.carrierReferenceId,
            assignment.order_id,
            assignmentId,
            assignment.carrier_id,
            null, // warehouse_id would come from order allocation
            'pending',
            assignment.pickup_address,
            assignment.delivery_address,
            new Date(acceptancePayload.delivery.estimatedDeliveryTime || Date.now() + 24*60*60*1000),
            shipmentWeight,
            aggregatedData.totalVolumetricWeight,
            aggregatedData.dimensions,
            aggregatedData.packageCount,
            aggregatedData.totalItems,
            acceptancePayload.pricing?.quotedPrice || 0,
            assignment.is_cod ? assignment.total_amount : 0,
            aggregatedData.isFragile,
            aggregatedData.isHazardous,
            aggregatedData.isPerishable,
            aggregatedData.requiresColdStorage,
            aggregatedData.itemType,
            aggregatedData.packageType,
            aggregatedData.handlingInstructions || null,
            aggregatedData.requiresInsurance,
            aggregatedData.totalDeclaredValue
          ]
        );

        const shipment = shipmentResult.rows[0];

        // Update order status to 'ready_to_ship' (not 'shipped' until carrier actually ships)
        await tx.query(
          `UPDATE orders 
           SET status = 'ready_to_ship', 
               carrier_id = $2,
               updated_at = NOW()
           WHERE id = $1`,
          [assignment.order_id, assignment.carrier_id]
        );

        return { updatedAssignment, shipment, trackingNumber };
      });

      logger.info('Assignment accepted and shipment created', {
        assignmentId,
        shipmentId: result.shipment.id,
        trackingNumber: result.trackingNumber,
        carrierId
      });

      return {
        assignment: result.updatedAssignment,
        shipment: {
          id: result.shipment.id,
          trackingNumber: result.trackingNumber,
          status: result.shipment.status,
          createdAt: result.shipment.created_at
        },
        message: 'Assignment accepted. Shipment created successfully.'
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
}

export default new CarrierAssignmentService();
