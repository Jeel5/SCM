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
}

export default new CarrierAssignmentRepository();
