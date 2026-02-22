// Carrier Repository — all SQL queries for the carriers, rate_cards, and
// carrier_performance_metrics tables live here.
import BaseRepository from './BaseRepository.js';

class CarrierRepository extends BaseRepository {
    constructor() {
        super('carriers');
    }

    // ─────────────────────────────────────────────────────────────
    // LIST / FIND
    // ─────────────────────────────────────────────────────────────

    /**
     * Find carriers with pagination, filtering, and optional org scoping.
     * Includes aggregated shipment counts for performance overview.
     */
    async findCarriers({
        page = 1,
        limit = 50,
        is_active = null,
        availability_status = null,
        service_type = null,
        search = null,
        organizationId = undefined
    } = {}, client = null) {
        const offset = (page - 1) * limit;
        const params = [];
        let paramCount = 1;

        let query = `
      SELECT
        c.*,
        COUNT(*) OVER()                                                           AS total_count,
        (SELECT COUNT(*) FROM shipments s WHERE s.carrier_id = c.id)::int         AS total_shipments,
        (SELECT COUNT(*) FROM shipments s
          WHERE s.carrier_id = c.id
          AND s.status NOT IN ('delivered', 'returned', 'cancelled'))::int        AS active_shipments
      FROM carriers c
      WHERE 1=1
    `;

        // NOTE: carriers can be org-scoped OR system-wide (organization_id IS NULL).
        // When an org user fetches carriers, return their org's carriers + system-wide ones.
        if (organizationId !== undefined) {
            query += ` AND (c.organization_id = $${paramCount++} OR c.organization_id IS NULL)`;
            params.push(organizationId);
        }

        if (is_active !== null) {
            query += ` AND c.is_active = $${paramCount++}`;
            params.push(is_active);
        }

        if (availability_status) {
            query += ` AND c.availability_status = $${paramCount++}`;
            params.push(availability_status);
        }

        if (service_type) {
            query += ` AND c.service_type = $${paramCount++}`;
            params.push(service_type);
        }

        if (search) {
            query += ` AND (c.name ILIKE $${paramCount} OR c.code ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        query += ` ORDER BY c.reliability_score DESC, c.name ASC`;
        query += ` LIMIT $${paramCount++} OFFSET $${paramCount}`;
        params.push(limit, offset);

        const result = await this.query(query, params, client);

        return {
            carriers: result.rows,
            totalCount: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0
        };
    }

    /**
     * Find a carrier by primary key, optionally scoped to an organisation.
     * Returns null if not found or outside org scope.
     */
    async findByIdWithDetails(id, organizationId = undefined, client = null) {
        const params = [id];
        let paramCount = 2;

        let query = `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM shipments s WHERE s.carrier_id = c.id)::int         AS total_shipments,
        (SELECT COUNT(*) FROM shipments s
          WHERE s.carrier_id = c.id
          AND s.status NOT IN ('delivered', 'returned', 'cancelled'))::int        AS active_shipments,
        (SELECT ROUND(AVG(CASE WHEN s.status = 'delivered' THEN 1 ELSE 0 END)::numeric * 100, 1)
          FROM shipments s WHERE s.carrier_id = c.id)                             AS on_time_rate
      FROM carriers c
      WHERE c.id = $1
    `;

        if (organizationId !== undefined) {
            query += ` AND (c.organization_id = $${paramCount++} OR c.organization_id IS NULL)`;
            params.push(organizationId);
        }

        const result = await this.query(query, params, client);
        return result.rows[0] || null;
    }

    /**
     * Find carrier by code (unique per org or globally unique when org_id is NULL)
     */
    async findByCode(code, organizationId = undefined, client = null) {
        const params = [code.toUpperCase()];
        let query = `SELECT * FROM carriers WHERE UPPER(code) = $1`;

        if (organizationId !== undefined) {
            query += ` AND (organization_id = $2 OR organization_id IS NULL)`;
            params.push(organizationId);
        }

        query += ` LIMIT 1`;
        const result = await this.query(query, params, client);
        return result.rows[0] || null;
    }

    /**
     * Find available carriers eligible to pick up new assignments.
     * Used by carrierAssignmentService to select candidates.
     */
    async findAvailableCarriers(serviceType = null, organizationId = undefined, client = null) {
        const params = [];
        let paramCount = 1;

        let query = `
      SELECT id, code, name, contact_email, service_type, reliability_score,
             daily_capacity, current_load, availability_status
      FROM carriers
      WHERE is_active = true AND availability_status = 'available'
    `;

        if (serviceType) {
            query += ` AND (service_type = $${paramCount++} OR service_type = 'all')`;
            params.push(serviceType);
        }

        if (organizationId !== undefined) {
            query += ` AND (organization_id = $${paramCount++} OR organization_id IS NULL)`;
            params.push(organizationId);
        }

        query += ` ORDER BY reliability_score DESC LIMIT 10`;
        const result = await this.query(query, params, client);
        return result.rows;
    }

    // ─────────────────────────────────────────────────────────────
    // CREATE / UPDATE / DELETE
    // ─────────────────────────────────────────────────────────────

    /**
     * Create a new carrier record.
     */
    async createCarrier(data, client = null) {
        // Enforce uppercase code
        const code = data.code.toUpperCase().trim();

        const query = `
      INSERT INTO carriers (
        organization_id, code, name, service_type, service_areas,
        contact_email, contact_phone, website,
        api_endpoint, webhook_url,
        reliability_score, avg_delivery_days, daily_capacity,
        is_active, availability_status,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10,
        $11, $12, $13,
        $14, $15,
        NOW(), NOW()
      )
      RETURNING *
    `;

        const params = [
            data.organization_id || null,
            code,
            data.name,
            data.service_type || 'standard',
            data.service_areas ? JSON.stringify(data.service_areas) : null,
            data.contact_email || null,
            data.contact_phone || null,
            data.website || null,
            data.api_endpoint || null,
            data.webhook_url || null,
            data.reliability_score ?? 0.85,
            data.avg_delivery_days || null,
            data.daily_capacity || null,
            data.is_active !== false, // default true
            data.availability_status || 'available'
        ];

        const result = await this.query(query, params, client);
        return result.rows[0];
    }

    /**
     * Update a carrier record (dynamic SET clause).
     */
    async updateCarrier(id, updates, client = null) {
        const ALLOWED = [
            'name', 'service_type', 'contact_email', 'contact_phone', 'website',
            'api_endpoint', 'webhook_url', 'reliability_score', 'avg_delivery_days',
            'daily_capacity', 'is_active', 'availability_status'
        ];

        const setClauses = [];
        const params = [];
        let paramCount = 1;

        for (const field of ALLOWED) {
            if (updates[field] !== undefined) {
                setClauses.push(`${field} = $${paramCount++}`);
                params.push(updates[field]);
            }
        }

        // Handle service_areas JSON separately
        if (updates.service_areas !== undefined) {
            setClauses.push(`service_areas = $${paramCount++}`);
            params.push(JSON.stringify(updates.service_areas));
        }

        if (setClauses.length === 0) throw new Error('No valid fields to update');

        setClauses.push(`updated_at = NOW()`);
        params.push(id);

        const query = `
      UPDATE carriers
      SET ${setClauses.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

        const result = await this.query(query, params, client);
        return result.rows[0] || null;
    }

    /**
     * Soft-delete: deactivate a carrier.
     */
    async deactivateCarrier(id, client = null) {
        const query = `
      UPDATE carriers
      SET is_active = false, availability_status = 'offline', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
        const result = await this.query(query, [id], client);
        return result.rows[0] || null;
    }

    /**
     * Update availability status (available / busy / offline / maintenance).
     * Called by carrier webhooks when they report capacity changes.
     */
    async updateAvailabilityStatus(id, status, client = null) {
        const query = `
      UPDATE carriers
      SET availability_status = $1, last_status_change = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING id, code, name, availability_status, last_status_change
    `;
        const result = await this.query(query, [status, id], client);
        return result.rows[0] || null;
    }

    // ─────────────────────────────────────────────────────────────
    // RATE CARDS
    // ─────────────────────────────────────────────────────────────

    /**
     * Get all rate cards for a carrier.
     */
    async findRateCards(carrierId, client = null) {
        const query = `
      SELECT rc.*, c.name AS carrier_name
      FROM rate_cards rc
      JOIN carriers c ON rc.carrier_id = c.id
      WHERE rc.carrier_id = $1 AND rc.is_active = true
      ORDER BY rc.origin_state, rc.destination_state, rc.service_type
    `;
        const result = await this.query(query, [carrierId], client);
        return result.rows;
    }

    /**
     * Check if a carrier has active shipments (before deactivation)
     */
    async hasActiveShipments(id, client = null) {
        const query = `
      SELECT EXISTS(
        SELECT 1 FROM shipments
        WHERE carrier_id = $1 AND status NOT IN ('delivered', 'returned', 'cancelled')
      ) AS has_active
    `;
        const result = await this.query(query, [id], client);
        return result.rows[0].has_active;
    }
}

export default new CarrierRepository();
