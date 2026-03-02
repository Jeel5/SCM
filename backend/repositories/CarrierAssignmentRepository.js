import BaseRepository from './BaseRepository.js';

class CarrierAssignmentRepository extends BaseRepository {
    constructor() {
        super('carrier_assignments');
    }

    async findActiveByOrderId(orderId, organizationId = undefined, client = null) {
        let query = `
      SELECT id, status 
      FROM carrier_assignments 
      WHERE order_id = $1 AND status NOT IN ('rejected', 'cancelled')
    `;
        const params = [orderId];
        if (organizationId !== undefined) {
            query += ` AND organization_id = $2`;
            params.push(organizationId);
        }
        const result = await this.query(query, params, client);
        return result.rows;
    }

    async findDetailsById(assignmentId, organizationId = undefined, client = null) {
        let query = `
      SELECT 
        ca.id, ca.order_id, ca.carrier_id, ca.service_type, ca.status,
        ca.request_payload, ca.acceptance_payload, ca.carrier_reference_id,
        ca.requested_at, ca.accepted_at, ca.expires_at,
        o.order_number, o.customer_name, o.customer_email, o.customer_phone,
        o.total_amount, o.shipping_address,
        c.code as carrier_code, c.name as carrier_name, c.contact_email as carrier_email,
        c.contact_phone as carrier_phone
      FROM carrier_assignments ca
      JOIN orders o ON ca.order_id = o.id
      JOIN carriers c ON ca.carrier_id = c.id
      WHERE ca.id = $1
    `;
        const params = [assignmentId];
        if (organizationId !== undefined) {
            query += ` AND ca.organization_id = $2`;
            params.push(organizationId);
        }
        const result = await this.query(query, params, client);
        return result.rows[0];
    }

    async findByOrderId(orderId, organizationId = undefined, client = null) {
        let query = `
      SELECT 
        ca.id, ca.order_id, ca.carrier_id, ca.status,
        ca.requested_at, ca.accepted_at, ca.expires_at,
        c.code, c.name, c.service_type,
        COUNT(CASE WHEN ca.status = 'accepted' THEN 1 END) as accepted_count
      FROM carrier_assignments ca
      JOIN carriers c ON ca.carrier_id = c.id
      WHERE ca.order_id = $1
    `;
        const params = [orderId];
        if (organizationId !== undefined) {
            query += ` AND ca.organization_id = $2`;
            params.push(organizationId);
        }
        query += `
      GROUP BY ca.id, ca.order_id, ca.carrier_id, ca.status,
              ca.requested_at, ca.accepted_at, ca.expires_at,
              c.code, c.name, c.service_type
      ORDER BY ca.requested_at DESC
    `;
        const result = await this.query(query, params, client);
        return result.rows;
    }

    /**
     * Mark an assignment as 'busy' (carrier is at capacity but may accept later).
     * TASK-R6-007: carrierId must be a UUID resolved by the caller — remove code/cast fallback.
     */
    async markAsBusy(assignmentId, carrierId, reason, client = null) {
        const query = `
      UPDATE carrier_assignments
      SET status = 'busy',
          rejected_reason = $1,
          updated_at = NOW()
      WHERE id = $2 AND carrier_id = $3
      RETURNING *
    `;
        const result = await this.query(query, [reason || 'At capacity - can accept later', assignmentId, carrierId], client);
        return result.rows[0];
    }

    async countTriedCarriers(orderId, client = null) {
        const result = await this.query(
            `SELECT COUNT(DISTINCT carrier_id) AS tried_count FROM carrier_assignments WHERE order_id = $1`,
            [orderId], client
        );
        return parseInt(result.rows[0]?.tried_count || 0);
    }

    async findPendingByCarrier(carrierId, filters = {}, client = null) {
        let query = `
            SELECT
                ca.id, ca.order_id, ca.carrier_id, ca.service_type, ca.status,
                ca.request_payload, ca.requested_at, ca.expires_at,
                o.order_number, o.customer_name, o.customer_email, o.total_amount,
                o.shipping_address, o.created_at AS order_created_at
            FROM carrier_assignments ca
            JOIN orders o ON ca.order_id = o.id
            WHERE ca.carrier_id = $1 AND ca.status IN ('pending', 'assigned')
        `;
        const params = [carrierId];
        let paramCount = 2;
        if (filters.status) {
            query += ` AND ca.status = $${paramCount++}`;
            params.push(filters.status);
        }
        if (filters.serviceType) {
            query += ` AND ca.service_type = $${paramCount++}`;
            params.push(filters.serviceType);
        }
        query += ` ORDER BY ca.requested_at DESC`;
        const result = await this.query(query, params, client);
        return result.rows;
    }

