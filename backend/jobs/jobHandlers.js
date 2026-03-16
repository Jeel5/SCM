// Job Handlers - Define handlers for each job type
import pool from '../config/db.js';
import fs from 'fs';
import readline from 'readline';
import bcrypt from 'bcrypt';
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
import { emitToOrg } from '../sockets/emitter.js';
import emailService from '../services/emailService.js';

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

// ─── Import helpers ───────────────────────────────────────────────────────────

const IMPORT_CHUNK_SIZE = 100; // rows between progress emits
const DEFAULT_MAX_IMPORT_ROWS = 200_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Shared runner: iterates rows, catches per-row errors, emits socket events.
 * Handlers inject `_jobId` via jobWorker (see processJob).
 */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function* iterCsvRows(filePath, maxRows = DEFAULT_MAX_IMPORT_ROWS) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let headers = null;
  let seenRows = 0;

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;

    if (!headers) {
      const normalized = rawLine.charCodeAt(0) === 0xfeff ? rawLine.slice(1) : rawLine;
      headers = parseCsvLine(normalized).map((h) => h.trim());
      continue;
    }

    const values = parseCsvLine(rawLine);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim();
    });

    if (Object.values(row).every((v) => !v)) continue;

    seenRows++;
    if (seenRows > maxRows) {
      throw new Error(`CSV too large: exceeds ${maxRows} rows`);
    }

    yield row;
  }
}

async function runImport({ jobId, organizationId, rows, filePath, importType, processRow, dryRun = false, maxRows = DEFAULT_MAX_IMPORT_ROWS }) {
  const startTime = Date.now();
  const useRows = Array.isArray(rows);
  const total = useRows ? rows.length : null;
  let created = 0;
  let failed  = 0;
  const errors = [];
  let processed = 0;

  const sourceRows = useRows ? rows : iterCsvRows(filePath, maxRows);

  try {
    for await (const row of sourceRows) {
      processed++;
      try {
        await processRow(row, { dryRun });
        created++;
      } catch (err) {
        failed++;
        if (errors.length < 20) errors.push({ row: processed, message: err.message });
      }

      if (processed % IMPORT_CHUNK_SIZE === 0 || (total !== null && processed === total)) {
        emitToOrg(organizationId, 'import:progress', {
          jobId,
          importType,
          done: processed,
          total,
          created,
          failed,
          dryRun,
        });
      }
    }

    const result = {
      success: failed < processed,
      importType,
      total: total ?? processed,
      processed,
      created,
      failed,
      dryRun,
      errors,
      duration: `${Date.now() - startTime}ms`,
    };

    if (created === 0) {
      const errorSummary = errors.length > 0
        ? errors
            .slice(0, 3)
            .map(({ row, message }) => `row ${row}: ${message}`)
            .join('; ')
        : 'All rows failed during import';

      emitToOrg(organizationId, 'import:complete', {
        jobId,
        importType,
        ...result,
        errorMessage: errorSummary,
      });

      logger.error(`❌ Import ${importType} failed`, { jobId, total: result.total, failed, dryRun, errorSummary });
      throw new Error(errorSummary);
    }

    emitToOrg(organizationId, 'import:complete', { jobId, importType, ...result });
    logger.info(`✅ Import ${importType} complete`, { jobId, total: result.total, created, failed, dryRun });
    return result;
  } finally {
    if (!useRows && filePath) {
      try {
        await fs.promises.unlink(filePath);
      } catch {
        // best-effort cleanup
      }
    }
  }
}

