// Job Handlers - Define handlers for each job type
import {
  handleImportInventory,
  handleImportOrders,
  handleImportShipments,
} from './importHandlers/commerceImportHandlers.js';
import {
  handleImportWarehouses,
  handleImportCarriers,
  handleImportSuppliers,
  handleImportChannels,
  handleImportTeam,
  handleImportProducts,
} from './importHandlers/masterDataImportHandlers.js';
import {
  handleSLAMonitoring,
  handleExceptionEscalation,
  handleInvoiceGeneration,
  handleReturnPickupReminder,
  handleDataCleanup,
  handleNotificationDispatch,
  handleInventorySync,
  handleCarrierAssignmentRetry,
} from './scheduledHandlers.js';
import { handleReportGeneration } from './reportHandlers.js';
import {
  handleProcessOrder,
  handleUpdateTracking,
  handleSyncInventory,
  handleProcessReturn,
  handleProcessRates,
} from './webhookHandlers.js';

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
  // CSV import handlers
  'import:warehouses': handleImportWarehouses,
  'import:carriers':   handleImportCarriers,
  'import:suppliers':  handleImportSuppliers,
  'import:channels':   handleImportChannels,
  'import:team':       handleImportTeam,
  'import:products':   handleImportProducts,
  'import:inventory':  handleImportInventory,
  'import:orders':     handleImportOrders,
  'import:shipments':  handleImportShipments,
};

export default jobHandlers;
