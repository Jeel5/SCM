import pool from '../../config/db.js';
import bcrypt from 'bcrypt';
import carrierRepo from '../../repositories/CarrierRepository.js';
import { generateInternalBarcode } from '../../utils/barcodeGenerator.js';
import { runImport } from '../importRunner.js';

/**
 * Build shared runImport payload for master-data import handlers.
 */
function runMasterImport(payload, importType, processRow) {
  const { rows, filePath, dryRun = false, maxRows, organizationId, _jobId: jobId } = payload;
  return runImport({
    jobId,
    organizationId,
    rows,
    filePath,
    dryRun,
    maxRows,
    importType,
    processRow,
  });
}

function normalizeSupplierName(value) {
  return String(value || '').trim();
}

function normalizeSupplierKey(value) {
  return normalizeSupplierName(value).toLowerCase();
}

function buildSupplierCodeBase(name) {
  const raw = normalizeSupplierName(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (raw || 'SUPPLIER').slice(0, 44);
}

async function generateUniqueSupplierCode(organizationId, supplierName) {
  const base = buildSupplierCodeBase(supplierName);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const candidate = `${base.slice(0, 44 - suffix.length)}${suffix}`;

    const checkRes = await pool.query(
      `SELECT 1 FROM suppliers WHERE organization_id = $1 AND code = $2 LIMIT 1`,
      [organizationId, candidate]
    );
    if (!checkRes.rows.length) return candidate;
  }

  return `${base.slice(0, 38)}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

async function resolveSupplierByNameOrCreate({ organizationId, supplierName, ctx, cache }) {
  const normalizedName = normalizeSupplierName(supplierName);
  if (!normalizedName) return null;

  const key = normalizeSupplierKey(normalizedName);
  if (cache?.has(key)) return cache.get(key);

  const existingByNameRes = await pool.query(
    `SELECT id
     FROM suppliers
     WHERE organization_id = $1 AND lower(name) = lower($2)
     ORDER BY created_at ASC
     LIMIT 1`,
    [organizationId, normalizedName]
  );

  if (existingByNameRes.rows[0]?.id) {
    const existingId = existingByNameRes.rows[0].id;
    cache?.set(key, existingId);
    return existingId;
  }

  if (ctx?.dryRun) return null;

  const newCode = await generateUniqueSupplierCode(organizationId, normalizedName);
  const createdRes = await pool.query(
    `INSERT INTO suppliers (organization_id, name, code, contact_name, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id`,
    [organizationId, normalizedName, newCode, normalizedName]
  );

  const createdId = createdRes.rows[0]?.id || null;
  if (createdId) cache?.set(key, createdId);
  return createdId;
}

/**
 * Import warehouses from CSV rows into tenant-scoped warehouse records.
 */
export async function handleImportWarehouses(payload) {
  const { organizationId } = payload;
  return runMasterImport(payload, 'warehouses', async (row, ctx) => {
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
        street: row.street || row.address_street || '',
        city: row.city || row.address_city || '',
        state: row.state || row.address_state || '',
        postal_code: row.postal_code || row.postalCode || '',
        country: row.country || 'India',
      });
      if (ctx.dryRun) return;
      try {
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
      } catch (error) {
        if (error?.code === '23505' && error?.constraint === 'uq_warehouses_code_idx') {
          throw new Error(`warehouse code '${row.code}' already exists in another organization`);
        }
        throw error;
      }
  });
}

/**
 * Import carriers from CSV rows into tenant-scoped carrier records.
 */
export async function handleImportCarriers(payload) {
  const { organizationId } = payload;
  return runMasterImport(payload, 'carriers', async (row, ctx) => {
      if (!row.name) throw new Error('name is required');
      const validSvcTypes = ['express', 'standard', 'economy', 'overnight', 'two_day', 'surface', 'air', 'all'];
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
          row.avg_delivery_days ? parseInt(row.avg_delivery_days, 10) : 3,
          String(row.is_active || 'true').toLowerCase() !== 'false',
          'available']
      );
  });
}

/**
 * Import suppliers from CSV rows into tenant-scoped supplier records.
 */
export async function handleImportSuppliers(payload) {
  const { organizationId } = payload;
  return runMasterImport(payload, 'suppliers', async (row, ctx) => {
      const supplierName = normalizeSupplierName(row.name);
      if (!supplierName) throw new Error('name is required');
      if (ctx.dryRun) return;

      const existingByNameRes = await pool.query(
        `SELECT id, code
         FROM suppliers
         WHERE organization_id = $1 AND lower(name) = lower($2)
         ORDER BY created_at ASC
         LIMIT 1`,
        [organizationId, supplierName]
      );

      if (existingByNameRes.rows[0]?.id) {
        await pool.query(
          `UPDATE suppliers
           SET
             name = $1,
             contact_name = COALESCE($2, contact_name),
             contact_email = COALESCE($3, contact_email),
             contact_phone = COALESCE($4, contact_phone),
             api_endpoint = COALESCE($5, api_endpoint),
             address = COALESCE($6, address),
             city = COALESCE($7, city),
             state = COALESCE($8, state),
             country = COALESCE($9, country),
             postal_code = COALESCE($10, postal_code),
             inbound_contact_name = COALESCE($11, inbound_contact_name),
             inbound_contact_email = COALESCE($12, inbound_contact_email),
             is_active = COALESCE($13, is_active),
             updated_at = NOW()
           WHERE id = $14`,
          [
            supplierName,
            row.contact_name || null,
            row.contact_email || null,
            row.contact_phone || null,
            row.api_endpoint || null,
            row.address || null,
            row.city || null,
            row.state || null,
            row.country || null,
            row.postal_code || null,
            row.inbound_contact_name || null,
            row.inbound_contact_email || null,
            row.is_active !== undefined ? String(row.is_active).toLowerCase() !== 'false' : null,
            existingByNameRes.rows[0].id,
          ]
        );
        return;
      }

      const supplierCode = String(row.code || '').trim() || await generateUniqueSupplierCode(organizationId, supplierName);
      await pool.query(
        `INSERT INTO suppliers
           (organization_id, name, code, contact_name, contact_email, contact_phone,
            api_endpoint, address, city, state, country, postal_code,
            inbound_contact_name, inbound_contact_email, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (organization_id, code) DO UPDATE SET
           name = EXCLUDED.name,
           contact_name = COALESCE(EXCLUDED.contact_name, suppliers.contact_name),
           contact_email = COALESCE(EXCLUDED.contact_email, suppliers.contact_email),
           contact_phone = COALESCE(EXCLUDED.contact_phone, suppliers.contact_phone),
           api_endpoint = COALESCE(EXCLUDED.api_endpoint, suppliers.api_endpoint),
           address = COALESCE(EXCLUDED.address, suppliers.address),
           city = COALESCE(EXCLUDED.city, suppliers.city),
           state = COALESCE(EXCLUDED.state, suppliers.state),
           country = COALESCE(EXCLUDED.country, suppliers.country),
           postal_code = COALESCE(EXCLUDED.postal_code, suppliers.postal_code),
           inbound_contact_name = COALESCE(EXCLUDED.inbound_contact_name, suppliers.inbound_contact_name),
           inbound_contact_email = COALESCE(EXCLUDED.inbound_contact_email, suppliers.inbound_contact_email),
           is_active = EXCLUDED.is_active,
           updated_at = NOW()`,
        [
          organizationId,
          supplierName,
          supplierCode,
          row.contact_name || null,
          row.contact_email || null,
          row.contact_phone || null,
          row.api_endpoint || null,
          row.address || null,
          row.city || null,
          row.state || null,
          row.country || 'India',
          row.postal_code || null,
          row.inbound_contact_name || null,
          row.inbound_contact_email || null,
          String(row.is_active || 'true').toLowerCase() !== 'false',
        ]
      );
  });
}

/**
 * Import sales channels from CSV rows into tenant-scoped channel records.
 */
export async function handleImportChannels(payload) {
  const { organizationId } = payload;
  return runMasterImport(payload, 'channels', async (row, ctx) => {
      if (!row.name) throw new Error('name is required');
      const validTypes = ['marketplace', 'd2c', 'b2b', 'wholesale', 'internal'];
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
  });
}

/**
 * Import team users from CSV rows with generated placeholder credentials.
 */
export async function handleImportTeam(payload) {
  const { organizationId } = payload;
  const placeholderHash = await bcrypt.hash(`Import@${Date.now()}!`, 12);
  return runMasterImport(payload, 'team', async (row, ctx) => {
      if (!row.email || !row.email.includes('@')) throw new Error('Missing or invalid email');
      const validRoles = ['operations_manager', 'warehouse_manager', 'carrier_partner', 'finance', 'customer_support'];
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
  });
}

/**
 * Import products from CSV rows with resilient barcode conflict handling.
 */
export async function handleImportProducts(payload) {
  const { organizationId } = payload;
  const supplierNameToId = new Map();

  return runMasterImport(payload, 'products', async (row, ctx) => {
      if (!row.name && !row.sku) throw new Error('name or sku is required');
      const { v4: uuidv4 } = await import('uuid');
      const sku = row.sku || `SKU-${uuidv4().substring(0, 8).toUpperCase()}`;
      let internalBarcode = String(row.internal_barcode || '').trim() || generateInternalBarcode();
      const supplierIdFromBrand = await resolveSupplierByNameOrCreate({
        organizationId,
        supplierName: row.brand,
        ctx,
        cache: supplierNameToId,
      });

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await pool.query(
            `INSERT INTO products
               (organization_id, name, sku, category, description, weight,
                selling_price, cost_price, currency, is_active, brand, internal_barcode, supplier_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             ON CONFLICT (organization_id, sku) DO UPDATE SET
               name = EXCLUDED.name,
               category = COALESCE(EXCLUDED.category, products.category),
               description = COALESCE(EXCLUDED.description, products.description),
               weight = COALESCE(EXCLUDED.weight, products.weight),
               selling_price = COALESCE(EXCLUDED.selling_price, products.selling_price),
               cost_price = COALESCE(EXCLUDED.cost_price, products.cost_price),
               brand = COALESCE(EXCLUDED.brand, products.brand),
               supplier_id = COALESCE(EXCLUDED.supplier_id, products.supplier_id),
               updated_at = NOW()`,
            [organizationId, row.name, sku, row.category || null,
              row.description || null,
              row.weight ? parseFloat(row.weight) : null,
              row.selling_price ? parseFloat(row.selling_price) : null,
              row.cost_price ? parseFloat(row.cost_price) : null,
              row.currency || 'INR',
              String(row.is_active || 'true').toLowerCase() !== 'false',
              row.brand || null,
              internalBarcode,
              supplierIdFromBrand]
          );
          return;
        } catch (error) {
          if (error?.code === '23505' && error?.constraint === 'products_internal_barcode_unique' && !row.internal_barcode) {
            internalBarcode = generateInternalBarcode();
            continue;
          }
          throw error;
        }
      }

      throw new Error('Could not generate unique internal_barcode after 5 attempts');
  });
}
