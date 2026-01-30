// Job Handlers - Define handlers for each job type
import slaService from '../services/slaService.js';
import exceptionService from '../services/exceptionService.js';
import invoiceService from '../services/invoiceService.js';
import returnsService from '../services/returnsService.js';
import assignmentRetryService from '../services/assignmentRetryService.js';
import logger from '../utils/logger.js';
import pool from '../configs/db.js';

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
    const result = await pool.query(
      `SELECT r.*, u.email, u.first_name, u.last_name
       FROM returns r
       JOIN users u ON r.customer_id = u.id
       WHERE r.status = 'pickup_scheduled'
         AND r.pickup_date <= CURRENT_DATE + INTERVAL '1 day'
         AND r.pickup_reminder_sent = false
       ORDER BY r.pickup_date ASC`
    );
    
    const returns = result.rows;
    const reminders = [];
    
    for (const returnItem of returns) {
      // TODO: Send actual email/SMS notification
      logger.info(`📧 Sending pickup reminder for return ${returnItem.id} to ${returnItem.email}`);
      
      // Mark reminder as sent
      await pool.query(
        'UPDATE returns SET pickup_reminder_sent = true WHERE id = $1',
        [returnItem.id]
      );
      
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
    const logsResult = await pool.query(
      'DELETE FROM job_execution_logs WHERE created_at < $1',
      [cleanupDate]
    );
    
    // Clean up old notifications
    const notificationsResult = await pool.query(
      'DELETE FROM notifications WHERE created_at < $1 AND is_read = true',
      [cleanupDate]
    );
    
    // Clean up completed jobs older than retention period
    const jobsResult = await pool.query(
      `DELETE FROM background_jobs 
       WHERE status = 'completed' 
       AND completed_at < $1`,
      [cleanupDate]
    );
    
    return {
      success: true,
      deletedLogs: logsResult.rowCount,
      deletedNotifications: notificationsResult.rowCount,
      deletedJobs: jobsResult.rowCount,
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
 * Inventory Sync Job
 * Syncs inventory data with external systems
 */
async function handleInventorySync(payload) {
  const startTime = Date.now();
  const { warehouseId, source } = payload;
  
  try {
    // TODO: Implement actual inventory sync logic
    logger.info('🔄 Syncing inventory', { warehouseId, source });
    
    // Simulate sync
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      success: true,
      warehouseId,
      itemsSynced: 150, // Mock data
      duration: `${Date.now() - startTime}ms`,
    };
  } catch (error) {
    logger.error('Inventory sync job failed:', error);
    throw error;
  }
}

// Helper functions for report generation

async function generateCarrierPerformanceReport(parameters) {
  const { carrierId, startDate, endDate } = parameters;
  
  // TODO: Implement actual report generation
  logger.info('Generating carrier performance report', { carrierId, startDate, endDate });
  
  return {
    id: `report-${Date.now()}`,
    type: 'carrier_performance',
    generatedAt: new Date().toISOString(),
  };
}

async function generateSLAComplianceReport(parameters) {
  const { startDate, endDate } = parameters;
  
  logger.info('Generating SLA compliance report', { startDate, endDate });
  
  return {
    id: `report-${Date.now()}`,
    type: 'sla_compliance',
    generatedAt: new Date().toISOString(),
  };
}

async function generateFinancialSummaryReport(parameters) {
  const { startDate, endDate } = parameters;
  
  logger.info('Generating financial summary report', { startDate, endDate });
  
  return {
    id: `report-${Date.now()}`,
    type: 'financial_summary',
    generatedAt: new Date().toISOString(),
  };
}

async function generateInventorySnapshotReport(parameters) {
  const { warehouseId } = parameters;
  
  logger.info('Generating inventory snapshot report', { warehouseId });
  
  return {
    id: `report-${Date.now()}`,
    type: 'inventory_snapshot',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Process Order Job (from webhook)
 * Processes incoming order from e-commerce platforms
 */
async function handleProcessOrder(payload) {
  const startTime = Date.now();
  
  try {
    const { source, order } = payload;
    
    logger.info(`Processing order from ${source}: ${order.external_order_id}`);
    
    // Insert order into database
    const result = await pool.query(
      `INSERT INTO orders (
        external_order_id, platform, customer_name, customer_email, 
        customer_phone, shipping_address, total_amount, tax_amount, 
        shipping_amount, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        order.external_order_id,
        order.platform,
        order.customer_name,
        order.customer_email,
        order.customer_phone,
        JSON.stringify(order.shipping_address),
        order.total_amount,
        order.tax_amount || 0,
        order.shipping_amount || 0,
        'pending',
        new Date()
      ]
    );
    
    const orderId = result.rows[0].id;
    
    // Insert order items
    if (order.items && order.items.length > 0) {
      const itemValues = order.items.map(item => 
        `('${orderId}', '${item.sku}', '${item.name.replace(/'/g, "''")}', ${item.quantity}, ${item.price})`
      ).join(',');
      
      await pool.query(`
        INSERT INTO order_items (order_id, sku, product_name, quantity, unit_price)
        VALUES ${itemValues}
      `);
    }
    
    logger.info(`✅ Order ${order.external_order_id} processed as ID ${orderId}`);
    
    return {
      success: true,
      orderId,
      itemsCount: order.items?.length || 0,
      duration: `${Date.now() - startTime}ms`
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
    const shipmentResult = await pool.query(
      'SELECT id FROM shipments WHERE tracking_number = $1',
      [tracking_number]
    );

    if (shipmentResult.rows.length === 0) {
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
      shipmentResult.rows[0].id,
      trackingEvent
    );
    
    logger.info(`✅ Tracking updated for ${tracking_number}`);
    
    return {
      success: true,
      shipmentId: shipmentResult.rows[0].id,
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
    const warehouseResult = await pool.query(
      'SELECT id FROM warehouses WHERE code = $1 OR id::text = $1 LIMIT 1',
      [warehouse_id]
    );
    
    let actualWarehouseId = warehouse_id;
    
    // If warehouse doesn't exist, create it with basic info
    if (warehouseResult.rows.length === 0) {
      logger.warn(`Warehouse ${warehouse_id} not found, creating placeholder`);
      try {
        const newWarehouse = await pool.query(
          `INSERT INTO warehouses (code, name, address, is_active, created_at)
           VALUES ($1, $2, $3, true, NOW())
           ON CONFLICT (code) DO UPDATE SET code = EXCLUDED.code
           RETURNING id`,
          [
            warehouse_id,
            `Warehouse ${warehouse_id}`,
            JSON.stringify({ street: 'TBD', city: 'TBD', state: 'TBD', postal_code: '00000', country: 'US' })
          ]
        );
        actualWarehouseId = newWarehouse.rows[0].id;
        logger.info(`Created placeholder warehouse with ID ${actualWarehouseId}`);
      } catch (error) {
        // Race condition: another job created it, fetch it again
        if (error.code === '23505') {
          const retryResult = await pool.query(
            'SELECT id FROM warehouses WHERE code = $1 LIMIT 1',
            [warehouse_id]
          );
          actualWarehouseId = retryResult.rows[0].id;
          logger.info(`Warehouse ${warehouse_id} was created by another job, using ID ${actualWarehouseId}`);
        } else {
          throw error;
        }
      }
    } else {
      actualWarehouseId = warehouseResult.rows[0].id;
    }
    
    let updatedCount = 0;
    
    for (const item of items || []) {
      const result = await pool.query(
        `INSERT INTO inventory (warehouse_id, sku, product_name, quantity, bin_location, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (warehouse_id, sku)
         DO UPDATE SET 
           quantity = EXCLUDED.quantity,
           bin_location = EXCLUDED.bin_location,
           product_name = EXCLUDED.product_name,
           updated_at = NOW()
         RETURNING id`,
        [actualWarehouseId, item.sku, item.product_name, item.new_quantity, item.bin_location]
      );
      
      if (result.rows.length > 0) updatedCount++;
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
    const { return_id, original_order_id, customer, items, refund_amount } = payload;
    
    logger.info(`Processing return ${return_id} for order ${original_order_id}`);
    
    // Insert return into database
    const result = await pool.query(
      `INSERT INTO returns (
        external_return_id, order_id, customer_name, customer_email,
        items, refund_amount, status, created_at
      ) VALUES ($1, 
        (SELECT id FROM orders WHERE external_order_id = $2 LIMIT 1),
        $3, $4, $5, $6, 'pending', NOW())
      RETURNING id`,
      [
        return_id,
        original_order_id,
        customer.name,
        customer.email,
        JSON.stringify(items),
        refund_amount
      ]
    );
    
    logger.info(`✅ Return ${return_id} processed as ID ${result.rows[0].id}`);
    
    return {
      success: true,
      returnId: result.rows[0].id,
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