function parseJsonObject(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeShipmentStatus(rawStatus) {
  const status = String(rawStatus || 'delivered').toLowerCase().trim();
  const statusMap = {
    pickup_scheduled: 'pending',
    created: 'pending',
    at_hub: 'in_transit',
    failed_delivery: 'exception',
    failed: 'exception',
    exception: 'exception',
  };
  const normalized = statusMap[status] || status;
  const validStatuses = [
    'pending', 'picked_up', 'in_transit', 'out_for_delivery',
    'delivered', 'cancelled', 'exception', 'returned',
  ];
  return validStatuses.includes(normalized) ? normalized : 'delivered';
}

function buildAddress(prefix, row, fallback = null) {
  const street = row[`${prefix}_street`] || row[`${prefix}_address`] || fallback?.street || 'N/A';
  const city = row[`${prefix}_city`] || fallback?.city || 'Unknown';
  const state = row[`${prefix}_state`] || fallback?.state || '';
  const postalCode = row[`${prefix}_postal_code`] || row[`${prefix}_postalCode`] || fallback?.postal_code || '';
  const country = row[`${prefix}_country`] || fallback?.country || 'India';

  return {
    street,
    city,
    state,
    postal_code: postalCode,
    country,
  };
}

function buildShipmentEvents(status, origin, destination, currentLocation, pickupActual, deliveryActual) {
  const baseTime = new Date();
  const pickupTime = pickupActual ? new Date(pickupActual) : new Date(baseTime.getTime() - 2 * 24 * 3_600_000);
  const transitTime = new Date(pickupTime.getTime() + 12 * 3_600_000);
  const outForDeliveryTime = new Date(transitTime.getTime() + 24 * 3_600_000);
  const deliveredTime = deliveryActual ? new Date(deliveryActual) : new Date(outForDeliveryTime.getTime() + 6 * 3_600_000);

  const eventSets = {
    pending: [],
    picked_up: [
      { event_type: 'picked_up', description: 'Shipment picked up from origin', location: origin, event_timestamp: pickupTime },
    ],
    in_transit: [
      { event_type: 'picked_up', description: 'Shipment picked up from origin', location: origin, event_timestamp: pickupTime },
      { event_type: 'in_transit', description: 'Shipment is in transit', location: currentLocation || origin, event_timestamp: transitTime },
    ],
    out_for_delivery: [
      { event_type: 'picked_up', description: 'Shipment picked up from origin', location: origin, event_timestamp: pickupTime },
      { event_type: 'in_transit', description: 'Shipment is in transit', location: currentLocation || origin, event_timestamp: transitTime },
      { event_type: 'out_for_delivery', description: 'Shipment is out for delivery', location: currentLocation || destination, event_timestamp: outForDeliveryTime },
    ],
    delivered: [
      { event_type: 'picked_up', description: 'Shipment picked up from origin', location: origin, event_timestamp: pickupTime },
      { event_type: 'in_transit', description: 'Shipment is in transit', location: currentLocation || origin, event_timestamp: transitTime },
      { event_type: 'out_for_delivery', description: 'Shipment is out for delivery', location: destination, event_timestamp: outForDeliveryTime },
      { event_type: 'delivered', description: 'Shipment delivered successfully', location: destination, event_timestamp: deliveredTime },
    ],
    returned: [
      { event_type: 'picked_up', description: 'Shipment picked up from origin', location: origin, event_timestamp: pickupTime },
      { event_type: 'in_transit', description: 'Shipment is in transit', location: currentLocation || origin, event_timestamp: transitTime },
      { event_type: 'returned', description: 'Shipment returned to sender', location: origin, event_timestamp: deliveredTime },
    ],
    cancelled: [
      { event_type: 'cancelled', description: 'Shipment cancelled before delivery', location: origin, event_timestamp: pickupTime },
    ],
    exception: [
      { event_type: 'picked_up', description: 'Shipment picked up from origin', location: origin, event_timestamp: pickupTime },
      { event_type: 'exception', description: 'Shipment hit an exception in transit', location: currentLocation || destination, event_timestamp: deliveredTime },
    ],
  };

  return eventSets[status] || [];
}

// ─── 1. Warehouses ────────────────────────────────────────────────────────────
async function handleImportWarehouses(payload) {
  const { rows, filePath, dryRun = false, maxRows, organizationId, _jobId: jobId } = payload;
  return runImport({
    jobId, organizationId, rows, filePath, dryRun, maxRows, importType: 'warehouses',
    processRow: async (row, ctx) => {
      if (!row.name) throw new Error('name is required');
      const typeMap = {
        'cross-dock': 'distribution', staging: 'distribution', retail: 'standard',
        fulfillment: 'fulfillment', distribution: 'distribution', standard: 'standard',
        cold_storage: 'cold_storage', hazmat: 'hazmat',
        bonded_customs: 'bonded_customs', returns: 'returns_center', returns_center: 'returns_center',
      };
      const wType = typeMap[String(row.type || row.warehouse_type || 'standard').toLowerCase()] || 'standard';
      const isActive = String(row.status || 'active').toLowerCase() !== 'inactive'
        && String(row.is_active || 'true').toLowerCase() !== 'false';
      const rawEmail = String(row.contact_email || '').trim();
      const email = rawEmail.includes('@') ? rawEmail
        : `${String(row.code || row.name || 'wh').toLowerCase().replace(/[^a-z0-9]+/g, '.')}@import.local`;
      const address = JSON.stringify({
        street:      row.street      || row.address_street || '',
        city:        row.city        || row.address_city   || '',
        state:       row.state       || row.address_state  || '',
        postal_code: row.postal_code || row.postalCode     || '',
        country:     row.country     || 'India',
      });
      if (ctx.dryRun) return;
      await pool.query(
        `INSERT INTO warehouses
           (organization_id, name, code, warehouse_type, capacity, address, contact_email, contact_phone, is_active)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
         ON CONFLICT (organization_id, code) DO UPDATE SET
           name = EXCLUDED.name, warehouse_type = EXCLUDED.warehouse_type,
           capacity = EXCLUDED.capacity, address = EXCLUDED.address,
           contact_email = EXCLUDED.contact_email, updated_at = NOW()`,
        [organizationId, row.name, row.code || null, wType, Number(row.capacity) || 0,
         address, email, row.contact_phone || null, isActive]
      );
    },
  });
}

// ─── 2. Carriers ─────────────────────────────────────────────────────────────
async function handleImportCarriers(payload) {
  const { rows, filePath, dryRun = false, maxRows, organizationId, _jobId: jobId } = payload;
  return runImport({
    jobId, organizationId, rows, filePath, dryRun, maxRows, importType: 'carriers',
    processRow: async (row, ctx) => {
      if (!row.name) throw new Error('name is required');
      const validSvcTypes = ['express','standard','economy','overnight','two_day','surface','air','all'];
      const svcType = validSvcTypes.includes(row.service_type) ? row.service_type : 'standard';
      const baseCode = String(row.code || row.name || 'carrier')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
      const code = baseCode || await carrierRepo.generateCarrierCode();
      if (ctx.dryRun) return;
      await pool.query(
        `INSERT INTO carriers
           (organization_id, code, name, service_type, contact_email, contact_phone, website,
            reliability_score, avg_delivery_days, is_active, availability_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (organization_id, code) DO UPDATE SET
           name = EXCLUDED.name,
           service_type = EXCLUDED.service_type, contact_email = EXCLUDED.contact_email,
           contact_phone = EXCLUDED.contact_phone, website = EXCLUDED.website,
           updated_at = NOW()`,
        [organizationId, code, row.name, svcType,
         row.contact_email || null, row.contact_phone || null, row.website || null,
         row.reliability_score ? parseFloat(row.reliability_score) : 0.85,
         row.avg_delivery_days ? parseInt(row.avg_delivery_days) : 3,
         String(row.is_active || 'true').toLowerCase() !== 'false',
         'available']
      );
    },
  });
}

// ─── 3. Suppliers ─────────────────────────────────────────────────────────────
async function handleImportSuppliers(payload) {
  const { rows, filePath, dryRun = false, maxRows, organizationId, _jobId: jobId } = payload;
  return runImport({
    jobId, organizationId, rows, filePath, dryRun, maxRows, importType: 'suppliers',
    processRow: async (row, ctx) => {
      if (!row.name) throw new Error('name is required');
      if (ctx.dryRun) return;
      await pool.query(
        `INSERT INTO suppliers
           (organization_id, name, contact_name, contact_email, contact_phone,
            website, address, city, state, country, postal_code,
            lead_time_days, reliability_score, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (organization_id, name) DO UPDATE SET
           contact_email = EXCLUDED.contact_email, updated_at = NOW()`,
        [organizationId, row.name, row.contact_name || null,
         row.contact_email || null, row.contact_phone || null, row.website || null,
         row.address || null, row.city || null, row.state || null,
         row.country || 'India', row.postal_code || null,
         row.lead_time_days ? parseInt(row.lead_time_days) : 7,
         row.reliability_score ? parseFloat(row.reliability_score) : 0.85,
         String(row.is_active || 'true').toLowerCase() !== 'false']
      );
    },
  });
}

// ─── 4. Sales Channels ────────────────────────────────────────────────────────
async function handleImportChannels(payload) {
  const { rows, filePath, dryRun = false, maxRows, organizationId, _jobId: jobId } = payload;
  return runImport({
    jobId, organizationId, rows, filePath, dryRun, maxRows, importType: 'channels',
    processRow: async (row, ctx) => {
      if (!row.name) throw new Error('name is required');
      const validTypes = ['marketplace','d2c','b2b','wholesale','internal'];
      const platformType = validTypes.includes(row.platform_type) ? row.platform_type : 'marketplace';
      const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = (row.code ||
        String(row.name || 'CH').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 36)
      ) + '-' + suffix;
      if (ctx.dryRun) return;
      await pool.query(
        `INSERT INTO sales_channels
           (organization_id, name, code, platform_type, contact_name, contact_email, contact_phone, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (organization_id, code) DO UPDATE SET
           name = EXCLUDED.name, updated_at = NOW()`,
        [organizationId, row.name, code, platformType,
         row.contact_name || null, row.contact_email || null, row.contact_phone || null,
         String(row.is_active || 'true').toLowerCase() !== 'false']
      );
    },
  });
}

