// Returns Service - Pickup scheduling, RMA workflow, and refund processing
import { NotFoundError, BusinessLogicError, AppError } from '../errors/index.js';
import { logEvent } from '../utils/logger.js';
import logger from '../utils/logger.js';
import { withTransaction } from '../utils/dbTransaction.js';
import returnRepo from '../repositories/ReturnRepository.js';

// ─── Return State Machine ──────────────────────────────────────────────────────────────────
// Single source of truth for valid return status transitions.
export const RETURN_VALID_TRANSITIONS = {
  requested:          ['approved', 'rejected'],
  approved:           ['received', 'rejected'],
  received:           ['inspecting'],
  inspecting:         ['inspection_passed', 'inspection_failed', 'rejected'],
  inspection_passed:  ['refunded', 'restocked'],
  inspection_failed:  ['rejected'],
  refunded:           [],  // terminal
  restocked:          [],  // terminal
  rejected:           [],  // terminal
  cancelled:          [],  // terminal
  // Legacy mappings (keep for any existing records)
  inspected:          ['refunded', 'restocked'],
  completed:          [],
  pickup_scheduled:   ['picked_up', 'rejected'],
  picked_up:          ['in_transit', 'received'],
  in_transit:         ['received'],
};

class ReturnsService {
  /**
   * Validate that transitioning from currentStatus → newStatus is allowed.
   * Throws AppError(409) if the transition is invalid.
   */
  validateTransition(currentStatus, newStatus) {
    const allowed = RETURN_VALID_TRANSITIONS[currentStatus];
    if (allowed === undefined) {
      logger.error('Unknown return status encountered in state machine', { currentStatus, newStatus });
      throw new AppError(`Unknown return status: '${currentStatus}'`, 409);
    }
    if (!allowed.includes(newStatus)) {
      logger.warn('Invalid return status transition attempted', {
        currentStatus,
        newStatus,
        allowedTransitions: allowed,
      });
      throw new AppError(
        `Invalid status transition: '${currentStatus}' → '${newStatus}'. Allowed: ${
          allowed.length ? allowed.join(', ') : '(none — terminal state)'
        }`,
        409
      );
    }
    logger.debug('Return status transition validated', { currentStatus, newStatus });
  }
  /**
   * Schedule pickup for return
   */
  async schedulePickup(returnId, pickupDate, timeSlot, pickupAddress) {
    const row = await returnRepo.schedulePickup(returnId, pickupDate, timeSlot, pickupAddress);

    if (!row) {
      throw new NotFoundError('Return not found or not in correct status');
    }

    logEvent('ReturnPickupScheduled', {
      returnId,
      rmaNumber: row.rma_number,
      pickupDate,
      timeSlot
    });

    return row;
  }

  /**
   * Mark pickup as completed
   */
  async completePickup(returnId, carrierNotes) {
    const row = await returnRepo.completePickup(returnId);

    if (!row) {
      throw new NotFoundError('Return not found or pickup not scheduled');
    }

    logEvent('ReturnPickupCompleted', {
      returnId,
      rmaNumber: row.rma_number
    });

    return row;
  }

  /**
   * Receive and inspect returned items at warehouse
   */
  async inspectReturn(returnId, qualityCheckResult, inspectionNotes, inspectedBy) {
    try {
      const result = await withTransaction(async (tx) => {
        // Get return details
        const returnData = await returnRepo.findByIdRaw(returnId, tx);

        if (!returnData) {
          throw new NotFoundError('Return not found');
        }

        // Update return with inspection results
        const updatedReturn = await returnRepo.updateInspectionResult(returnId, qualityCheckResult, inspectionNotes, tx);

        // If quality check passed, add items back to inventory
        if (qualityCheckResult === 'passed') {
          const items = await returnRepo.findReturnItemsWithInventoryInfo(returnId, tx);

          for (const item of items) {
            // Add back to available inventory
            await returnRepo.upsertInventoryStock(item.warehouse_id, item.product_id, item.quantity, tx);

            // Record stock movement
            await returnRepo.insertStockMovement({
              warehouseId: item.warehouse_id,
              productId: item.product_id,
              quantity: item.quantity,
              returnId,
              notes: `Return inspection passed: ${inspectionNotes}`
            }, tx);
          }
        } else {
          // Mark as damaged inventory
          const items = await returnRepo.findReturnItemsWithWarehouse(returnId, tx);

          for (const item of items) {
            await returnRepo.markDamagedInventory(item.warehouse_id, item.product_id, item.quantity, tx);
          }
        }

        return { returnData, updatedReturn };
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
    return withTransaction(async (tx) => {

      // Get return details
      const returnData = await returnRepo.findByIdWithOrderAmount(returnId, tx);

      if (!returnData) {
        throw new NotFoundError('Return not found');
      }

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
      const updatedReturn = await returnRepo.updateRefundInfo(returnId, {
        refundAmount,
        refundMethod,
        refundReference
      }, tx);

      // Create refund record in finance (for tracking)
      await returnRepo.createRefundInvoice(returnData.rma_number, refundAmount, tx);


      logEvent('RefundProcessed', {
        returnId,
        rmaNumber: returnData.rma_number,
        refundAmount,
        refundMethod,
        processedBy
      });

      return updatedReturn;

    });
  }

  /**
   * Reject return with reason
   */
  async rejectReturn(returnId, reason, rejectedBy) {
    const row = await returnRepo.rejectReturn(returnId, reason);

    if (!row) {
      throw new NotFoundError('Return not found');
    }

    logEvent('ReturnRejected', {
      returnId,
      rmaNumber: row.rma_number,
      reason,
      rejectedBy
    });

    return row;
  }

  /**
   * Get return with items
   */
  async getReturnWithItems(returnId) {
    const returnData = await returnRepo.findByIdWithOrderNumber(returnId);

    if (!returnData) {
      throw new NotFoundError('Return not found');
    }

    // Get return items
    returnData.items = await returnRepo.findItemsWithProductInfo(returnId);

    return returnData;
  }

  /**
   * Get return analytics
   */
  async getReturnAnalytics(startDate, endDate) {
    return returnRepo.getAnalytics(startDate, endDate);
  }
}

export default new ReturnsService();
