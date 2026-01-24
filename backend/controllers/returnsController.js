import pool from '../configs/db.js';

export async function listReturns(req, res) {
  try {
    const { page = 1, limit = 20, status, reason } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT r.*, o.order_number, p.name as product_name, p.sku, ri.product_id
      FROM returns r
      JOIN orders o ON r.order_id = o.id
      LEFT JOIN return_items ri ON ri.return_id = r.id
      LEFT JOIN products p ON ri.product_id = p.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      params.push(status);
      query += ` AND r.status = $${params.length}`;
    }
    
    if (reason) {
      params.push(reason);
      query += ` AND r.reason = $${params.length}`;
    }
    
    query += ` ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await pool.query(query, params);
    
    const countResult = await pool.query(`
      SELECT COUNT(*) FROM returns r WHERE 1=1
      ${status ? 'AND r.status = $1' : ''}
      ${reason ? `AND r.reason = $${status ? '2' : '1'}` : ''}
    `, [status, reason].filter(Boolean));
    
    res.json({
      success: true,
      data: result.rows.map(r => ({
        id: r.id,
        rmaNumber: r.rma_number,
        orderId: r.order_id,
        orderNumber: r.order_number,
        productId: r.product_id,
        productName: r.product_name,
        sku: r.sku,
        quantity: r.quantity,
        reason: r.reason,
        status: r.status,
        refundAmount: parseFloat(r.refund_amount),
        restockFee: parseFloat(r.restock_fee),
        returnTrackingNumber: r.return_tracking_number,
        notes: r.notes,
        createdAt: r.created_at,
        processedAt: r.processed_at,
        completedAt: r.completed_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count)
      }
    });
  } catch (error) {
    console.error('List returns error:', error);
    res.status(500).json({ error: 'Failed to list returns' });
  }
}

export async function getReturn(req, res) {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT r.*, o.order_number, p.name as product_name, p.sku,
             o.shipping_address as customer_address
      FROM returns r
      JOIN orders o ON r.order_id = o.id
      LEFT JOIN products p ON r.product_id = p.id
      WHERE r.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Return not found' });
    }
    
    const r = result.rows[0];
    res.json({
      success: true,
      data: {
        id: r.id,
        rmaNumber: r.rma_number,
        orderId: r.order_id,
        orderNumber: r.order_number,
        productId: r.product_id,
        productName: r.product_name,
        sku: r.sku,
        quantity: r.quantity,
        reason: r.reason,
        status: r.status,
        refundAmount: parseFloat(r.refund_amount),
        restockFee: parseFloat(r.restock_fee),
        returnTrackingNumber: r.return_tracking_number,
        notes: r.notes,
        customerAddress: r.customer_address,
        createdAt: r.created_at,
        processedAt: r.processed_at,
        completedAt: r.completed_at
      }
    });
  } catch (error) {
    console.error('Get return error:', error);
    res.status(500).json({ error: 'Failed to get return' });
  }
}

export async function createReturn(req, res) {
  try {
    const { orderId, productId, quantity, reason, notes } = req.body;
    
    // Generate RMA number
    const rmaNumber = `RMA-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    const result = await pool.query(
      `INSERT INTO returns (rma_number, order_id, product_id, quantity, reason, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [rmaNumber, orderId, productId, quantity, reason, notes]
    );
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Create return error:', error);
    res.status(500).json({ error: 'Failed to create return' });
  }
}

export async function updateReturn(req, res) {
  try {
    const { id } = req.params;
    const { status, refundAmount, restockFee, returnTrackingNumber, notes } = req.body;
    
    let updateFields = [];
    const params = [id];
    let paramIndex = 2;
    
    if (status) {
      updateFields.push(`status = $${paramIndex++}`);
      params.push(status);
      
      if (status === 'processing') {
        updateFields.push(`processed_at = NOW()`);
      } else if (status === 'completed' || status === 'refunded') {
        updateFields.push(`completed_at = NOW()`);
      }
    }
    
    if (refundAmount !== undefined) {
      updateFields.push(`refund_amount = $${paramIndex++}`);
      params.push(refundAmount);
    }
    
    if (restockFee !== undefined) {
      updateFields.push(`restock_fee = $${paramIndex++}`);
      params.push(restockFee);
    }
    
    if (returnTrackingNumber) {
      updateFields.push(`return_tracking_number = $${paramIndex++}`);
      params.push(returnTrackingNumber);
    }
    
    if (notes) {
      updateFields.push(`notes = $${paramIndex++}`);
      params.push(notes);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const result = await pool.query(
      `UPDATE returns SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      params
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Return not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update return error:', error);
    res.status(500).json({ error: 'Failed to update return' });
  }
}

export async function getReturnStats(req, res) {
  try {
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_returns,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COALESCE(SUM(refund_amount), 0) as total_refunds,
        COALESCE(SUM(restock_fee), 0) as total_restock_fees
      FROM returns
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);
    
    const reasonsResult = await pool.query(`
      SELECT reason, COUNT(*) as count
      FROM returns
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY reason
      ORDER BY count DESC
    `);
    
    const stats = statsResult.rows[0];
    
    res.json({
      success: true,
      data: {
        totalReturns: parseInt(stats.total_returns),
        byStatus: {
          pending: parseInt(stats.pending),
          approved: parseInt(stats.approved),
          processing: parseInt(stats.processing),
          completed: parseInt(stats.completed),
          rejected: parseInt(stats.rejected)
        },
        totalRefunds: parseFloat(stats.total_refunds),
        totalRestockFees: parseFloat(stats.total_restock_fees),
        byReason: reasonsResult.rows.map(r => ({
          reason: r.reason,
          count: parseInt(r.count)
        }))
      }
    });
  } catch (error) {
    console.error('Get return stats error:', error);
    res.status(500).json({ error: 'Failed to get return stats' });
  }
}