    async findForAcceptance(assignmentId, carrierId, client = null) {
        const result = await this.query(
            `SELECT ca.*, o.id AS order_id, o.shipping_address, o.customer_name,
                    o.total_amount, o.is_cod, o.order_type, c.id AS carrier_id
             FROM carrier_assignments ca
             JOIN orders o ON ca.order_id = o.id
             JOIN carriers c ON ca.carrier_id = c.id
             WHERE ca.id = $1 AND ca.carrier_id = $2 AND ca.status = 'pending'
             FOR UPDATE OF ca`,
            [assignmentId, carrierId], client
        );
        return result.rows[0] || null;
    }

    async findByIdWithCarrier(assignmentId, client = null) {
        const result = await this.query(
            `SELECT ca.id, ca.carrier_id, c.name AS carrier_name, ca.status
             FROM carrier_assignments ca
             JOIN carriers c ON ca.carrier_id = c.id
             WHERE ca.id = $1`,
            [assignmentId], client
        );
        return result.rows[0] || null;
    }

    async acceptAssignment(assignmentId, referenceId, trackingNumber, acceptancePayload, client = null) {
        const result = await this.query(
            `UPDATE carrier_assignments
             SET status = 'accepted',
                 accepted_at = NOW(),
                 carrier_reference_id = $1,
                 carrier_tracking_number = $2,
                 acceptance_payload = $3
             WHERE id = $4 AND status = 'pending'
             RETURNING *`,
            [referenceId, trackingNumber, JSON.stringify(acceptancePayload), assignmentId], client
        );
        return result.rows[0];
    }

    /**
     * Cancel all other pending assignments for the same order after one is accepted.
     * Prevents duplicate shipments.
     */
    async cancelRemainingAssignments(orderId, acceptedAssignmentId, client = null) {
        const result = await this.query(
            `UPDATE carrier_assignments
             SET status = 'cancelled', updated_at = NOW()
             WHERE order_id = $1 AND id != $2 AND status IN ('pending', 'assigned')
             RETURNING id, carrier_id`,
            [orderId, acceptedAssignmentId], client
        );
        return result.rows;
    }

    async rejectAssignment(assignmentId, carrierId, reason, client = null) {
        const result = await this.query(
            `UPDATE carrier_assignments
             SET status = 'rejected',
                 rejected_reason = $1,
                 updated_at = NOW()
             WHERE id = $2 AND carrier_id = $3
             RETURNING *`,
            [reason || 'No reason provided', assignmentId, carrierId], client
        );
        return result.rows[0] || null;
    }

    async findExpiredPending(client = null) {
        const result = await this.query(
            `SELECT id, order_id, carrier_id FROM carrier_assignments
             WHERE status = 'pending' AND expires_at < NOW()`,
            [], client
        );
        return result.rows;
    }

