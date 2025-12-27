import pool from '../configs/db.js';

export async function listSlaPolicies(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM sla_policies WHERE is_active = true ORDER BY name ASC'
    );
    
    const policies = result.rows.map(p => ({
      id: p.id,
      name: p.name,
      serviceType: p.service_type,
      region: p.origin_region || 'All Regions',
      targetDeliveryHours: p.delivery_hours,
      warningThresholdHours: Math.floor(p.delivery_hours * 0.8),
      penaltyAmount: parseFloat(p.penalty_per_hour) || 10,
      penaltyType: 'fixed',
      isActive: p.is_active,
      createdAt: p.created_at
    }));
    
    res.json({ success: true, data: policies });
  } catch (error) {
    console.error('List SLA policies error:', error);
    res.status(500).json({ error: 'Failed to list SLA policies' });
  }
}

export async function getEta(req, res) {
  try {
    const { shipmentId } = req.params;
    
    const result = await pool.query(
      `SELECT ep.*, s.tracking_number FROM eta_predictions ep
       JOIN shipments s ON ep.shipment_id = s.id
       WHERE ep.shipment_id = $1
       ORDER BY ep.predicted_at DESC LIMIT 1`,
      [shipmentId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ETA not found' });
    }
    
    const eta = result.rows[0];
    res.json({
      success: true,
      data: {
        shipmentId: eta.shipment_id,
        trackingNumber: eta.tracking_number,
        predictedEta: eta.predicted_eta,
        confidenceScore: parseFloat(eta.confidence_score),
        factors: eta.factors,
        mlModel: eta.ml_model,
        predictedAt: eta.predicted_at
      }
    });
  } catch (error) {
    console.error('Get ETA error:', error);
    res.status(500).json({ error: 'Failed to get ETA' });
  }
}

export async function getSlaViolations(req, res) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT sv.*, s.tracking_number, sp.name as policy_name
      FROM sla_violations sv
      JOIN shipments s ON sv.shipment_id = s.id
      JOIN sla_policies sp ON sv.policy_id = sp.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      params.push(status);
      query += ` AND sv.status = $${params.length}`;
    }
    
    query += ` ORDER BY sv.violated_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await pool.query(query, params);
    
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM sla_violations' + (status ? ' WHERE status = $1' : ''),
      status ? [status] : []
    );
    
    res.json({
      success: true,
      data: result.rows.map(v => ({
        id: v.id,
        shipmentId: v.shipment_id,
        trackingNumber: v.tracking_number,
        policyId: v.policy_id,
        policyName: v.policy_name,
        status: v.status,
        violationReason: v.violation_reason,
        penaltyAmount: parseFloat(v.penalty_amount),
        violatedAt: v.violated_at,
        resolvedAt: v.resolved_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Get SLA violations error:', error);
    res.status(500).json({ error: 'Failed to get SLA violations' });
  }
}

export async function getSlaDashboard(req, res) {
  try {
    // Get overall SLA compliance rate
    const complianceResult = await pool.query(`
      SELECT 
        COUNT(*) as total_shipments,
        COUNT(CASE WHEN s.actual_delivery <= s.estimated_delivery THEN 1 END) as on_time
      FROM shipments s
      WHERE s.status = 'delivered'
        AND s.created_at >= NOW() - INTERVAL '30 days'
    `);
    
    const compliance = complianceResult.rows[0];
    const onTimeRate = compliance.total_shipments > 0 
      ? (parseInt(compliance.on_time) / parseInt(compliance.total_shipments) * 100).toFixed(1)
      : 100;
    
    // Get violations by status
    const violationsResult = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM sla_violations
      WHERE violated_at >= NOW() - INTERVAL '30 days'
      GROUP BY status
    `);
    
    // Get carrier performance
    const carrierResult = await pool.query(`
      SELECT c.name, c.reliability_score,
             COUNT(s.id) as shipment_count
      FROM carriers c
      LEFT JOIN shipments s ON s.carrier_id = c.id 
        AND s.created_at >= NOW() - INTERVAL '30 days'
      WHERE c.is_active = true
      GROUP BY c.id, c.name, c.reliability_score
      ORDER BY c.reliability_score DESC
      LIMIT 5
    `);
    
    res.json({
      success: true,
      data: {
        overallCompliance: parseFloat(onTimeRate),
        totalShipments: parseInt(compliance.total_shipments),
        onTimeDeliveries: parseInt(compliance.on_time),
        violations: violationsResult.rows.reduce((acc, v) => {
          acc[v.status] = parseInt(v.count);
          return acc;
        }, { pending: 0, resolved: 0, waived: 0 }),
        topCarriers: carrierResult.rows.map(c => ({
          name: c.name,
          reliabilityScore: parseFloat(c.reliability_score),
          shipmentCount: parseInt(c.shipment_count)
        }))
      }
    });
  } catch (error) {
    console.error('Get SLA dashboard error:', error);
    res.status(500).json({ error: 'Failed to get SLA dashboard' });
  }
}

export async function listExceptions(req, res) {
  try {
    const { page = 1, limit = 20, severity, status } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT se.*, s.tracking_number, o.order_number
      FROM shipment_exceptions se
      JOIN shipments s ON se.shipment_id = s.id
      LEFT JOIN orders o ON s.order_id = o.id
      WHERE 1=1
    `;
    const params = [];
    
    if (severity) {
      params.push(severity);
      query += ` AND se.severity = $${params.length}`;
    }
    
    if (status) {
      params.push(status);
      query += ` AND se.status = $${params.length}`;
    }
    
    query += ` ORDER BY se.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows.map(e => ({
        id: e.id,
        shipmentId: e.shipment_id,
        trackingNumber: e.tracking_number,
        orderNumber: e.order_number,
        exceptionType: e.exception_type,
        severity: e.severity,
        description: e.description,
        status: e.status,
        resolution: e.resolution,
        createdAt: e.created_at,
        resolvedAt: e.resolved_at
      }))
    });
  } catch (error) {
    console.error('List exceptions error:', error);
    res.status(500).json({ error: 'Failed to list exceptions' });
  }
}

export async function createException(req, res) {
  try {
    const { shipmentId, exceptionType, severity, description } = req.body;
    
    const result = await pool.query(
      `INSERT INTO shipment_exceptions (shipment_id, exception_type, severity, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [shipmentId, exceptionType, severity, description]
    );
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Create exception error:', error);
    res.status(500).json({ error: 'Failed to create exception' });
  }
}

export async function resolveException(req, res) {
  try {
    const { id } = req.params;
    const { resolution } = req.body;
    
    const result = await pool.query(
      `UPDATE shipment_exceptions SET status = 'resolved', resolution = $1, resolved_at = NOW()
       WHERE id = $2 RETURNING *`,
      [resolution, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Exception not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Resolve exception error:', error);
    res.status(500).json({ error: 'Failed to resolve exception' });
  }
}