// ─── 5. Team (Org users) ──────────────────────────────────────────────────────
async function handleImportTeam(payload) {
  const { rows, filePath, dryRun = false, maxRows, organizationId, _jobId: jobId } = payload;
  // Placeholder password — users must reset via forgot-password flow
  const placeholderHash = await bcrypt.hash(`Import@${Date.now()}!`, 12);
  return runImport({
    jobId, organizationId, rows, filePath, dryRun, maxRows, importType: 'team',
    processRow: async (row, ctx) => {
      if (!row.email || !row.email.includes('@')) throw new Error('Missing or invalid email');
      const validRoles = ['operations_manager','warehouse_manager','carrier_partner','finance','customer_support'];
      const role = validRoles.includes(row.role) ? row.role : 'operations_manager';
      if (ctx.dryRun) return;
      await pool.query(
        `INSERT INTO users
           (organization_id, name, email, phone, role, password_hash, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (email) DO NOTHING`,
        [organizationId, row.name || row.email,
         row.email.toLowerCase().trim(), row.phone || null,
         role, placeholderHash, true]
      );
    },
  });
}

// ─── 6. Products ──────────────────────────────────────────────────────────────
async function handleImportProducts(payload) {
  const { rows, filePath, dryRun = false, maxRows, organizationId, _jobId: jobId } = payload;
  return runImport({
    jobId, organizationId, rows, filePath, dryRun, maxRows, importType: 'products',
    processRow: async (row, ctx) => {
      if (!row.name && !row.sku) throw new Error('name or sku is required');
      const { v4: uuidv4 } = await import('uuid');
      const sku = row.sku || `SKU-${uuidv4().substring(0, 8).toUpperCase()}`;
      if (ctx.dryRun) return;
      await pool.query(
        `INSERT INTO products
           (organization_id, name, sku, category, description, weight,
            selling_price, cost_price, currency, is_active, brand)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (organization_id, sku) DO UPDATE SET
           name = EXCLUDED.name, updated_at = NOW()`,
        [organizationId, row.name, sku, row.category || null,
         row.description || null,
         row.weight       ? parseFloat(row.weight)       : null,
         row.selling_price ? parseFloat(row.selling_price) : null,
         row.cost_price    ? parseFloat(row.cost_price)    : null,
         row.currency || 'INR',
         String(row.is_active || 'true').toLowerCase() !== 'false',
         row.brand || null]
      );
    },
  });
}

