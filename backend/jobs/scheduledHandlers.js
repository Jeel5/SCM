import slaService from '../services/slaService.js';
import exceptionService from '../services/exceptionService.js';
import invoiceService from '../services/invoiceService.js';
import assignmentRetryService from '../services/assignmentRetryService.js';
import logger from '../utils/logger.js';
import returnRepo from '../repositories/ReturnRepository.js';
import jobsRepo from '../repositories/JobsRepository.js';
import notificationRepo from '../repositories/NotificationRepository.js';
import inventoryRepo from '../repositories/InventoryRepository.js';
import emailService from '../services/emailService.js';

/**
 * SLA Monitoring Job
 * Checks all active shipments for SLA violations
 */
export async function handleSLAMonitoring(payload) {
  const startTime = Date.now();

  try {
    const violations = await slaService.monitorSLAViolations();

    return {
      success: true,
      violationsDetected: violations.length,
      duration: `${Date.now() - startTime}ms`,
    };
  } catch (error) {
    logger.error('SLA monitoring job failed:', error);
    throw error;
  }
}

/**
 * Exception Auto-Escalation Job
 * Escalates overdue exceptions automatically
 */
export async function handleExceptionEscalation(payload) {
  const startTime = Date.now();

  try {
    const escalated = await exceptionService.autoEscalateOverdueExceptions();

    return {
      success: true,
      exceptionsEscalated: escalated.length,
      duration: `${Date.now() - startTime}ms`,
    };
  } catch (error) {
    logger.error('Exception escalation job failed:', error);
    throw error;
  }
}

/**
 * Invoice Generation Job
 * Generates invoices for completed shipments
 */
export async function handleInvoiceGeneration(payload) {
  const startTime = Date.now();
  const { carrierId, periodStart, periodEnd } = payload;

  try {
    const invoice = await invoiceService.generateInvoice(carrierId, periodStart, periodEnd);

    return {
      success: true,
      invoiceId: invoice.id,
      amount: invoice.total_amount,
      shipmentCount: invoice.shipment_count,
      duration: `${Date.now() - startTime}ms`,
    };
  } catch (error) {
    logger.error('Invoice generation job failed:', error);
    throw error;
  }
}

/**
 * Return Pickup Reminder Job
 * Sends reminders for pending return pickups
 */
export async function handleReturnPickupReminder(payload) {
  const startTime = Date.now();

  try {
    const returns = await returnRepo.findPendingPickupReminders();

    const reminders = [];
    const failures = [];

    for (const returnItem of returns) {
      try {
        if (returnItem.email) {
          await emailService.sendSimpleNotification({
            to: returnItem.email,
            subject: `Pickup reminder for return ${returnItem.rma_number || returnItem.id}`,
            message: `Your return ${returnItem.rma_number || returnItem.id} is scheduled for pickup soon. Please keep the package ready.`,
          });
        }

        await returnRepo.markReminderSent(returnItem.id);
        reminders.push(returnItem.id);
      } catch (err) {
        logger.error('Failed to send return pickup reminder', {
          returnId: returnItem.id,
          email: returnItem.email,
          error: err,
        });
        failures.push(returnItem.id);
      }
    }

    return {
      success: true,
      remindersSent: reminders.length,
      remindersFailed: failures.length,
      duration: `${Date.now() - startTime}ms`,
    };
  } catch (error) {
    logger.error('Return pickup reminder job failed:', error);
    throw error;
  }
}

/**
 * Data Cleanup Job
 * Cleans up old logs, expired sessions, etc.
 */
export async function handleDataCleanup(payload) {
  const startTime = Date.now();
  const { retentionDays = 90 } = payload;

  try {
    const cleanupDate = new Date();
    cleanupDate.setDate(cleanupDate.getDate() - retentionDays);

    const deletedLogs = await jobsRepo.deleteOldLogs(cleanupDate);
    const deletedNotifications = await notificationRepo.deleteOldRead(cleanupDate);
    const deletedJobs = await jobsRepo.deleteCompletedBefore(cleanupDate);

    return {
      success: true,
      deletedLogs,
      deletedNotifications,
      deletedJobs,
      duration: `${Date.now() - startTime}ms`,
    };
  } catch (error) {
    logger.error('Data cleanup job failed:', error);
    throw error;
  }
}

/**
 * Notification Dispatch Job
 * Sends batch notifications (email, SMS, push)
 */
export async function handleNotificationDispatch(payload) {
  const startTime = Date.now();
  const { notificationType, recipients, message, data } = payload;

  try {
    logger.info('📨 Dispatching notifications', {
      type: notificationType,
      recipientCount: recipients.length,
    });

    const sent = [];
    const failed = [];

    for (const recipient of recipients) {
      try {
        if (notificationType === 'email') {
          await emailService.sendSimpleNotification({
            to: recipient,
            subject: data?.subject || 'TwinChain notification',
            message,
          });
        } else {
          // Non-email channels are accepted and logged until SMS/push provider is configured.
          logger.info('Notification channel accepted', { notificationType, recipient });
        }
        sent.push(recipient);
      } catch (error) {
        logger.error(`Failed to send notification to ${recipient}:`, error);
        failed.push({ recipient, error: error.message });
      }
    }

    return {
      success: true,
      sent: sent.length,
      failed: failed.length,
      failures: failed,
      duration: `${Date.now() - startTime}ms`,
    };
  } catch (error) {
    logger.error('Notification dispatch job failed:', error);
    throw error;
  }
}

/**
 * Inventory Sync Job (cron-triggered)
 * Reconciles available_quantity = MAX(0, quantity - reserved_quantity) for all
 * inventory rows in the given warehouse, correcting any drift caused by failed
 * transactions or partial updates. Also resets low_stock_threshold alerts for
 * items whose quantity has dropped below the threshold.
 */
export async function handleInventorySync(payload) {
  const startTime = Date.now();
  const { warehouseId, source } = payload;

  try {
    logger.info('🔄 Running inventory reconciliation', { warehouseId, source });

    const driftRows = await inventoryRepo.reconcileDrift(warehouseId || null);
    const driftFixed = driftRows.length;
    const stats = await inventoryRepo.getInventorySyncStats(warehouseId || null);

    logger.info('✅ Inventory reconciliation complete', {
      warehouseId,
      driftFixed,
      distinctSkus: stats.distinct_skus,
      totalUnits: stats.total_units,
      lowStockSkus: stats.low_stock_skus,
    });

    return {
      success: true,
      warehouseId,
      driftFixed,
      distinctSkus: parseInt(stats.distinct_skus, 10),
      totalUnits: parseInt(stats.total_units, 10),
      totalReserved: parseInt(stats.total_reserved, 10),
      totalAvailable: parseInt(stats.total_available, 10),
      lowStockSkus: parseInt(stats.low_stock_skus, 10),
      duration: `${Date.now() - startTime}ms`,
    };
  } catch (error) {
    logger.error('Inventory sync job failed:', { error });
    throw error;
  }
}

/**
 * Carrier Assignment Retry Job
 * Handles expired, busy, and rejected carrier assignments
 */
export async function handleCarrierAssignmentRetry(payload) {
  const startTime = Date.now();

  try {
    const result = await assignmentRetryService.run();

    return {
      success: result.success,
      expiredProcessed: result.expiredProcessed,
      busyRetried: result.busyRetried,
      rejectedRetried: result.rejectedRetried,
      duration: `${Date.now() - startTime}ms`,
    };
  } catch (error) {
    logger.error('Carrier assignment retry job failed:', error);
    throw error;
  }
}
