import pool from '../../config/db.js';
import bcrypt from 'bcrypt';
import carrierRepo from '../../repositories/CarrierRepository.js';
import { generateInternalBarcode } from '../../utils/barcodeGenerator.js';
import { runImport } from '../importRunner.js';

export async function handleImportWarehouses(payload) {
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
        street: row.street || row.address_street || '',
        city: row.city || row.address_city || '',
        state: row.state || row.address_state || '',
        postal_code: row.postal_code || row.postalCode || '',
        country: row.country || 'India',
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

export async function handleImportCarriers(payload) {
  const { rows, filePath, dryRun = false, maxRows, organizationId, _jobId: jobId } = payload;
  return runImport({
    jobId, organizationId, rows, filePath, dryRun, maxRows, importType: 'carriers',
    processRow: async (row, ctx) => {
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
          row.avg_delivery_days ? parseInt(row.avg_delivery_days) : 3,
          String(row.is_active || 'true').toLowerCase() !== 'false',
          'available']
      );
    },
  });
}

export async function handleImportSuppliers(payload) {
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

export async function handleImportChannels(payload) {
  const { rows, filePath, dryRun = false, maxRows, organizationId, _jobId: jobId } = payload;
  return runImport({
    jobId, organizationId, rows, filePath, dryRun, maxRows, importType: 'channels',
    processRow: async (row, ctx) => {
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
    },
  });
}

export async function handleImportTeam(payload) {
  const { rows, filePath, dryRun = false, maxRows, organizationId, _jobId: jobId } = payload;
  const placeholderHash = await bcrypt.hash(`Import@${Date.now()}!`, 12);
  return runImport({
    jobId, organizationId, rows, filePath, dryRun, maxRows, importType: 'team',
    processRow: async (row, ctx) => {
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
    },
  });
}

export async function handleImportProducts(payload) {
  const { rows, filePath, dryRun = false, maxRows, organizationId, _jobId: jobId } = payload;
  return runImport({
    jobId, organizationId, rows, filePath, dryRun, maxRows, importType: 'products',
    processRow: async (row, ctx) => {
      if (!row.name && !row.sku) throw new Error('name or sku is required');
      const { v4: uuidv4 } = await import('uuid');
      const sku = row.sku || `SKU-${uuidv4().substring(0, 8).toUpperCase()}`;
      let internalBarcode = String(row.internal_barcode || '').trim() || generateInternalBarcode();

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await pool.query(
            `INSERT INTO products
               (organization_id, name, sku, category, description, weight,
                selling_price, cost_price, currency, is_active, brand, internal_barcode)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             ON CONFLICT (organization_id, sku) DO UPDATE SET
               name = EXCLUDED.name, updated_at = NOW()`,
            [organizationId, row.name, sku, row.category || null,
              row.description || null,
              row.weight ? parseFloat(row.weight) : null,
              row.selling_price ? parseFloat(row.selling_price) : null,
              row.cost_price ? parseFloat(row.cost_price) : null,
              row.currency || 'INR',
              String(row.is_active || 'true').toLowerCase() !== 'false',
              row.brand || null,
              internalBarcode]
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
    },
  });
}
