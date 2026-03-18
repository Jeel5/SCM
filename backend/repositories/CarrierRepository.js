// Carrier Repository — all SQL queries for the carriers, rate_cards, and
// carrier_performance_metrics tables live here.
import { randomBytes } from 'crypto';
import BaseRepository from './BaseRepository.js';
import { ValidationError } from '../errors/AppError.js';

class CarrierRepository extends BaseRepository {
    constructor() {
        super('carriers');
    }

    // Generate unique carrier code using an atomic DB sequence
    async generateCarrierCode(client = null) {
        const prefix = 'CAR';
        const year = new Date().getFullYear().toString().slice(-2);
        const result = await this.query(`SELECT nextval('carrier_code_seq') AS seq`, [], client);
        const sequence = result.rows[0].seq.toString().padStart(3, '0');
        return `${prefix}-${year}-${sequence}`;
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

        // TASK-R6-008: Replace 3 correlated per-row subqueries with a single
        // LEFT JOIN + GROUP BY to avoid N+1 scans on the shipments table.
        let query = `
      SELECT
        c.*,
        COUNT(*) OVER()                                                           AS total_count,
        COALESCE(cs.total_shipments, 0)::int                                     AS total_shipments,
        COALESCE(cs.active_shipments, 0)::int                                    AS active_shipments
      FROM carriers c
      LEFT JOIN (
        SELECT
          carrier_id,
          COUNT(*)                                                                AS total_shipments,
          COUNT(*) FILTER (WHERE status NOT IN ('delivered', 'returned', 'cancelled')) AS active_shipments
        FROM shipments
        GROUP BY carrier_id
      ) cs ON cs.carrier_id = c.id
      WHERE 1=1
    `;

        // NOTE: carriers can be org-scoped OR system-wide (organization_id IS NULL).
        // When an org user fetches carriers, return their org's carriers + system-wide ones.
        if (organizationId !== undefined) {
            query += ` AND (c.organization_id = $${paramCount += 1} OR c.organization_id IS NULL)`;
            params.push(organizationId);
        }

        if (is_active !== null) {
            query += ` AND c.is_active = $${paramCount += 1}`;
            params.push(is_active);
        }

        if (availability_status) {
            query += ` AND c.availability_status = $${paramCount += 1}`;
            params.push(availability_status);
        }

        if (service_type) {
            query += ` AND c.service_type = $${paramCount += 1}`;
            params.push(service_type);
        }

        if (search) {
            query += ` AND (c.name ILIKE $${paramCount} OR c.code ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount += 1;
        }

        query += ` ORDER BY c.reliability_score DESC, c.name ASC`;
        query += ` LIMIT $${paramCount += 1} OFFSET $${paramCount}`;
        params.push(limit, offset);

        const result = await this.query(query, params, client);

        return {
            carriers: result.rows,
            totalCount: result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0
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
            query += ` AND (c.organization_id = $${paramCount += 1} OR c.organization_id IS NULL)`;
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
    async findAvailableCarriers(serviceType = null, organizationId = undefined, limit = 10, client = null) {
        const params = [];
        let paramCount = 1;

        let query = `
      SELECT id, code, name, contact_email, service_type, reliability_score,
             daily_capacity, current_load, availability_status
      FROM carriers
      WHERE is_active = true AND availability_status = 'available'
    `;

        if (serviceType) {
            query += ` AND (service_type = $${paramCount += 1} OR service_type = 'all')`;
            params.push(serviceType);
        }

        if (organizationId !== undefined) {
            query += ` AND (organization_id = $${paramCount += 1} OR organization_id IS NULL)`;
            params.push(organizationId);
        }

        query += ` ORDER BY reliability_score DESC LIMIT $${paramCount += 1}`;
        params.push(limit);
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
        // Auto-generate a secure webhook secret so HMAC-authenticated endpoints work immediately
        const webhookSecret = randomBytes(32).toString('hex');

        const query = `
      INSERT INTO carriers (
        organization_id, code, name, service_type, service_areas,
        contact_email, contact_phone, website,
        api_endpoint, webhook_url, webhook_secret,
        reliability_score, avg_delivery_days, daily_capacity,
        is_active, availability_status,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14,
        $15, $16,
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
            webhookSecret,
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
                setClauses.push(`${field} = $${paramCount += 1}`);
                params.push(updates[field]);
            }
        }

        // Handle service_areas JSON separately
        if (updates.service_areas !== undefined) {
            setClauses.push(`service_areas = $${paramCount += 1}`);
            params.push(JSON.stringify(updates.service_areas));
        }

        if (setClauses.length === 0) throw new ValidationError('No valid fields to update');

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

    // ── Carrier quotes / rejections ──────────────────────────────────────────────

    /**
     * Find a carrier by its code string (e.g. 'DTDC', 'delhivery').
     */
    async findByCodeSimple(carrierCode, client = null) {
        const result = await this.query(
            'SELECT id, name FROM carriers WHERE code = $1 LIMIT 1',
            [carrierCode], client
        );
        return result.rows[0] || null;
    }

    /**
     * Insert an accepted carrier quote row.
     * `data.estimatedDeliveryDate` accepts an explicit date value from the carrier
     * API response; falls back to null when not supplied.
     */
    async createQuote(data, client = null) {
        const result = await this.query(
            `INSERT INTO carrier_quotes
               (order_id, carrier_id, quoted_price, currency, estimated_delivery_days,
                estimated_delivery_date, service_type, valid_until, breakdown, is_selected)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
             RETURNING *`,
            [
                data.orderId,
                data.carrierId,
                data.quotedPrice,
                data.currency || 'INR',
                data.estimatedDeliveryDays,
                data.estimatedDeliveryDate || null,
                data.serviceType,
                data.validUntil,
                JSON.stringify(data.breakdown || {}),
            ],
            client
        );
        return result.rows[0];
    }

    /**
     * Insert a carrier rejection row.
     */
    async createRejection(data, client = null) {
        const result = await this.query(
            `INSERT INTO carrier_rejections
               (order_id, carrier_name, carrier_code, reason, message, rejected_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING *`,
            [data.orderId, data.carrierName, data.carrierCode, data.reason, data.message],
            client
        );
        return result.rows[0];
    }

    /**
     * Fetch all accepted quotes for an order, joined with carrier info.
     */
    async findQuotesByOrder(orderId, client = null) {
        const result = await this.query(
            `SELECT cq.*, c.name AS carrier_name, c.code AS carrier_code
             FROM carrier_quotes cq
             JOIN carriers c ON c.id = cq.carrier_id
             WHERE cq.order_id = $1
             ORDER BY cq.created_at DESC`,
            [orderId], client
        );
        return result.rows;
    }

    /**
     * Fetch all rejections for an order.
     */
    async findRejectionsByOrder(orderId, client = null) {
        const result = await this.query(
            'SELECT * FROM carrier_rejections WHERE order_id = $1',
            [orderId], client
        );
        return result.rows;
    }

    /**
     * Return a single active carrier by primary key.
     * Lightweight — no aggregate subqueries.
     */
    async findActiveById(id, client = null) {
        const result = await this.query(
            'SELECT * FROM carriers WHERE id = $1 AND is_active = true',
            [id], client
        );
        return result.rows[0] || null;
    }

    /**
     * Fetch reliability_score for multiple carrier codes in one query.
     * Returns a plain object keyed by carrier code: { DHL: 0.95, FEDEX: 0.92, ... }
     *
     * @param {string[]} codes
     * @param {object|null} client
     * @returns {Promise<Record<string, number>>}
     */
    async findReliabilityScoresByCode(codes, client = null) {
        if (!codes.length) return {};
        const result = await this.query(
            `SELECT code, COALESCE(reliability_score, 0.80) AS reliability_score
             FROM carriers
             WHERE code = ANY($1) AND is_active = true`,
            [codes], client
        );
        return result.rows.reduce((acc, row) => {
            acc[row.code] = parseFloat(row.reliability_score);
            return acc;
        }, {});
    }

    /**
     * Fetch the reliability_score for a single carrier code.
     * Returns null when no active carrier matches.
     *
     * @param {string} code
     * @param {object|null} client
     * @returns {Promise<number|null>}
     */
    async findReliabilityScoreByCode(code, client = null) {
        const result = await this.query(
            `SELECT COALESCE(reliability_score, 0.80) AS reliability_score
             FROM carriers WHERE code = $1 AND is_active = true LIMIT 1`,
            [code], client
        );
        return result.rows.length > 0 ? parseFloat(result.rows[0].reliability_score) : null;
    }

    /**
     * Find eligible/available carriers for order carrier assignment.
     * Returns up to `limit` active carriers in availability with matching service type.
     *
     * @param {string} serviceType
     * @param {number} limit
     * @param {object|null} client
     * @returns {Promise<Array>}
     */
    async findEligibleCarriers(serviceType, limit = 3, client = null) {
        const result = await this.query(
            `SELECT id, code, name, contact_email, service_type, is_active, availability_status
             FROM carriers
             WHERE is_active = true
               AND availability_status = 'available'
               AND (service_type = $1 OR service_type = 'all')
             ORDER BY reliability_score DESC
             LIMIT $2`,
            [serviceType, limit],
            client
        );
        return result.rows;
    }

    /**
     * Insert a new carrier assignment row inside a transaction.
     * Returns the created row.
     *
     * @param {object} data  - assignment fields
     * @param {object} client - pg transaction client (required)
     */
    async createCarrierAssignment(data, client) {
        const result = await this.query(
            `INSERT INTO carrier_assignments
               (order_id, carrier_id, organization_id, service_type, status, pickup_address, delivery_address,
                estimated_pickup, estimated_delivery, request_payload, expires_at, idempotency_key)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id, carrier_id, order_id, organization_id, status, created_at`,
            [
                data.orderId, data.carrierId, data.organizationId || null, data.serviceType, data.status || 'pending',
                data.pickupAddress, data.deliveryAddress,
                data.estimatedPickup, data.estimatedDelivery,
                JSON.stringify(data.requestPayload), data.expiresAt, data.idempotencyKey,
            ],
            client
        );
        return result.rows[0];
    }

    // ─────────────────────────────────────────────────────────────
    // ACTIVE-CARRIER FINDERS (used by quote & assignment services)
    // ─────────────────────────────────────────────────────────────

    /**
     * Return all active carriers that have an API endpoint configured.
     * Used for the PUSH (API) quoting model.
     */
    async findActiveWithApiEndpoint(client = null) {
        const result = await this.query(
            `SELECT id, name, code, api_endpoint, api_key_encrypted,
                    is_active, availability_status, api_timeout_ms
             FROM carriers
             WHERE is_active = true AND api_endpoint IS NOT NULL`,
            [],
            client
        );
        return result.rows;
    }

    /**
     * Return every active carrier regardless of API configuration.
     * Used to build the full pending-assignment list (PULL / portal model).
     */
    async findAllActive(client = null) {
        const result = await this.query(
            `SELECT id, name, code, api_endpoint, api_key_encrypted,
                    is_active, availability_status, api_timeout_ms
             FROM carriers
             WHERE is_active = true`,
            [],
            client
        );
        return result.rows;
    }

    // ─────────────────────────────────────────────────────────────
    // QUOTE SELECTION
    // ─────────────────────────────────────────────────────────────

    /**
     * Clear the is_selected flag from every quote belonging to an order.
     * Always call this before selectQuoteById to keep exactly one selection.
     */
    async deselectAllQuotesForOrder(orderId, client = null) {
        await this.query(
            'UPDATE carrier_quotes SET is_selected = false WHERE order_id = $1',
            [orderId],
            client
        );
    }

    /**
     * Mark a single quote as selected.
     * Returns the updated row or null if not found.
     */
    async selectQuoteById(quoteId, client = null) {
        const result = await this.query(
            'UPDATE carrier_quotes SET is_selected = true WHERE id = $1 RETURNING *',
            [quoteId],
            client
        );
        return result.rows[0] || null;
    }

    /**
     * Find rate card for a carrier + service type combination.
     * Used by deliveryChargeService to price shipments.
     */
    async findRateByServiceType(carrierId, serviceType, client = null) {
        const result = await this.query(
            `SELECT base_rate, rate_per_kg, fuel_surcharge_percent, min_charge_amount
             FROM rate_cards
             WHERE carrier_id = $1 AND service_type = $2
             LIMIT 1`,
            [carrierId, serviceType], client
        );
        return result.rows[0] || null;
    }

    /**
     * Find warehouse details by id, for payload building.
     */
    async findWarehouseById(warehouseId, client = null) {
        const result = await this.query(
            `SELECT id, code, name, address, address_line1, address_line2, city, state,
                    postal_code, country, latitude, longitude, contact_person, contact_phone
             FROM warehouses
             WHERE id = $1`,
            [warehouseId], client
        );
        return result.rows[0] || null;
    }

    /**
     * Find carrier by ID, returning webhook-specific config fields.
     */
    async findByIdWithWebhookConfig(id, client = null) {
        const result = await this.query(
            `SELECT id, code, name, webhook_secret, webhook_enabled, ip_whitelist
             FROM carriers
             WHERE id = $1`,
            [id], client
        );
        return result.rows[0] || null;
    }

    /**
     * Log a webhook attempt for audit trail.
     */
    async logWebhookAttempt(data, client = null) {
        await this.query(
            `INSERT INTO webhook_logs
             (carrier_id, endpoint, method, request_signature, request_timestamp,
              signature_valid, ip_address, user_agent, payload, headers,
              response_status, error_message, processing_time_ms)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                data.carrierId, data.endpoint, data.method, data.requestSignature,
                data.requestTimestamp, data.signatureValid, data.ipAddress,
                data.userAgent, data.payload, data.headers,
                data.responseStatus, data.errorMessage, data.processingTimeMs
            ],
            client
        );
    }

    /**
     * Get carrier performance report for a date range.
     */
    async getPerformanceReport(carrierId, startDate, endDate, client = null) {
        const result = await this.query(
            `SELECT
               c.id AS carrier_id,
               c.code AS carrier_code,
               c.name AS carrier_name,
               COALESCE(SUM(m.total_shipments), 0)     AS total_shipments,
               COALESCE(SUM(m.delivered_on_time), 0)   AS on_time_deliveries,
               COALESCE(SUM(m.delivered_late), 0)      AS late_deliveries,
               COALESCE(SUM(m.failed_deliveries), 0)   AS failed_deliveries,
               ROUND(
                 CASE WHEN SUM(m.total_shipments) > 0
                      THEN SUM(m.delivered_on_time)::DECIMAL / SUM(m.total_shipments) * 100
                      ELSE NULL END, 2
               ) AS on_time_rate_pct,
               ROUND(AVG(m.avg_delivery_hours), 1) AS avg_delivery_hours,
               c.reliability_score AS current_reliability_score
             FROM carriers c
             LEFT JOIN carrier_performance_metrics m
               ON m.carrier_id = c.id
               AND m.period_start >= $2
               AND m.period_end   <= $3
             WHERE c.is_active = true
               AND ($1::uuid IS NULL OR c.id = $1)
             GROUP BY c.id, c.code, c.name, c.reliability_score
             ORDER BY on_time_rate_pct DESC NULLS LAST`,
            [carrierId || null, startDate || '1900-01-01', endDate || 'now()'],
            client
        );
        return result.rows;
    }

    /**
     * Update selection reason on a carrier quote.
     */
    async updateQuoteSelectionReason(orderId, carrierId, reason, client = null) {
        await this.query(
            `UPDATE carrier_quotes
             SET selection_reason = $1
             WHERE order_id = $2 AND carrier_id = $3`,
            [reason, orderId, carrierId],
            client
        );
    }
}

export default new CarrierRepository();