    async cancelById(id, client = null) {
        await this.query(
            `UPDATE carrier_assignments SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
            [id], client
        );
    }

    async findExpiredWithOrders(client = null) {
        const result = await this.query(
            `SELECT DISTINCT ca.order_id, o.*
             FROM carrier_assignments ca
             JOIN orders o ON ca.order_id = o.id
             WHERE ca.status = 'pending'
               AND ca.expires_at < NOW()
               AND o.status NOT IN ('shipped', 'delivered', 'cancelled')
             GROUP BY ca.order_id, o.id
             HAVING COUNT(*) < 9`,
            [], client
        );
        return result.rows;
    }

    async expireByOrderId(orderId, client = null) {
        await this.query(
            `UPDATE carrier_assignments SET status = 'expired', updated_at = NOW()
             WHERE order_id = $1 AND status = 'pending'`,
            [orderId], client
        );
    }

    async resetToPending(id, client = null) {
        await this.query(
            `UPDATE carrier_assignments SET status = 'pending', updated_at = NOW() WHERE id = $1`,
            [id], client
        );
    }

    async findBusyByCarrier(carrierId, limit = 5, client = null) {
        const result = await this.query(
            `SELECT ca.*, o.priority, o.customer_name
             FROM carrier_assignments ca
             JOIN orders o ON ca.order_id = o.id
             WHERE ca.carrier_id = $1
               AND ca.status = 'busy'
               AND ca.expires_at > NOW()
               AND o.status NOT IN ('shipped', 'delivered', 'cancelled')
             ORDER BY ca.requested_at ASC
             LIMIT $2`,
            [carrierId, limit], client
        );
        return result.rows;
    }

    async findAllRejectedOrders(client = null) {
        const result = await this.query(
            `SELECT ca.order_id,
                    COUNT(*) AS total_assignments,
                    COUNT(*) FILTER (WHERE status IN ('rejected', 'busy', 'expired')) AS failed_count,
                    o.priority, o.customer_name
             FROM carrier_assignments ca
             JOIN orders o ON ca.order_id = o.id
             WHERE ca.created_at > NOW() - INTERVAL '48 hours'
               AND o.status NOT IN ('shipped', 'delivered', 'cancelled')
             GROUP BY ca.order_id, o.priority, o.customer_name
             HAVING COUNT(*) = COUNT(*) FILTER (WHERE status IN ('rejected', 'busy', 'expired'))
               AND COUNT(*) % 3 = 0
               AND COUNT(*) < 9`,
            [], client
        );
        return result.rows;
    }

    // ── Methods for carrierAssignmentService ────────────────────────────────

    async findOrderById(orderId, client = null) {
        const result = await this.query(
            `SELECT id, customer_name, customer_email, customer_phone, priority,
                    status, shipping_address, total_amount, created_at, order_number
             FROM orders WHERE id = $1`,
            [orderId], client
        );
        return result.rows[0] || null;
    }

    async findOrderItemsWithProducts(orderId, client = null) {
        const result = await this.query(
            `SELECT oi.*, p.weight as product_weight, p.dimensions as product_dimensions,
                    p.is_fragile as product_is_fragile, p.is_hazmat as product_is_hazardous
             FROM order_items oi
             LEFT JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = $1`,
            [orderId], client
        );
        return result.rows;
    }

    async findWarehouseForOrder(orderId, client = null) {
        const result = await this.query(
            `SELECT w.* FROM warehouses w
             JOIN order_items oi ON w.id = oi.warehouse_id
             WHERE oi.order_id = $1
             LIMIT 1`,
            [orderId], client
        );
        return result.rows[0] || { id: 'default' };
    }

    async markOrderOnHold(orderId, client = null) {
        await this.query(
            `UPDATE orders
             SET status = 'on_hold',
                 notes = CONCAT(COALESCE(notes, ''), '\n[SYSTEM] All carrier assignment attempts exhausted (9 carriers tried). Requires manual carrier assignment.'),
                 updated_at = NOW()
             WHERE id = $1`,
            [orderId], client
        );
    }

    async findAvailableCarriers(serviceType, client = null) {
        const result = await this.query(
            `SELECT id, code, name, contact_email, service_type, is_active, availability_status
             FROM carriers
             WHERE is_active = true
               AND availability_status = 'available'
               AND (service_type = $1 OR service_type = 'all')
             ORDER BY reliability_score DESC
             LIMIT 3`,
            [serviceType], client
        );
        return result.rows;
    }

    async createAssignment({ orderId, carrierId, serviceType, pickupAddress, deliveryAddress, estimatedPickup, estimatedDelivery, requestPayload, expiresAt, idempotencyKey }, client = null) {
        const result = await this.query(
            `INSERT INTO carrier_assignments
             (order_id, carrier_id, service_type, status, pickup_address, delivery_address,
              estimated_pickup, estimated_delivery, request_payload, expires_at, idempotency_key)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING id, carrier_id, order_id, status, created_at`,
            [
                orderId, carrierId, serviceType, 'pending',
                JSON.stringify(pickupAddress), JSON.stringify(deliveryAddress),
                estimatedPickup, estimatedDelivery,
                JSON.stringify(requestPayload), expiresAt, idempotencyKey
            ], client
        );
        return result.rows[0];
    }

    async updateOrderStatus(orderId, status, client = null) {
        await this.query(
            'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
            [status, orderId], client
        );
    }

    async findCarrierByCode(code, client = null) {
        const result = await this.query(
            'SELECT * FROM carriers WHERE code = $1',
            [code], client
        );
        return result.rows[0] || null;
    }

    async setCarrierAvailable(carrierId, client = null) {
        await this.query(
            `UPDATE carriers
             SET availability_status = 'available',
                 last_status_change = NOW()
             WHERE id = $1`,
            [carrierId], client
        );
    }

    async findOrderItemsForShipment(orderId, client = null) {
        const result = await this.query(
            `SELECT quantity, weight, dimensions, volumetric_weight,
                    is_fragile, is_hazardous, is_perishable, requires_cold_storage,
                    item_type, package_type, handling_instructions,
                    requires_insurance, declared_value
             FROM order_items
             WHERE order_id = $1`,
            [orderId], client
        );
        return result.rows;
    }

    async createShipment(fields, client = null) {
        const {
            trackingNumber, carrierTrackingNumber, orderId, assignmentId, carrierId,
            warehouseId, pickupAddress, deliveryAddress, deliveryScheduled, pickupScheduled,
            slaPolicyId,
            weight, volumetricWeight, dimensions, packageCount, totalItems,
            shippingCost, codAmount,
            isFragile, isHazardous, isPerishable, requiresColdStorage,
            itemType, packageType, handlingInstructions,
            requiresInsurance, declaredValue, organizationId
        } = fields;

        const result = await this.query(
            `INSERT INTO shipments
             (tracking_number, carrier_tracking_number, order_id, carrier_assignment_id, carrier_id,
              warehouse_id, status, origin_address, destination_address, delivery_scheduled,
              pickup_scheduled,
              weight, volumetric_weight, dimensions, package_count, total_items,
              shipping_cost, cod_amount,
              is_fragile, is_hazardous, is_perishable, requires_cold_storage,
              item_type, package_type, handling_instructions,
              requires_insurance, declared_value, organization_id,
              sla_policy_id,
              created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,NOW(),NOW())
             RETURNING *`,
            [
                trackingNumber, carrierTrackingNumber, orderId, assignmentId, carrierId,
                warehouseId || null, 'pending',
                pickupAddress, deliveryAddress, deliveryScheduled,
                pickupScheduled || null,
                weight, volumetricWeight, dimensions, packageCount, totalItems,
                shippingCost, codAmount,
                isFragile, isHazardous, isPerishable, requiresColdStorage,
                itemType, packageType, handlingInstructions || null,
                requiresInsurance, declaredValue, organizationId || null,
                slaPolicyId || null,
            ], client
        );
        return result.rows[0];
    }

    async insertShipmentCreatedEvent(shipmentId, client = null) {
        await this.query(
            `INSERT INTO shipment_events
               (shipment_id, event_type, event_code, status, description, source, event_timestamp)
             VALUES ($1, 'shipment_created', 'CREATED', 'pending',
               'Shipment confirmed and awaiting carrier pickup', 'system', NOW())`,
            [shipmentId], client
        );
    }

    async updateOrderCarrier(orderId, status, carrierId, client = null) {
        await this.query(
            `UPDATE orders
             SET status = $1,
                 carrier_id = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [status, carrierId, orderId], client
        );
    }

