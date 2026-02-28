// Job Handlers - Define handlers for each job type
import slaService from '../services/slaService.js';
import exceptionService from '../services/exceptionService.js';
import invoiceService from '../services/invoiceService.js';
import returnsService from '../services/returnsService.js';
import assignmentRetryService from '../services/assignmentRetryService.js';
import carrierAssignmentService from '../services/carrierAssignmentService.js';
import orderService from '../services/orderService.js';
import logger from '../utils/logger.js';
import returnRepo from '../repositories/ReturnRepository.js';
import jobsRepo from '../repositories/JobsRepository.js';
import notificationRepo from '../repositories/NotificationRepository.js';
import inventoryRepo from '../repositories/InventoryRepository.js';
import carrierRepo from '../repositories/CarrierRepository.js';
import slaRepo from '../repositories/SlaRepository.js';
import financeRepo from '../repositories/FinanceRepository.js';
import warehouseRepo from '../repositories/WarehouseRepository.js';
import shipmentRepo from '../repositories/ShipmentRepository.js';

/**
 * SLA Monitoring Job
 * Checks all active shipments for SLA violations
 */
async function handleSLAMonitoring(payload) {
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
async function handleExceptionEscalation(payload) {
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
async function handleInvoiceGeneration(payload) {
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
async function handleReturnPickupReminder(payload) {
  const startTime = Date.now();
  
  try {
    // Get returns with pickups scheduled for today or overdue
    const returns = await returnRepo.findPendingPickupReminders();
    
    const reminders = [];
    
    for (const returnItem of returns) {
      // TODO: Send actual email/SMS notification
      logger.info(`📧 Sending pickup reminder for return ${returnItem.id} to ${returnItem.email}`);
      
      // Mark reminder as sent
      await returnRepo.markReminderSent(returnItem.id);
      
      reminders.push(returnItem.id);
    }
    
    return {
      success: true,
      remindersSent: reminders.length,
      duration: `${Date.now() - startTime}ms`,
    };
  } catch (error) {
    logger.error('Return pickup reminder job failed:', error);
    throw error;
  }
}

/**
 * Report Generation Job
 * Generates various reports (analytics, performance, etc.)
 */
async function handleReportGeneration(payload) {
  const startTime = Date.now();
  const { reportType, parameters } = payload;
  
  try {
    let report;
    
    switch (reportType) {
      case 'carrier_performance':
        report = await generateCarrierPerformanceReport(parameters);
        break;
      case 'sla_compliance':
        report = await generateSLAComplianceReport(parameters);
        break;
      case 'financial_summary':
        report = await generateFinancialSummaryReport(parameters);
        break;
      case 'inventory_snapshot':
        report = await generateInventorySnapshotReport(parameters);
        break;
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }
    
    return {
      success: true,
      reportType,
      reportId: report.id,
      duration: `${Date.now() - startTime}ms`,
    };
  } catch (error) {
    logger.error('Report generation job failed:', error);
    throw error;
  }
}

/**
 * Data Cleanup Job
 * Cleans up old logs, expired sessions, etc.
 */
async function handleDataCleanup(payload) {
  const startTime = Date.now();
  const { retentionDays = 90 } = payload;
  
  try {
    const cleanupDate = new Date();
    cleanupDate.setDate(cleanupDate.getDate() - retentionDays);
    
    // Clean up old job execution logs
    const deletedLogs = await jobsRepo.deleteOldLogs(cleanupDate);
    
    // Clean up old notifications
    const deletedNotifications = await notificationRepo.deleteOldRead(cleanupDate);
    
    // Clean up completed jobs older than retention period
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
async function handleNotificationDispatch(payload) {
  const startTime = Date.now();
  const { notificationType, recipients, message, data } = payload;
  
  try {
    // TODO: Integrate with actual notification service
    logger.info('📨 Dispatching notifications', {
      type: notificationType,
      recipientCount: recipients.length,
    });
    
    const sent = [];
    const failed = [];
    
    for (const recipient of recipients) {
      try {
        // Simulate notification sending
        // In production, integrate with services like SendGrid, Twilio, Firebase, etc.
        logger.info(`Sending ${notificationType} to ${recipient}`);
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
 * transactions or partial updates.  Also resets low_stock_threshold alerts for
 * items whose quantity has dropped below the threshold.
 */
async function handleInventorySync(payload) {
  const startTime = Date.now();
  const { warehouseId, source } = payload;

  try {
    logger.info('🔄 Running inventory reconciliation', { warehouseId, source });

    // 1. Fix any available_quantity drift: available = MAX(0, quantity - reserved)
    const driftRows = await inventoryRepo.reconcileDrift(warehouseId || null);
    const driftFixed = driftRows.length;

    // 2. Snapshot total SKU count and aggregate quantities for the warehouse
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
      distinctSkus: parseInt(stats.distinct_skus),
      totalUnits: parseInt(stats.total_units),
      totalReserved: parseInt(stats.total_reserved),
      totalAvailable: parseInt(stats.total_available),
      lowStockSkus: parseInt(stats.low_stock_skus),
      duration: `${Date.now() - startTime}ms`,
    };
  } catch (error) {
    logger.error('Inventory sync job failed:', { error });
    throw error;
  }
}

// Helper functions for report generation

async function generateCarrierPerformanceReport(parameters) {
  const { carrierId, startDate, endDate } = parameters;

  const rows = await carrierRepo.getPerformanceReport(carrierId, startDate, endDate);

  logger.info('Generated carrier performance report', {
    carrierId, startDate, endDate, rows: rows.length
  });

  return {
    id: `report-${Date.now()}`,
    type: 'carrier_performance',
    generatedAt: new Date().toISOString(),
    parameters,
    rows,
    rowCount: rows.length,
  };
}

async function generateSLAComplianceReport(parameters) {
  const { startDate, endDate } = parameters;

  const rows = await slaRepo.getComplianceReport(startDate || '1900-01-01', endDate || 'now()');

  logger.info('Generated SLA compliance report', { startDate, endDate, rows: rows.length });

  return {
    id: `report-${Date.now()}`,
    type: 'sla_compliance',
    generatedAt: new Date().toISOString(),
    parameters,
    rows,
    rowCount: rows.length,
  };
}

async function generateFinancialSummaryReport(parameters) {
  const { startDate, endDate } = parameters;

  const [invoices, refunds] = await Promise.all([
    financeRepo.getInvoiceStatsByDateRange(startDate || '1900-01-01', endDate || 'now()'),
    returnRepo.getRefundStats(startDate || '1900-01-01', endDate || 'now()'),
  ]);

  logger.info('Generated financial summary report', { startDate, endDate });

  return {
    id: `report-${Date.now()}`,
    type: 'financial_summary',
    generatedAt: new Date().toISOString(),
    parameters,
    invoices,
    refunds,
  };
}

async function generateInventorySnapshotReport(parameters) {
  const { warehouseId } = parameters;

  const rows = await warehouseRepo.getInventorySnapshotReport(warehouseId);

  logger.info('Generated inventory snapshot report', { warehouseId, rows: rows.length });

  return {
    id: `report-${Date.now()}`,
    type: 'inventory_snapshot',
    generatedAt: new Date().toISOString(),
    parameters,
    rows,
    rowCount: rows.length,
  };
}

/**
 * Process Order Job (from webhook)
 * Processes incoming order from e-commerce platforms
 */
async function handleProcessOrder(payload) {
  const startTime = Date.now();

  try {
    const { source, order, organization_id } = payload;

    logger.info(`Processing order from ${source}` +
      (organization_id ? ` (org: ${organization_id})` : ' (no org)'));

    // Normalize webhook payload fields to match orderService.createOrder expectations.
    // Webhook senders use different field names (name/price vs product_name/unit_price).
    const orderData = {
      organization_id:   organization_id || null,
      external_order_id: order.external_order_id || `${source || 'webhook'}-${Date.now()}`,
      platform:          order.platform || source || 'webhook',
      customer_name:     order.customer_name,
      customer_email:    order.customer_email || null,
      customer_phone:    order.customer_phone || null,
      priority:          order.priority || 'standard',
      total_amount:      order.total_amount || 0,
      tax_amount:        order.tax_amount   || 0,
      shipping_amount:   order.shipping_amount || 0,
      currency:          order.currency || 'INR',
      shipping_address:  order.shipping_address || {},
      notes:             order.notes || null,
      items: (order.items || []).map(item => ({
        product_name: item.product_name || item.name || 'Unknown',
        sku:          item.sku          || null,
        quantity:     parseInt(item.quantity)  || 1,
        unit_price:   parseFloat(item.unit_price ?? item.price ?? 0),
        weight:       parseFloat(item.weight   ?? item.unit_weight ?? 0.5),
        category:     item.category || null,
        dimensions:   item.dimensions || null,
        is_fragile:   item.is_fragile || false,
        is_hazardous: item.is_hazardous || false,
      })),
    };

    // Delegate to the shared service — same path as manual API creation.
    // The service handles order insert, item insert, inventory reservation, and carrier assignment.
    const createdOrder = await orderService.createOrder(orderData, true);

    logger.info(`✅ Webhook order processed: ${createdOrder.order_number} (id: ${createdOrder.id})`);

    return {
      success:        true,
      orderId:        createdOrder.id,
      orderNumber:    createdOrder.order_number,
      externalOrderId: orderData.external_order_id,
      itemsCount:     (createdOrder.items || []).length,
      duration:       `${Date.now() - startTime}ms`,
    };
  } catch (error) {
    logger.error('Process order job failed:', error);
    throw error;
  }
}

/**
 * Update Tracking Job (from webhook)
 * Updates shipment tracking information
 */
async function handleUpdateTracking(payload) {
  const startTime = Date.now();
  
  try {
    const { tracking_number, carrier, status, status_detail, location } = payload;
    
    logger.info(`Updating tracking for ${tracking_number}: ${status}`);
    
    // Find shipment by tracking number
    const shipment = await shipmentRepo.findByTrackingNumber(tracking_number);

    if (!shipment) {
      logger.warn(`Shipment not found for tracking number: ${tracking_number}`);
      return { success: false, reason: 'shipment_not_found' };
    }

    // Import and use shipment tracking service
    const shipmentTrackingService = (await import('../services/shipmentTrackingService.js')).default;
    
    const trackingEvent = {
      eventType: status,
      description: status_detail || status,
      location: typeof location === 'string' 
        ? { city: location } 
        : location
    };

    await shipmentTrackingService.updateShipmentTracking(
      shipment.id,
      trackingEvent
    );
    
    logger.info(`✅ Tracking updated for ${tracking_number}`);
    
    return {
      success: true,
      shipmentId: shipment.id,
      status,
      duration: `${Date.now() - startTime}ms`
    };
  } catch (error) {
    logger.error('Update tracking job failed:', error);
    throw error;
  }
}

/**
 * Sync Inventory Job (from webhook)
 * Synchronizes inventory from warehouse system
 */
async function handleSyncInventory(payload) {
  const startTime = Date.now();
  
  try {
    const { warehouse_id, items } = payload;
    
    logger.info(`Syncing inventory for warehouse ${warehouse_id}: ${items?.length || 0} items`);
    
    // Look up warehouse UUID by code (warehouse_id might be a code like "WH-001")
    let warehouse = await warehouseRepo.findByCode(warehouse_id);
    
    let actualWarehouseId = warehouse_id;
    
    // If warehouse doesn't exist, create it with basic info
    if (!warehouse) {
      logger.warn(`Warehouse ${warehouse_id} not found, creating placeholder`);
      try {
        const newWarehouse = await warehouseRepo.upsertPlaceholder(
          warehouse_id,
          `Warehouse ${warehouse_id}`,
          JSON.stringify({ street: 'TBD', city: 'TBD', state: 'TBD', postal_code: '00000', country: 'US' })
        );
        actualWarehouseId = newWarehouse.id;
        logger.info(`Created placeholder warehouse with ID ${actualWarehouseId}`);
      } catch (error) {
        // Race condition: another job created it, fetch it again
        if (error.code === '23505') {
          const retryWarehouse = await warehouseRepo.findByCode(warehouse_id);
          actualWarehouseId = retryWarehouse.id;
          logger.info(`Warehouse ${warehouse_id} was created by another job, using ID ${actualWarehouseId}`);
        } else {
          throw error;
        }
      }
    } else {
      actualWarehouseId = warehouse.id;
    }
    
    let updatedCount = 0;
    
    for (const item of items || []) {
      const inventoryItem = await inventoryRepo.createInventoryItem({
        warehouse_id: actualWarehouseId,
        sku: item.sku,
        product_name: item.product_name,
        quantity: item.new_quantity,
        bin_location: item.bin_location
      });
      
      if (inventoryItem) updatedCount++;
    }
    
    logger.info(`✅ Inventory synced for warehouse ${warehouse_id}: ${updatedCount} items updated`);
    
    return {
      success: true,
      warehouse_id,
      itemsUpdated: updatedCount,
      duration: `${Date.now() - startTime}ms`
    };
  } catch (error) {
    logger.error('Sync inventory job failed:', error);
    throw error;
  }
}

/**
 * Process Return Job (from webhook)
 * Processes return requests
 */
async function handleProcessReturn(payload) {
  const startTime = Date.now();
  
  try {
    const { return_id, original_order_id, customer, items, refund_amount, organization_id } = payload;
    
    logger.info(`Processing return ${return_id} for order ${original_order_id}`);
    
    // Insert return into database
    // Carry organization_id from the webhook payload for correct tenant isolation
    const newReturn = await returnRepo.createFromWebhook({
      organizationId: organization_id || null,
      externalReturnId: return_id,
      externalOrderId: original_order_id,
      customerName: customer.name,
      customerEmail: customer.email,
      items: items,
      refundAmount: refund_amount
    });
    
    logger.info(`✅ Return ${return_id} processed as ID ${newReturn.id}`);
    
    return {
      success: true,
      returnId: newReturn.id,
      itemsCount: items?.length || 0,
      duration: `${Date.now() - startTime}ms`
    };
  } catch (error) {
    logger.error('Process return job failed:', error);
    throw error;
  }
}

/**
 * Process Rates Job (from webhook)
 * Stores carrier rate information
 */
async function handleProcessRates(payload) {
  const startTime = Date.now();
  
  try {
    const { request_id, rates } = payload;
    
    logger.info(`Processing rates for request ${request_id}: ${rates?.length || 0} rates`);
    
    // Store rates in database (you might have a carrier_rates table)
    // For now, just log them
    logger.info(`Received rates: ${JSON.stringify(rates, null, 2)}`);
    
    return {
      success: true,
      request_id,
      ratesCount: rates?.length || 0,
      duration: `${Date.now() - startTime}ms`
    };
  } catch (error) {
    logger.error('Process rates job failed:', error);
    throw error;
  }
}

/**
 * Carrier Assignment Retry Job
 * Handles expired, busy, and rejected carrier assignments
 */
async function handleCarrierAssignmentRetry(payload) {
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

// Job handler registry
export const jobHandlers = {
  'sla_monitoring': handleSLAMonitoring,
  'exception_escalation': handleExceptionEscalation,
  'invoice_generation': handleInvoiceGeneration,
  'return_pickup_reminder': handleReturnPickupReminder,
  'report_generation': handleReportGeneration,
  'data_cleanup': handleDataCleanup,
  'notification_dispatch': handleNotificationDispatch,
  'inventory_sync': handleInventorySync,
  'process_order': handleProcessOrder,
  'update_tracking': handleUpdateTracking,
  'sync_inventory': handleSyncInventory,
  'process_return': handleProcessReturn,
  'process_rates': handleProcessRates,
  'carrier_assignment_retry': handleCarrierAssignmentRetry,
};

export default jobHandlers;
