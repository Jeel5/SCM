// Returns Service - Pickup scheduling, RMA workflow, and refund processing
import pool from '../configs/db.js';
import { NotFoundError, BusinessLogicError } from '../errors/index.js';
import { logEvent } from '../utils/logger.js';

class ReturnsService {
  /**
   * Schedule pickup for return
   */
  async schedulePickup(returnId, pickupDate, timeSlot, pickupAddress) {
    const result = await pool.query(
      `UPDATE returns
       SET pickup_scheduled_date = $1,
           pickup_time_slot = $2,
           pickup_address = $3,
           status = 'pickup_scheduled'
       WHERE id = $4 AND status IN ('requested', 'approved')
       RETURNING *`,
      [pickupDate, timeSlot, JSON.stringify(pickupAddress), returnId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Return not found or not in correct status');
    }

    logEvent('ReturnPickupScheduled', {
      returnId,
      rmaNumber: result.rows[0].rma_number,
      pickupDate,
      timeSlot
    });

    return result.rows[0];
  }

  /**
   * Mark pickup as completed
   */
  async completePickup(returnId, carrierNotes) {
    const result = await pool.query(
      `UPDATE returns
       SET pickup_completed_at = NOW(),
           status = 'in_transit'
       WHERE id = $1 AND status = 'pickup_scheduled'
       RETURNING *`,
      [returnId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Return not found or pickup not scheduled');
    }

    logEvent('ReturnPickupCompleted', {
      returnId,
      rmaNumber: result.rows[0].rma_number
    });

    return result.rows[0];
  }

  /**
   * Receive and inspect returned items at warehouse
   */
  async inspectReturn(returnId, qualityCheckResult, inspectionNotes, inspectedBy) {
    try {
      const result = await withTransaction(async (tx) => {
        // Get return details
        const returnResult = await tx.query(
          'SELECT * FROM returns WHERE id = $1',
          [returnId]
        );

        if (returnResult.rows.length === 0) {
          throw new NotFoundError('Return not found');
        }

        const returnData = returnResult.rows[0];

        // Update return with inspection results
        const updateResult = await tx.query(
          `UPDATE returns
           SET quality_check_result = $1,
               inspection_notes = $2,
               status = 'inspected'
           WHERE id = $3
           RETURNING *`,
          [qualityCheckResult, inspectionNotes, returnId]
        );

        // If quality check passed, add items back to inventory
        if (qualityCheckResult === 'passed') {
          const itemsResult = await tx.query(
            `SELECT ri.*, oi.warehouse_id, p.sku
             FROM return_items ri
             JOIN order_items oi ON oi.id = ri.order_item_id
             JOIN products p ON p.id = ri.product_id
             WHERE ri.return_id = $1`,
            [returnId]
          );

          for (const item of itemsResult.rows) {
            // Add back to available inventory
            await tx.query(
              `INSERT INTO inventory (warehouse_id, product_id, available_quantity)
               VALUES ($1, $2, $3)
               ON CONFLICT (warehouse_id, product_id)
               DO UPDATE SET available_quantity = inventory.available_quantity + $3`,
              [item.warehouse_id, item.product_id, item.quantity]
            );

            // Record stock movement
            await tx.query(
              `INSERT INTO stock_movements 
              (warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, notes)
              VALUES ($1, $2, 'inbound', $3, 'return', $4, $5)`,
              [
                item.warehouse_id,
                item.product_id,
                item.quantity,
                returnId,
                `Return inspection passed: ${inspectionNotes}`
              ]
            );
          }
        } else {
          // Mark as damaged inventory
          const itemsResult = await tx.query(
            `SELECT ri.*, oi.warehouse_id
             FROM return_items ri
             JOIN order_items oi ON oi.id = ri.order_item_id
             WHERE ri.return_id = $1`,
            [returnId]
          );

          for (const item of itemsResult.rows) {
            await tx.query(
              `UPDATE inventory
               SET damaged_quantity = damaged_quantity + $1
               WHERE warehouse_id = $2 AND product_id = $3`,
              [item.quantity, item.warehouse_id, item.product_id]
            );
          }
        }

        return { returnData, updatedReturn: updateResult.rows[0] };
      });

      logEvent('ReturnInspected', {
        returnId,
        rmaNumber: result.returnData.rma_number,
        qualityCheckResult,
        inspectedBy
      });

      return result.updatedReturn;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Process refund for return
   */
  async processRefund(returnId, refundMethod, refundReference, processedBy) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get return details
      const returnResult = await client.query(
        `SELECT r.*, o.total_amount
         FROM returns r
         JOIN orders o ON o.id = r.order_id
         WHERE r.id = $1`,
        [returnId]
      );

      if (returnResult.rows.length === 0) {
        throw new NotFoundError('Return not found');
      }

      const returnData = returnResult.rows[0];

      if (returnData.status !== 'inspected') {
        throw new BusinessLogicError('Return must be inspected before processing refund');
      }

      if (returnData.quality_check_result === 'failed') {
        throw new BusinessLogicError('Cannot refund - quality check failed');
      }

      // Calculate refund amount (with restocking fee if applicable)
      let refundAmount = returnData.refund_amount || returnData.total_amount;
      const restockingFee = returnData.restocking_fee || 0;
      refundAmount = refundAmount - restockingFee;

      // Update return with refund information
      const updateResult = await client.query(
        `UPDATE returns
         SET status = 'refunded',
             refund_amount = $1,
             refund_method = $2,
             refund_reference = $3,
             refund_initiated_at = NOW(),
             refund_completed_at = NOW(),
             resolved_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [refundAmount, refundMethod, refundReference, returnId]
      );

      // Create refund record in finance (for tracking)
      await client.query(
        `INSERT INTO invoices 
        (invoice_number, carrier_id, total_shipments, base_amount, final_amount, status)
        VALUES ($1, NULL, 0, $2, $3, 'paid')`,
        [`REFUND-${returnData.rma_number}`, -refundAmount, -refundAmount]
      );

      await client.query('COMMIT');

      logEvent('RefundProcessed', {
        returnId,
        rmaNumber: returnData.rma_number,
        refundAmount,
        refundMethod,
        processedBy
      });

      return updateResult.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reject return with reason
   */
  async rejectReturn(returnId, reason, rejectedBy) {
    const result = await pool.query(
      `UPDATE returns
       SET status = 'rejected',
           inspection_notes = $1,
           resolved_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [reason, returnId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Return not found');
    }

    logEvent('ReturnRejected', {
      returnId,
      rmaNumber: result.rows[0].rma_number,
      reason,
      rejectedBy
    });

    return result.rows[0];
  }

  /**
   * Get return with items
   */
  async getReturnWithItems(returnId) {
    const returnResult = await pool.query(
      `SELECT r.*, o.order_number, o.customer_name
       FROM returns r
       JOIN orders o ON o.id = r.order_id
       WHERE r.id = $1`,
      [returnId]
    );

    if (returnResult.rows.length === 0) {
      throw new NotFoundError('Return not found');
    }

    const returnData = returnResult.rows[0];

    // Get return items
    const itemsResult = await pool.query(
      `SELECT ri.*, p.name as product_name, p.sku
       FROM return_items ri
       JOIN products p ON p.id = ri.product_id
       WHERE ri.return_id = $1`,
      [returnId]
    );

    returnData.items = itemsResult.rows;

    return returnData;
  }

  /**
   * Get return analytics
   */
  async getReturnAnalytics(startDate, endDate) {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_returns,
        COUNT(CASE WHEN status = 'refunded' THEN 1 END) as completed_returns,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_returns,
        COUNT(CASE WHEN quality_check_result = 'passed' THEN 1 END) as quality_passed,
        COUNT(CASE WHEN quality_check_result = 'failed' THEN 1 END) as quality_failed,
        COALESCE(SUM(refund_amount), 0) as total_refunded,
        COALESCE(AVG(refund_amount), 0) as avg_refund_amount,
        COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - requested_at))/86400), 0) as avg_resolution_days
       FROM returns
       WHERE requested_at >= $1 AND requested_at < $2`,
      [startDate, endDate]
    );

    // Get top return reasons
    const reasonsResult = await pool.query(
      `SELECT reason, COUNT(*) as count
       FROM returns
       WHERE requested_at >= $1 AND requested_at < $2
       GROUP BY reason
       ORDER BY count DESC
       LIMIT 10`,
      [startDate, endDate]
    );

    return {
      summary: result.rows[0],
      topReasons: reasonsResult.rows
    };
  }
}

export default new ReturnsService();
