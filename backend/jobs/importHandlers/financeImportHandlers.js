import financeRepo from '../../repositories/FinanceRepository.js';
import carrierRepo from '../../repositories/CarrierRepository.js';
import { runImport } from '../importRunner.js';

function runFinanceImport(payload, processRow) {
  const { rows, filePath, dryRun = false, maxRows, organizationId, _jobId: jobId } = payload;
  return runImport({
    jobId,
    organizationId,
    rows,
    filePath,
    dryRun,
    maxRows,
    importType: 'finance',
    processRow,
  });
}

function parseAmount(value) {
  const amount = Number.parseFloat(String(value ?? '').trim());
  if (!Number.isFinite(amount)) {
    throw new Error('Invalid numeric amount');
  }
  return amount;
}

function parseDate(value, fieldName) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return date.toISOString().slice(0, 10);
}

export async function handleImportFinance(payload) {
  const { organizationId } = payload;
  return runFinanceImport(payload, async (row, ctx) => {
    const validStatuses = new Set(['pending', 'approved', 'disputed', 'paid', 'cancelled']);
    const invoiceNumber = String(row.invoice_number || '').trim();
    const carrierName = String(row.carrier_name || '').trim();
    const carrierCode = String(row.carrier_code || row.carrier_id || '').trim();
    if (!invoiceNumber) throw new Error('invoice_number is required');
    if (!carrierName && !carrierCode) throw new Error('carrier_name or carrier_code is required');

    let carrier = null;
    if (row.carrier_id) {
      carrier = await carrierRepo.findById(row.carrier_id, organizationId);
    }
    if (!carrier && carrierCode) {
      carrier = await carrierRepo.findByCode(carrierCode, organizationId);
    }
    if (!carrier && carrierName) {
      const byName = await carrierRepo.query(
        `SELECT * FROM carriers WHERE LOWER(name) = LOWER($1) AND (organization_id = $2 OR organization_id IS NULL) LIMIT 1`,
        [carrierName, organizationId],
      );
      carrier = byName.rows[0] || null;
    }
    if (!carrier) throw new Error(`Unknown carrier: ${carrierName || carrierCode}`);

    const existing = await financeRepo.invoiceNumberExists(invoiceNumber, organizationId);
    if (existing) throw new Error(`Duplicate invoice_number: ${invoiceNumber}`);

    const billingPeriodStart = parseDate(row.billing_period_start, 'billing_period_start');
    const billingPeriodEnd = parseDate(row.billing_period_end, 'billing_period_end');
    if (new Date(billingPeriodEnd) < new Date(billingPeriodStart)) {
      throw new Error('billing_period_end must be on or after billing_period_start');
    }

    const totalShipments = Number.parseInt(String(row.total_shipments ?? '0'), 10);
    if (!Number.isFinite(totalShipments) || totalShipments < 0) {
      throw new Error('total_shipments must be a non-negative integer');
    }

    const baseAmount = parseAmount(row.base_amount ?? 0);
    const penalties = parseAmount(row.penalties ?? 0);
    const adjustments = parseAmount(row.adjustments ?? 0);
    const finalAmount = parseAmount(row.final_amount ?? 0);
    const expectedFinal = baseAmount + adjustments - penalties;
    const diff = Math.abs(finalAmount - expectedFinal);
    if (diff > 0.01) {
      throw new Error(`final_amount must equal base_amount + adjustments - penalties (expected ${expectedFinal.toFixed(2)})`);
    }

    if (ctx.dryRun) return;

    const status = String(row.status || 'pending').trim() || 'pending';
    if (!validStatuses.has(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    await financeRepo.createInvoice(
      {
        organizationId,
        invoiceNumber,
        carrierId: carrier.id,
        billingPeriodStart,
        billingPeriodEnd,
        totalShipments,
        baseAmount,
        penalties,
        adjustments,
        finalAmount,
        status,
      },
      null
    );
  });
}