// ─── 7. Inventory ─────────────────────────────────────────────────────────────
async function handleImportInventory(payload) {
  const { rows, filePath, dryRun = false, maxRows, organizationId, _jobId: jobId } = payload;

  // Build lookup maps once (before row loop)
  const whRes = await pool.query(
    `SELECT id, code, name FROM warehouses WHERE organization_id = $1`, [organizationId]);
  const byWhCode = new Map(whRes.rows.map((w) => [w.code?.toLowerCase(), w.id]));
  const byWhName = new Map(whRes.rows.map((w) => [w.name?.toLowerCase(), w.id]));

  const prRes = await pool.query(
    `SELECT id, sku, name FROM products WHERE organization_id = $1`, [organizationId]);
  const byPrSku  = new Map(prRes.rows.map((p) => [p.sku?.toLowerCase(),  p.id]));
  const byPrName = new Map(prRes.rows.map((p) => [p.name?.toLowerCase(), p.id]));

  return runImport({
    jobId, organizationId, rows, filePath, dryRun, maxRows, importType: 'inventory',
    processRow: async (row, ctx) => {
      let warehouseId = UUID_RE.test(row.warehouse_id) ? row.warehouse_id : null;
      if (!warehouseId) {
        const placeholder = String(row.warehouse_id || '').match(/^REPLACE_WITH_UUID_FOR_(.+)$/i)?.[1]?.toLowerCase();
        warehouseId = (placeholder && byWhCode.get(placeholder))
          || byWhCode.get(String(row.warehouse_id || '').toLowerCase())
          || byWhCode.get(String(row.warehouse_code || '').toLowerCase())
          || byWhName.get(String(row.warehouse_name || '').toLowerCase())
          || null;
      }
      if (!warehouseId) throw new Error(`Cannot resolve warehouse for SKU '${row.sku}'`);

      let productId = UUID_RE.test(row.product_id) ? row.product_id : null;
      if (!productId) {
        productId = byPrSku.get(String(row.sku || '').toLowerCase())
          || byPrName.get(String(row.product_name || '').toLowerCase())
          || null;
      }
      if (!productId) throw new Error(`Cannot resolve product for SKU '${row.sku}'`);

      const qty = parseInt(row.quantity) || 0;
      if (ctx.dryRun) return;
      await pool.query(
        `INSERT INTO inventory
           (organization_id, warehouse_id, product_id, sku, product_name,
            quantity, available_quantity, reserved_quantity, reorder_point, unit_cost)
         VALUES ($1,$2,$3,$4,$5,$6,$6,0,$7,$8)
         ON CONFLICT (organization_id, warehouse_id, sku) DO UPDATE SET
           quantity           = EXCLUDED.quantity,
           available_quantity = EXCLUDED.quantity,
           updated_at         = NOW()`,
        [organizationId, warehouseId, productId,
         row.sku, row.product_name || row.sku, qty,
         row.reorder_point ? parseInt(row.reorder_point) : null,
         row.unit_cost     ? parseFloat(row.unit_cost)   : null]
      );
    },
  });
}

