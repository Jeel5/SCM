// Smart Carrier Assignment Retry Job
// Handles automatic retry logic for orders that need carrier reassignment

import pool from '../configs/db.js';
import logger from '../utils/logger.js';
import carrierAssignmentService from '../services/carrierAssignmentService.js';

class AssignmentRetryService {
  /**
   * Process expired assignments and retry with next batch of carriers
   * Runs every 30 minutes
   */
  async processExpiredAssignments() {
    try {
      logger.info('Processing expired carrier assignments...');

      // Find assignments that have expired (24h+ with no response)
      const expiredResult = await pool.query(
        `SELECT DISTINCT ca.order_id, o.* 
         FROM carrier_assignments ca
         JOIN orders o ON ca.order_id = o.id
         WHERE ca.status = 'pending' 
         AND ca.expires_at < NOW()
         AND o.status NOT IN ('shipped', 'delivered', 'cancelled')
         GROUP BY ca.order_id, o.id
         HAVING COUNT(*) < 9`, // Max 3 batches (9 carriers)
        []
      );

      logger.info(`Found ${expiredResult.rows.length} orders with expired assignments`);

      for (const order of expiredResult.rows) {
        // Mark old assignments as expired
        await pool.query(
          `UPDATE carrier_assignments 
           SET status = 'expired', updated_at = NOW()
           WHERE order_id = $1 AND status = 'pending'`,
          [order.id]
        );

        // Count how many batches have been tried
        const countResult = await pool.query(
          `SELECT COUNT(DISTINCT carrier_id) as tried_count
           FROM carrier_assignments
           WHERE order_id = $1`,
          [order.id]
        );

        const triedCount = parseInt(countResult.rows[0].tried_count);

        if (triedCount >= 9) {
          // Maximum retries reached - escalate to manual review
          logger.warn(`Order ${order.id} exhausted all carrier retries (${triedCount} carriers). Moving to on_hold.`);
          
          await pool.query(
            `UPDATE orders 
             SET status = 'on_hold', 
                 notes = CONCAT(COALESCE(notes, ''), '\n[SYSTEM] All carrier assignment attempts exhausted (9 carriers tried). Requires manual carrier assignment.'),
                 updated_at = NOW()
             WHERE id = $1`,
            [order.id]
          );

          // TODO: Send alert to operations team
          continue;
        }

        // Retry with next batch of carriers
        logger.info(`Retrying carrier assignment for order ${order.id} (attempt ${Math.floor(triedCount / 3) + 1}/3)`);
        
        try {
          await carrierAssignmentService.requestCarrierAssignment(order.id, {
            priority: order.priority,
            items: [] // Will be fetched by service
          });
        } catch (error) {
          logger.error(`Failed to retry assignment for order ${order.id}:`, error);
        }
      }

      return expiredResult.rows.length;
    } catch (error) {
      logger.error('Process expired assignments error:', error);
      throw error;
    }
  }

  /**
   * Retry orders with "busy" carriers when they become available
   * Checks carriers that changed from 'busy' to 'available'
   */
  async retryBusyAssignments() {
    try {
      logger.info('Checking for carriers that became available...');

      // Find carriers that recently became available (within last 30 min)
      const availableCarriers = await pool.query(
        `SELECT id, code, name
         FROM carriers
         WHERE availability_status = 'available'
         AND last_status_change > NOW() - INTERVAL '30 minutes'
         AND is_active = true`,
        []
      );

      if (availableCarriers.rows.length === 0) {
        logger.info('No newly available carriers found');
        return 0;
      }

      logger.info(`Found ${availableCarriers.rows.length} newly available carriers`);

      let retriedCount = 0;

      for (const carrier of availableCarriers.rows) {
        // Find assignments this carrier marked as 'busy'
        const busyAssignments = await pool.query(
          `SELECT ca.*, o.priority, o.customer_name
           FROM carrier_assignments ca
           JOIN orders o ON ca.order_id = o.id
           WHERE ca.carrier_id = $1 
           AND ca.status = 'busy'
           AND ca.expires_at > NOW()
           AND o.status NOT IN ('shipped', 'delivered', 'cancelled')
           ORDER BY ca.requested_at ASC
           LIMIT 5`,
          [carrier.id]
        );

        if (busyAssignments.rows.length > 0) {
          logger.info(`Carrier ${carrier.code} has ${busyAssignments.rows.length} busy assignments to retry`);

          // Reset status to 'pending' so carrier can accept
          for (const assignment of busyAssignments.rows) {
            await pool.query(
              `UPDATE carrier_assignments
               SET status = 'pending', updated_at = NOW()
               WHERE id = $1`,
              [assignment.id]
            );
          }

          retriedCount += busyAssignments.rows.length;
        }
      }

      logger.info(`Reset ${retriedCount} busy assignments to pending`);
      return retriedCount;
    } catch (error) {
      logger.error('Retry busy assignments error:', error);
      throw error;
    }
  }

  /**
   * Process all-rejected orders
   * If all carriers in current batch rejected, try next batch
   */
  async processAllRejectedOrders() {
    try {
      logger.info('Checking for orders with all rejections...');

      // Find orders where all current assignments are rejected/busy
      const ordersResult = await pool.query(
        `SELECT ca.order_id, COUNT(*) as total_assignments,
                COUNT(*) FILTER (WHERE status IN ('rejected', 'busy', 'expired')) as failed_count,
                o.priority, o.customer_name
         FROM carrier_assignments ca
         JOIN orders o ON ca.order_id = o.id
         WHERE ca.created_at > NOW() - INTERVAL '48 hours'
         AND o.status NOT IN ('shipped', 'delivered', 'cancelled')
         GROUP BY ca.order_id, o.priority, o.customer_name
         HAVING COUNT(*) = COUNT(*) FILTER (WHERE status IN ('rejected', 'busy', 'expired'))
         AND COUNT(*) % 3 = 0
         AND COUNT(*) < 9`,
        []
      );

      logger.info(`Found ${ordersResult.rows.length} orders with all carriers rejected/busy`);

      for (const row of ordersResult.rows) {
        logger.info(`Retrying order ${row.order_id} after all carriers rejected/busy (batch ${row.total_assignments / 3})`);

        try {
          await carrierAssignmentService.requestCarrierAssignment(row.order_id, {
            priority: row.priority,
            items: []
          });
        } catch (error) {
          logger.error(`Failed to retry order ${row.order_id}:`, error);
        }
      }

      return ordersResult.rows.length;
    } catch (error) {
      logger.error('Process all-rejected orders error:', error);
      throw error;
    }
  }

  /**
   * Main entry point - runs all retry logic
   */
  async run() {
    try {
      logger.info('===== Starting Carrier Assignment Retry Job =====');
      
      const expiredCount = await this.processExpiredAssignments();
      const busyCount = await this.retryBusyAssignments();
      const rejectedCount = await this.processAllRejectedOrders();

      logger.info(`===== Retry Job Complete: ${expiredCount} expired, ${busyCount} busy retried, ${rejectedCount} all-rejected =====`);

      return {
        success: true,
        expiredProcessed: expiredCount,
        busyRetried: busyCount,
        rejectedRetried: rejectedCount
      };
    } catch (error) {
      logger.error('Assignment retry job failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new AssignmentRetryService();
