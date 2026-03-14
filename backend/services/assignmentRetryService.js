// Smart Carrier Assignment Retry Job
// Handles automatic retry logic for orders that need carrier reassignment

import logger from '../utils/logger.js';
import carrierAssignmentService from '../services/carrierAssignmentService.js';
import carrierAssignmentRepo from '../repositories/CarrierAssignmentRepository.js';

class AssignmentRetryService {
  /**
   * Process expired assignments and retry with next batch of carriers
   * Runs every 30 minutes
   */
  async processExpiredAssignments() {
    try {
      logger.info('Processing expired carrier assignments...');

      // Find assignments that have expired (24h+ with no response)
      const orders = await carrierAssignmentRepo.findExpiredWithOrders();

      logger.info(`Found ${orders.length} orders with expired assignments`);

      for (const order of orders) {
        // Mark old assignments as expired
        await carrierAssignmentRepo.expireByOrderId(order.id);

        // Count how many batches have been tried
        const triedCount = await carrierAssignmentRepo.countTriedCarriers(order.id);

        if (triedCount >= 9) {
          // Maximum retries reached - escalate to manual review
          logger.warn(`Order ${order.id} exhausted all carrier retries (${triedCount} carriers). Moving to on_hold.`);
          
          await carrierAssignmentRepo.markOrderOnHold(order.id);

          // Raise a system alert so ops staff can pick this up in the dashboard
          await carrierAssignmentRepo.createAssignmentExhaustedAlert({
            organizationId: order.organization_id,
            orderNumber: order.order_number,
            orderId: order.id,
            triedCount,
            priority: order.priority
          });
          logger.warn('System alert raised: carrier assignment exhausted', { orderId: order.id, triedCount });
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

      return orders.length;
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
      const carriers = await carrierAssignmentRepo.findNewlyAvailableCarriers();

      if (carriers.length === 0) {
        logger.info('No newly available carriers found');
        return 0;
      }

      logger.info(`Found ${carriers.length} newly available carriers`);

      let retriedCount = 0;

      for (const carrier of carriers) {
        // Find assignments this carrier marked as 'busy'
        const busyAssignments = await carrierAssignmentRepo.findBusyByCarrier(carrier.id, 5);

        if (busyAssignments.length > 0) {
          logger.info(`Carrier ${carrier.code} has ${busyAssignments.length} busy assignments to retry`);

          // Reset status to 'pending' so carrier can accept
          for (const assignment of busyAssignments) {
            await carrierAssignmentRepo.resetToPending(assignment.id);
          }

          retriedCount += busyAssignments.length;
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
      const rows = await carrierAssignmentRepo.findAllRejectedOrders();

      logger.info(`Found ${rows.length} orders with all carriers rejected/busy`);

      for (const row of rows) {
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

      return rows.length;
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

      const finalizedCount = await carrierAssignmentService.finalizeReadyBiddingWindows();
      
      const expiredCount = await this.processExpiredAssignments();
      const busyCount = await this.retryBusyAssignments();
      const rejectedCount = await this.processAllRejectedOrders();

      logger.info(`===== Retry Job Complete: ${finalizedCount} finalized, ${expiredCount} expired, ${busyCount} busy retried, ${rejectedCount} all-rejected =====`);

      return {
        success: true,
        windowsFinalized: finalizedCount,
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