// ─── 9. Shipments (historical — linked to existing orders by order_number) ──
async function handleImportShipments(payload) {
  const { rows, filePath, dryRun = false, maxRows, organizationId, _jobId: jobId } = payload;

  const [ordersRes, carriersRes, warehousesRes] = await Promise.all([
    pool.query(
      `SELECT id, order_number, shipping_address FROM orders WHERE organization_id = $1`,
      [organizationId]
    ),
    pool.query(
      `SELECT id, code, name FROM carriers WHERE organization_id = $1`,
      [organizationId]
    ),
    pool.query(
      `SELECT id, code, name, address FROM warehouses WHERE organization_id = $1`,
      [organizationId]
    ),
  ]);

  const ordersById = new Map(ordersRes.rows.map((order) => [order.id, order]));
  const ordersByNumber = new Map(ordersRes.rows.map((order) => [String(order.order_number || '').toLowerCase(), order]));
  const carriersById = new Map(carriersRes.rows.map((carrier) => [carrier.id, carrier]));
  const carriersByCode = new Map(carriersRes.rows.map((carrier) => [String(carrier.code || '').toLowerCase(), carrier]));
  const carriersByName = new Map(carriersRes.rows.map((carrier) => [String(carrier.name || '').toLowerCase(), carrier]));
  const warehousesById = new Map(warehousesRes.rows.map((warehouse) => [warehouse.id, warehouse]));
  const warehousesByCode = new Map(warehousesRes.rows.map((warehouse) => [String(warehouse.code || '').toLowerCase(), warehouse]));
  const warehousesByName = new Map(warehousesRes.rows.map((warehouse) => [String(warehouse.name || '').toLowerCase(), warehouse]));

  return runImport({
    jobId,
    organizationId,
    rows,
    filePath,
    dryRun,
    maxRows,
    importType: 'shipments',
    processRow: async (row, ctx) => {
      const order = (row.order_id && ordersById.get(row.order_id))
        || (row.order_number && ordersByNumber.get(String(row.order_number).toLowerCase()));
      if (!order) {
        throw new Error(`Cannot resolve order '${row.order_number || row.order_id || 'unknown'}'`);
      }

      const carrier = (row.carrier_id && carriersById.get(row.carrier_id))
        || (row.carrier_code && carriersByCode.get(String(row.carrier_code).toLowerCase()))
        || (row.carrier_name && carriersByName.get(String(row.carrier_name).toLowerCase()));
      if (!carrier) {
        throw new Error(`Cannot resolve carrier '${row.carrier_code || row.carrier_name || row.carrier_id || 'unknown'}'`);
      }

      const warehouse = (row.warehouse_id && UUID_RE.test(row.warehouse_id) && warehousesById.get(row.warehouse_id))
        || (row.warehouse_code && warehousesByCode.get(String(row.warehouse_code).toLowerCase()))
        || (row.warehouse_name && warehousesByName.get(String(row.warehouse_name).toLowerCase()))
        || null;

      const destinationAddress = parseJsonObject(order.shipping_address) || {
        street: 'N/A',
        city: 'Unknown',
        state: '',
        postal_code: '',
        country: 'India',
      };
      const warehouseAddress = parseJsonObject(warehouse?.address) || null;
      const originAddress = buildAddress('origin', row, warehouseAddress);
      const currentLocation = row.current_city || row.current_state || row.current_country
        ? buildAddress('current', row, null)
        : null;
      const status = normalizeShipmentStatus(row.status);
      const trackingNumber = row.tracking_number
        || row.carrier_tracking_number
        || `IMP-SHP-${String(order.order_number || order.id).slice(-10)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const deliveryScheduled = row.delivery_scheduled || row.estimated_delivery || null;
      const pickupScheduled = row.pickup_scheduled || null;
      const pickupActual = row.pickup_actual || null;
      const deliveryActual = row.delivery_actual || row.actual_delivery || (status === 'delivered' ? deliveryScheduled || new Date().toISOString() : null);
      const shippingCost = row.shipping_cost ? parseFloat(row.shipping_cost) : (row.cost ? parseFloat(row.cost) : 0);
      const carrierTrackingNumber = row.carrier_tracking_number || null;
      const timelineEvents = buildShipmentEvents(status, originAddress, destinationAddress, currentLocation, pickupActual, deliveryActual);

      if (ctx.dryRun) return;

      const client = await pool.connect();
      let shipmentId;
      let eventName = 'shipment:created';

      try {
        await client.query('BEGIN');

        const existingRes = await client.query(
          `SELECT id FROM shipments WHERE organization_id = $1 AND tracking_number = $2 ORDER BY created_at ASC LIMIT 1`,
          [organizationId, trackingNumber]
        );
        const existingShipment = existingRes.rows[0] || null;

        if (existingShipment) {
          eventName = 'shipment:updated';
          const updatedRes = await client.query(
            `UPDATE shipments
             SET order_id = $1,
                 carrier_id = $2,
                 warehouse_id = $3,
                 carrier_tracking_number = $4,
                 status = $5,
                 origin_address = $6::jsonb,
                 destination_address = $7::jsonb,
                 current_location = $8::jsonb,
                 pickup_scheduled = $9,
                 pickup_actual = $10,
                 delivery_scheduled = $11,
                 delivery_actual = $12,
                 shipping_cost = $13,
                 updated_at = NOW()
             WHERE id = $14
             RETURNING id`,
            [
              order.id,
              carrier.id,
              warehouse?.id || null,
              carrierTrackingNumber,
              status,
              JSON.stringify(originAddress),
              JSON.stringify(destinationAddress),
              currentLocation ? JSON.stringify(currentLocation) : null,
              pickupScheduled,
              pickupActual,
              deliveryScheduled,
              deliveryActual,
              shippingCost,
              existingShipment.id,
            ]
          );
          shipmentId = updatedRes.rows[0].id;
        } else {
          const insertedRes = await client.query(
            `INSERT INTO shipments (
               organization_id, tracking_number, carrier_tracking_number, order_id, carrier_id,
               warehouse_id, status, origin_address, destination_address, current_location,
               pickup_scheduled, pickup_actual, delivery_scheduled, delivery_actual, shipping_cost
             ) VALUES (
               $1,$2,$3,$4,$5,
               $6,$7,$8::jsonb,$9::jsonb,$10::jsonb,
               $11,$12,$13,$14,$15
             )
             RETURNING id`,
            [
              organizationId,
              trackingNumber,
              carrierTrackingNumber,
              order.id,
              carrier.id,
              warehouse?.id || null,
              status,
              JSON.stringify(originAddress),
              JSON.stringify(destinationAddress),
              currentLocation ? JSON.stringify(currentLocation) : null,
              pickupScheduled,
              pickupActual,
              deliveryScheduled,
              deliveryActual,
              shippingCost,
            ]
          );
          shipmentId = insertedRes.rows[0].id;

          await client.query(
            `INSERT INTO shipment_events (shipment_id, event_type, location, description, event_timestamp)
             VALUES ($1, 'created', $2::jsonb, $3, $4)`,
            [
              shipmentId,
              JSON.stringify(originAddress),
              row.notes || 'Shipment imported from CSV',
              pickupScheduled || pickupActual || deliveryScheduled || deliveryActual || new Date().toISOString(),
            ]
          );

          for (const event of timelineEvents) {
            await client.query(
              `INSERT INTO shipment_events (shipment_id, event_type, location, description, event_timestamp)
               VALUES ($1, $2, $3::jsonb, $4, $5)`,
              [
                shipmentId,
                event.event_type,
                JSON.stringify(event.location),
                event.description,
                event.event_timestamp,
              ]
            );
          }
        }

        if (status === 'delivered') {
          await client.query(
            `UPDATE orders
             SET status = 'delivered', actual_delivery = COALESCE($1, actual_delivery, NOW()), updated_at = NOW()
             WHERE id = $2`,
            [deliveryActual, order.id]
          );
        } else if (status === 'returned') {
          await client.query(
            `UPDATE orders SET status = 'returned', updated_at = NOW() WHERE id = $1`,
            [order.id]
          );
        } else if (status === 'cancelled') {
          await client.query(
            `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
            [order.id]
          );
        } else {
          await client.query(
            `UPDATE orders SET status = 'shipped', updated_at = NOW() WHERE id = $1`,
            [order.id]
          );
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      emitToOrg(organizationId, eventName, {
        id: shipmentId,
        orderId: order.id,
        trackingNumber,
        status,
      });
    },
  });
}

