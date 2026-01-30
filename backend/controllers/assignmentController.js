import pool from '../configs/db.js';
import carrierAssignmentService from '../services/carrierAssignmentService.js';
import logger from '../utils/logger.js';

// ========== CARRIER ASSIGNMENTS ==========

/**
 * Request carrier assignment for an order
 * POST /api/orders/{orderId}/request-carriers
 */
export async function requestCarrierAssignment(req, res) {
  try {
    const { orderId } = req.params;
    const { force } = req.query;

    // Get order details with items
    const orderResult = await pool.query(
      `SELECT o.*, 
              JSON_AGG(
                JSON_BUILD_OBJECT(
                  'id', oi.id,
                  'productId', oi.product_id,
                  'productName', oi.product_name,
                  'sku', oi.sku,
                  'quantity', oi.quantity,
                  'unitPrice', oi.unit_price
                ) ORDER BY oi.created_at
              ) FILTER (WHERE oi.id IS NOT NULL) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.id = $1
       GROUP BY o.id`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Check if assignment already exists (unless force flag)
    if (!force) {
      const existingResult = await pool.query(
        `SELECT id, status FROM carrier_assignments 
         WHERE order_id = $1 AND status NOT IN ('rejected', 'cancelled')`,
        [orderId]
      );

      if (existingResult.rows.length > 0) {
        return res.json({
          success: true,
          data: {
            orderId,
            message: 'Assignment request already exists',
            existingAssignments: existingResult.rows
          }
        });
      }
    }

    const result = await carrierAssignmentService.requestCarrierAssignment(
      orderId,
      { items: order.items || [] }
    );

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error('Request carrier assignment error:', error);
    res.status(500).json({ error: error.message || 'Failed to request carrier assignment' });
  }
}

/**
 * Get pending assignments for current carrier
 * GET /api/carriers/assignments/pending
 */
export async function getPendingAssignments(req, res) {
  try {
    // Get carrier ID or code from query
    const { carrierId } = req.query;
    
    if (!carrierId) {
      return res.status(400).json({ error: 'carrierId required' });
    }

    // Check if carrierId is a code (e.g., "DHL-001") or numeric ID
    let actualCarrierId = carrierId;
    if (isNaN(carrierId)) {
      // Look up carrier by code
      const carrierResult = await pool.query(
        'SELECT id FROM carriers WHERE code = $1',
        [carrierId]
      );
      
      if (carrierResult.rows.length === 0) {
        return res.status(404).json({ error: `Carrier not found: ${carrierId}` });
      }
      
      actualCarrierId = carrierResult.rows[0].id;
    }

    const result = await carrierAssignmentService.getPendingAssignments(actualCarrierId, {
      status: req.query.status,
      serviceType: req.query.serviceType
    });

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Get pending assignments error:', error);
    res.status(500).json({ error: 'Failed to get pending assignments' });
  }
}

/**
 * Get assignment details
 * GET /api/assignments/{assignmentId}
 */
export async function getAssignmentDetails(req, res) {
  try {
    const { assignmentId } = req.params;

    const result = await pool.query(
      `SELECT 
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
       WHERE ca.id = $1`,
      [assignmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const row = result.rows[0];
    const assignment = {
      id: row.id,
      orderId: row.order_id,
      carrierId: row.carrier_id,
      carrierCode: row.carrier_code,
      carrierName: row.carrier_name,
      carrierEmail: row.carrier_email,
      carrierPhone: row.carrier_phone,
      serviceType: row.service_type,
      status: row.status,
      orderNumber: row.order_number,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      totalAmount: parseFloat(row.total_amount),
      shippingAddress: row.shipping_address,
      carrierReferenceId: row.carrier_reference_id,
      requestedAt: row.requested_at,
      acceptedAt: row.accepted_at,
      expiresAt: row.expires_at,
      requestPayload: JSON.parse(row.request_payload),
      acceptancePayload: row.acceptance_payload ? JSON.parse(row.acceptance_payload) : null
    };

    res.json({ success: true, data: assignment });
  } catch (error) {
    logger.error('Get assignment details error:', error);
    res.status(500).json({ error: 'Failed to get assignment details' });
  }
}

/**
 * Accept a carrier assignment
 * POST /api/assignments/{assignmentId}/accept
 */
export async function acceptAssignment(req, res) {
  try {
    const { assignmentId } = req.params;
    const { carrierId } = req.query;
    const acceptanceData = req.body;

    if (!carrierId) {
      return res.status(400).json({ error: 'carrierId required' });
    }

    const result = await carrierAssignmentService.acceptAssignment(
      assignmentId,
      carrierId,
      acceptanceData
    );

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Accept assignment error:', error);
    res.status(500).json({ error: error.message || 'Failed to accept assignment' });
  }
}

/**
 * Reject a carrier assignment
 * POST /api/assignments/{assignmentId}/reject
 */
export async function rejectAssignment(req, res) {
  try {
    const { assignmentId } = req.params;
    const { carrierId } = req.query;
    const { reason } = req.body;

    if (!carrierId) {
      return res.status(400).json({ error: 'carrierId required' });
    }

    const result = await carrierAssignmentService.rejectAssignment(
      assignmentId,
      carrierId,
      reason
    );

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Reject assignment error:', error);
    res.status(500).json({ error: error.message || 'Failed to reject assignment' });
  }
}

/**
 * Get all assignments for an order
 * GET /api/orders/{orderId}/assignments
 */
export async function getOrderAssignments(req, res) {
  try {
    const { orderId } = req.params;

    const result = await pool.query(
      `SELECT 
        ca.id, ca.order_id, ca.carrier_id, ca.status,
        ca.requested_at, ca.accepted_at, ca.expires_at,
        c.code, c.name, c.service_type,
        COUNT(CASE WHEN ca.status = 'accepted' THEN 1 END) as accepted_count
       FROM carrier_assignments ca
       JOIN carriers c ON ca.carrier_id = c.id
       WHERE ca.order_id = $1
       GROUP BY ca.id, ca.order_id, ca.carrier_id, ca.status,
                ca.requested_at, ca.accepted_at, ca.expires_at,
                c.code, c.name, c.service_type
       ORDER BY ca.requested_at DESC`,
      [orderId]
    );

    const assignments = result.rows.map(row => ({
      id: row.id,
      orderId: row.order_id,
      carrierId: row.carrier_id,
      carrierCode: row.code,
      carrierName: row.name,
      serviceType: row.service_type,
      status: row.status,
      requestedAt: row.requested_at,
      acceptedAt: row.accepted_at,
      expiresAt: row.expires_at
    }));

    res.json({ success: true, data: assignments });
  } catch (error) {
    logger.error('Get order assignments error:', error);
    res.status(500).json({ error: 'Failed to get order assignments' });
  }
}

/**
 * Mark assignment as busy (temporary rejection - can be accepted later)
 * POST /api/assignments/{assignmentId}/busy?carrierId={carrierId}
 */
export async function markAsBusy(req, res) {
  try {
    const { assignmentId } = req.params;
    const { carrierId } = req.query;
    const { reason } = req.body;

    if (!carrierId) {
      return res.status(400).json({ error: 'Carrier ID required' });
    }

    // Update assignment status to 'busy'
    const result = await pool.query(
      `UPDATE carrier_assignments
       SET status = 'busy',
           rejected_reason = $1,
           updated_at = NOW()
       WHERE id = $2 AND carrier_id = (SELECT id FROM carriers WHERE code = $3)
       RETURNING *`,
      [reason || 'At capacity - can accept later', assignmentId, carrierId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found or unauthorized' });
    }

    logger.info(`Assignment ${assignmentId} marked as busy by carrier ${carrierId}`);

    res.json({
      success: true,
      message: 'Assignment marked as busy. You can accept later if still available.',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Mark assignment busy error:', error);
    res.status(500).json({ error: 'Failed to mark assignment as busy' });
  }
}

/**
 * Carrier notifies they are now available/active
 * POST /api/carriers/:code/availability
 */
export async function updateCarrierAvailability(req, res) {
  try {
    const { code } = req.params;
    const { status } = req.body; // 'available', 'busy', 'offline'
    
    if (!code) {
      return res.status(400).json({ error: 'Carrier code required' });
    }
    
    if (!status || !['available', 'busy', 'offline'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: available, busy, or offline' });
    }
    
    // Update carrier status and get pending assignments if becoming available
    if (status === 'available') {
      const result = await carrierAssignmentService.notifyCarrierOfPendingAssignments(code);
      res.json(result);
    } else {
      // Just update status
      await pool.query(
        `UPDATE carriers 
         SET availability_status = $1, last_status_change = NOW()
         WHERE code = $2`,
        [status, code]
      );
      
      res.json({ 
        success: true,
        message: `Carrier ${code} status updated to ${status}`
      });
    }
  } catch (error) {
    logger.error('Update carrier availability error:', error);
    res.status(500).json({ error: error.message || 'Failed to update availability' });
  }
}
