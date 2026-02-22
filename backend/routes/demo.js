// Demo routes — Development / testing only
// ALL endpoints in this file return 404 in production
// These support the Customer Portal and Carrier Portal demo pages in the frontend
import express from 'express';
import pool from '../configs/db.js';

const router = express.Router();

// Guard middleware: block in production
const devOnly = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Not found' });
  }
  next();
};

// ─────────────────────────────────────────────────────────
// GET /api/demo/organizations
// Returns all active organizations with webhook tokens.
// Used by Customer Portal demo to populate the org selector.
// ─────────────────────────────────────────────────────────
router.get('/demo/organizations', devOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, code, webhook_token
       FROM organizations
       WHERE is_active = true
       ORDER BY name`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/demo/carriers
// Returns active carriers for the Carrier Portal demo.
// ─────────────────────────────────────────────────────────
router.get('/demo/carriers', devOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, code, is_active, availability_status
       FROM carriers
       WHERE is_active = true
       ORDER BY name`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/demo/carrier-shipments/:carrierCode
// Returns shipments assigned to a carrier (by carrier code).
// Carrier portal uses this to show pending pickups & active deliveries.
// Query params: status, page, limit
// ─────────────────────────────────────────────────────────
router.get('/demo/carrier-shipments/:carrierCode', devOnly, async (req, res) => {
  try {
    const { carrierCode } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const { status } = req.query;
    const offset = (page - 1) * limit;

    const params = [carrierCode.toUpperCase()];
    let whereExtra = '';

    if (status) {
      params.push(status);
      whereExtra = ` AND s.status = $${params.length}`;
    }

    const baseQuery = `
      FROM shipments s
      LEFT JOIN carriers c ON s.carrier_id = c.id
      LEFT JOIN orders o ON s.order_id = o.id
      WHERE c.code = $1${whereExtra}
    `;

    const countResult = await pool.query(`SELECT COUNT(*) ${baseQuery}`, params);
    const total = parseInt(countResult.rows[0].count) || 0;

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT
         s.id,
         s.tracking_number,
         s.status,
         s.origin_address,
         s.destination_address,
         s.estimated_delivery,
         s.weight,
         s.created_at,
         s.updated_at,
         o.order_number,
         o.customer_name,
         o.customer_phone,
         c.name  AS carrier_name,
         c.code  AS carrier_code
       ${baseQuery}
       ORDER BY s.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: dataResult.rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/demo/carrier/update-status
// Allows the demo Carrier Portal to update a shipment status
// without an HMAC signature (would be required in production).
// Body: { tracking_number, status, city?, description? }
// ─────────────────────────────────────────────────────────
router.post('/demo/carrier/update-status', devOnly, async (req, res) => {
  try {
    const { tracking_number, status, city, description } = req.body;

    if (!tracking_number || !status) {
      return res.status(400).json({
        success: false,
        message: 'tracking_number and status are required',
      });
    }

    const VALID_STATUSES = [
      'pending', 'manifested', 'picked_up', 'in_transit',
      'at_hub', 'out_for_delivery', 'delivered',
      'failed_delivery', 'rto_initiated', 'returned', 'lost',
    ];

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const shipment = await pool.query(
      'SELECT id, status as current_status FROM shipments WHERE tracking_number = $1',
      [tracking_number]
    );

    if (!shipment.rows.length) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    const { id: shipmentId, current_status } = shipment.rows[0];

    // Update shipment status
    await pool.query(
      'UPDATE shipments SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, shipmentId]
    );

    // Insert event into shipment_events
    await pool.query(
      `INSERT INTO shipment_events
         (shipment_id, event_type, event_code, status, city, description, source, event_timestamp)
       VALUES ($1, 'status_update', $2, $3, $4, $5, 'carrier_portal_demo', NOW())`,
      [
        shipmentId,
        status.toUpperCase(),
        status,
        city || null,
        description || `Status updated from ${current_status} to ${status} via Carrier Portal`,
      ]
    );

    res.json({
      success: true,
      message: `Shipment ${tracking_number} updated to "${status}"`,
      data: { shipmentId, tracking_number, previous_status: current_status, new_status: status },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