// ─── 8. Orders (historical — no carrier assignment or inventory reservation) ──
async function handleImportOrders(payload) {
  const { rows, filePath, dryRun = false, maxRows, organizationId, _jobId: jobId } = payload;
  return runImport({
    jobId, organizationId, rows, filePath, dryRun, maxRows, importType: 'orders',
    processRow: async (row, ctx) => {
      if (!row.customer_name) throw new Error('customer_name is required');
      if (!row.sku) throw new Error('sku is required');
      const unitPrice = parseFloat(row.unit_price) || 0;
      const qty       = parseInt(row.quantity) || 1;
      const lineTotal = unitPrice * qty;

      // Live DB check constraints differ from older code assumptions:
      // - order_type must be one of: outbound|transfer|inbound_restock
      // - priority must be one of: express|standard|bulk|same_day
      const rawPriority = String(row.priority || 'standard').toLowerCase();
      const priorityMap = { urgent: 'express', normal: 'standard' };
      const normalizedPriority = priorityMap[rawPriority] || rawPriority;
      const validPriorities = ['express', 'standard', 'bulk', 'same_day'];
      const priority = validPriorities.includes(normalizedPriority) ? normalizedPriority : 'standard';

      const rawStatus = String(row.status || 'delivered').toLowerCase();
      const validStatuses = [
        'created','confirmed','processing','allocated','ready_to_ship','shipped',
        'in_transit','out_for_delivery','delivered','returned','cancelled','on_hold','pending_carrier_assignment',
      ];
      const status = validStatuses.includes(rawStatus) ? rawStatus : 'delivered';

      const shippingAddress = {
        street:      row.street      || 'N/A',
        city:        row.city        || 'N/A',
        state:       row.state       || '',
        postal_code: row.postal_code || '000000',
        country:     row.country     || 'India',
      };

      if (ctx.dryRun) return;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const providedOrderNumber = String(row.order_number || '').trim();
        const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const fallbackSuffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
        const orderNumber = providedOrderNumber || `IMP-${datePart}-${fallbackSuffix}`;

        const orderRes = await client.query(
          `INSERT INTO orders (
             organization_id, order_number, customer_name, customer_email, customer_phone,
             status, priority, order_type, currency, shipping_address,
             subtotal, tax_amount, shipping_amount, discount_amount, total_amount,
             notes, platform, tags
           ) VALUES (
             $1,$2,$3,$4,$5,
             $6,$7,$8,$9,$10::jsonb,
             $11,0,0,0,$12,
             $13,$14,$15::jsonb
           ) RETURNING id`,
          [
            organizationId,
            orderNumber,
            row.customer_name,
            row.customer_email || null,
            row.customer_phone || null,
            status,
            priority,
            'outbound',
            row.currency || 'INR',
            JSON.stringify(shippingAddress),
            lineTotal,
            lineTotal,
            row.notes || 'Historical import',
            'import',
            JSON.stringify({ imported: true, import_job: jobId }),
          ]
        );

        await client.query(
          `INSERT INTO order_items (
             order_id, sku, product_name, quantity, unit_price,
             total_price, item_type, package_type
           ) VALUES ($1,$2,$3,$4,$5,$6,'general','box')`,
          [
            orderRes.rows[0].id,
            row.sku,
            row.product_name || row.sku,
            qty,
            unitPrice,
            lineTotal,
          ]
        );

        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
  });
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
        // Mark reminder as sent only when dispatch succeeds.
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
    const { source, order, organization_id, webhook_channel_id } = payload;

    logger.info(`Processing order from ${source}` +
      (organization_id ? ` (org: ${organization_id})` : ' (no org)'));

    // ── Normalise payload ───────────────────────────────────────────────────
    // Different platforms send customer data differently.
    // Support both flat (customer_name) and nested (customer.name) shapes.
    if (!order) throw new Error('Webhook job payload is missing the "order" object');

    const customerName  = order.customer_name  || order.customer?.name  || null;
    const customerEmail = order.customer_email || order.customer?.email || null;
    const customerPhone = order.customer_phone || order.customer?.phone || order.customer?.mobile || null;

    // ── Validate required fields before touching the DB ─────────────────────
    if (!customerName) {
      throw new Error(
        'Webhook order missing required field: customer_name (or customer.name). ' +
        'The platform sending this webhook must include the customer\'s name.'
      );
    }
    if (!order.items || order.items.length === 0) {
      throw new Error('Webhook order must have at least one item');
    }
    if (!organization_id) {
      throw new Error(
        'Webhook order missing organization_id — ensure the webhook URL includes a valid org token.'
      );
    }
    for (const item of order.items) {
      if (!item.sku && !item.product_id) {
        throw new Error(
          `Webhook order item "${item.name || item.product_name || 'unknown'}" is missing both sku and product_id. ` +
          `Use GET /api/webhooks/:orgToken/catalog to fetch valid product SKUs before placing orders.`
        );
      }
    }

    // Normalize webhook payload fields to match orderService.createOrder expectations.
    // Support: { price, unit_price }, { name, product_name }, { weight, unit_weight }
    const orderData = {
      organization_id:   organization_id || null,
      external_order_id: order.external_order_id || `${source || 'webhook'}-${Date.now()}`,
      platform:          order.platform || source || 'webhook',
      customer_name:     customerName,
      customer_email:    customerEmail,
      customer_phone:    customerPhone,
      priority:          order.priority || 'standard',
      total_amount:      order.total_amount || 0,
      tax_amount:        order.tax_amount   || 0,
      shipping_amount:   order.shipping_amount || 0,
      currency:          order.currency || 'INR',
      shipping_address:  order.shipping_address || {},
      notes:             order.notes || null,
      tags:              {
        ...(order.tags || {}),
        ...(webhook_channel_id ? { source_channel_id: webhook_channel_id } : {}),
      },
      items: (order.items || []).map(item => ({
        product_name: item.product_name || item.name || 'Unknown',
        sku:          item.sku          || null,
        product_id:   item.product_id   || null,
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
