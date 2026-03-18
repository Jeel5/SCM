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

      const outcomes = await Promise.allSettled(
        orders.map(async (order) => {
          await carrierAssignmentRepo.expireByOrderId(order.id);
          const triedCount = await carrierAssignmentRepo.countTriedCarriers(order.id);

          if (triedCount >= 9) {
            logger.warn(`Order ${order.id} exhausted all carrier retries (${triedCount} carriers). Moving to on_hold.`);
            await carrierAssignmentRepo.markOrderOnHold(order.id);
            await carrierAssignmentRepo.createAssignmentExhaustedAlert({
              organizationId: order.organization_id,
              orderNumber: order.order_number,
              orderId: order.id,
              triedCount,
              priority: order.priority
            });
            logger.warn('System alert raised: carrier assignment exhausted', { orderId: order.id, triedCount });
            return;
          }

          logger.info(`Retrying carrier assignment for order ${order.id} (attempt ${Math.floor(triedCount / 3) + 1}/3)`);
          await carrierAssignmentService.requestCarrierAssignment(order.id, {
            priority: order.priority,
            items: []
          });
        })
      );

      outcomes.forEach((outcome, idx) => {
        if (outcome.status === 'fulfilled') return;
        logger.error(`Failed to retry assignment for order ${orders[idx]?.id}:`, outcome.reason);
      });

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

      const carrierOutcomes = await Promise.allSettled(
        carriers.map(async (carrier) => {
          const busyAssignments = await carrierAssignmentRepo.findBusyByCarrier(carrier.id, 5);

          if (busyAssignments.length > 0) {
            logger.info(`Carrier ${carrier.code} has ${busyAssignments.length} busy assignments to retry`);
            await Promise.all(busyAssignments.map((assignment) => carrierAssignmentRepo.resetToPending(assignment.id)));
          }

          return busyAssignments.length;
        })
      );

      carrierOutcomes.forEach((outcome, idx) => {
        if (outcome.status === 'fulfilled') {
          retriedCount += outcome.value;
          return;
        }
        logger.error(`Failed to process busy assignments for carrier ${carriers[idx]?.code}:`, outcome.reason);
      });

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

      const retryOutcomes = await Promise.allSettled(
        rows.map((row) => {
          logger.info(`Retrying order ${row.order_id} after all carriers rejected/busy (batch ${row.total_assignments / 3})`);
          return carrierAssignmentService.requestCarrierAssignment(row.order_id, {
            priority: row.priority,
            items: []
          });
        })
      );

      retryOutcomes.forEach((outcome, idx) => {
        if (outcome.status === 'fulfilled') return;
        logger.error(`Failed to retry order ${rows[idx]?.order_id}:`, outcome.reason);
      });

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
