import logger from '../utils/logger.js';
import returnRepo from '../repositories/ReturnRepository.js';
import carrierRepo from '../repositories/CarrierRepository.js';
import slaRepo from '../repositories/SlaRepository.js';
import financeRepo from '../repositories/FinanceRepository.js';
import warehouseRepo from '../repositories/WarehouseRepository.js';

/**
 * Report Generation Job
 * Generates various reports (analytics, performance, etc.)
 */
export async function handleReportGeneration(payload) {
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

async function generateCarrierPerformanceReport(parameters) {
  const { carrierId, startDate, endDate } = parameters;

  const rows = await carrierRepo.getPerformanceReport(carrierId, startDate, endDate);

  logger.info('Generated carrier performance report', {
    carrierId,
    startDate,
    endDate,
    rows: rows.length,
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