    async findOrderWithItems(orderId, client = null) {
        const result = await this.query(
            `SELECT o.*, array_agg(oi.*) as items FROM orders o
             LEFT JOIN order_items oi ON o.id = oi.order_id
             WHERE o.id = $1
             GROUP BY o.id`,
            [orderId], client
        );
        return result.rows[0] || null;
    }

    async createAssignmentExhaustedAlert({ organizationId, orderNumber, orderId, triedCount, priority }, client = null) {
        await this.query(
            `INSERT INTO alerts
               (organization_id, rule_name, alert_type, severity, message,
                entity_type, entity_id, data, status, created_at)
             VALUES ($1, 'Carrier Assignment Exhausted', 'carrier_assignment_failure',
                     'critical', $2, 'order', $3, $4, 'triggered', NOW())`,
            [
                organizationId || null,
                `Order ${orderNumber || orderId} could not be assigned to any carrier after 9 attempts. Manual assignment required.`,
                orderId,
                JSON.stringify({ orderNumber, triedCount, priority })
            ], client
        );
    }

    async findNewlyAvailableCarriers(client = null) {
        const result = await this.query(
            `SELECT id, code, name
             FROM carriers
             WHERE availability_status = 'available'
               AND last_status_change > NOW() - INTERVAL '30 minutes'
               AND is_active = true`,
            [], client
        );
        return result.rows;
    }
}

export default new CarrierAssignmentRepository();
