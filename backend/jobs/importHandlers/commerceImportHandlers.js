import pool from '../../config/db.js';
import carrierRepo from '../../repositories/CarrierRepository.js';
import { emitToOrg } from '../../sockets/emitter.js';
import {
  UUID_RE,
  parseJsonObject,
  normalizeLookupKey,
  normalizeShipmentStatus,
  buildAddress,
  buildShipmentEvents,
} from '../importUtils.js';
import { runImport } from '../importRunner.js';

/**
 * Build shared runImport payload for commerce import handlers.
 */
function runCommerceImport(payload, importType, processRow) {
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

/**
 * Retry async carrier placeholder creation with bounded attempts.
 */
async function resolveCarrierPlaceholder({ organizationId, baseCode, carrierLabel }) {
  const tryInsert = async (attempt) => {
    if (attempt >= 5) return null;

    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const candidateCode = attempt === 0 ? baseCode : `${baseCode.slice(0, 24)}-${suffix}`;

    const insertRes = await pool.query(
      `INSERT INTO carriers (organization_id, code, name, service_type, is_active, availability_status)
       VALUES ($1, $2, $3, 'all', true, 'available')
       ON CONFLICT (organization_id, code) DO NOTHING
       RETURNING id, code, name`,
      [organizationId, candidateCode, carrierLabel]
    );

    let placeholder = insertRes.rows[0] || null;
    if (!placeholder) {
      const existingRes = await pool.query(
        `SELECT id, code, name
         FROM carriers
         WHERE organization_id = $1 AND code = $2
         LIMIT 1`,
        [organizationId, candidateCode]
      );
      placeholder = existingRes.rows[0] || null;
    }

    return placeholder || tryInsert(attempt + 1);
  };

  return tryInsert(0);
}

/**
 * Import inventory rows and resolve warehouse/product references safely.
 */
export async function handleImportInventory(payload) {
  const { organizationId } = payload;

  const whRes = await pool.query(
    `SELECT id, code, name FROM warehouses WHERE organization_id = $1`, [organizationId]
  );
  const byWhCode = new Map(whRes.rows.map((w) => [w.code?.toLowerCase(), w.id]));
  const byWhName = new Map(whRes.rows.map((w) => [w.name?.toLowerCase(), w.id]));

  const prRes = await pool.query(
    `SELECT id, sku, name FROM products WHERE organization_id = $1`, [organizationId]
  );
  const byPrSku = new Map(prRes.rows.map((p) => [p.sku?.toLowerCase(), p.id]));
  const byPrName = new Map(prRes.rows.map((p) => [p.name?.toLowerCase(), p.id]));

  return runCommerceImport(payload, 'inventory', async (row, ctx) => {
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

      const qty = parseInt(row.quantity, 10) || 0;
      if (ctx.dryRun) return;
      await pool.query(
        `INSERT INTO inventory
           (organization_id, warehouse_id, product_id, sku, product_name,
            quantity, available_quantity, reserved_quantity, reorder_point, unit_cost)
         VALUES ($1,$2,$3,$4,$5,$6,$6,0,$7,$8)
         ON CONFLICT (warehouse_id, sku) WHERE sku IS NOT NULL DO UPDATE SET
           quantity           = EXCLUDED.quantity,
           available_quantity = EXCLUDED.quantity,
           updated_at         = NOW()`,
        [organizationId, warehouseId, productId,
          row.sku, row.product_name || row.sku, qty,
          row.reorder_point ? parseInt(row.reorder_point, 10) : null,
          row.unit_cost ? parseFloat(row.unit_cost) : null]
      );
  });
}

/**
 * Import shipments and rebuild event timelines plus order status alignment.
 */
export async function handleImportShipments(payload) {
  const { organizationId } = payload;

  const [ordersRes, carriersRes, warehousesRes] = await Promise.all([
    pool.query(`SELECT id, order_number, shipping_address FROM orders WHERE organization_id = $1`, [organizationId]),
    pool.query(`SELECT id, code, name FROM carriers WHERE organization_id = $1`, [organizationId]),
    pool.query(`SELECT id, code, name, address FROM warehouses WHERE organization_id = $1`, [organizationId]),
  ]);

  const ordersById = new Map(ordersRes.rows.map((order) => [order.id, order]));
  const ordersByNumber = new Map(ordersRes.rows.map((order) => [String(order.order_number || '').toLowerCase(), order]));
  const carriersById = new Map(carriersRes.rows.map((carrier) => [carrier.id, carrier]));
  const carriersByCode = new Map(carriersRes.rows.map((carrier) => [String(carrier.code || '').toLowerCase(), carrier]));
  const carriersByName = new Map(carriersRes.rows.map((carrier) => [String(carrier.name || '').toLowerCase(), carrier]));
  const carriersByNormCode = new Map(carriersRes.rows.map((carrier) => [normalizeLookupKey(carrier.code), carrier]));
  const carriersByNormName = new Map(carriersRes.rows.map((carrier) => [normalizeLookupKey(carrier.name), carrier]));
  const warehousesById = new Map(warehousesRes.rows.map((warehouse) => [warehouse.id, warehouse]));
  const warehousesByCode = new Map(warehousesRes.rows.map((warehouse) => [String(warehouse.code || '').toLowerCase(), warehouse]));
  const warehousesByName = new Map(warehousesRes.rows.map((warehouse) => [String(warehouse.name || '').toLowerCase(), warehouse]));

  return runCommerceImport(payload, 'shipments', async (row, ctx) => {
      const order = (row.order_id && ordersById.get(row.order_id))
        || (row.order_number && ordersByNumber.get(String(row.order_number).toLowerCase()));
      if (!order) {
        throw new Error(`Cannot resolve order '${row.order_number || row.order_id || 'unknown'}'`);
      }

      const carrier = (row.carrier_id && carriersById.get(row.carrier_id))
        || (row.carrier_code && carriersByCode.get(String(row.carrier_code).toLowerCase()))
        || (row.carrier_name && carriersByName.get(String(row.carrier_name).toLowerCase()))
        || (row.carrier_code && carriersByNormCode.get(normalizeLookupKey(row.carrier_code)))
        || (row.carrier_name && carriersByNormName.get(normalizeLookupKey(row.carrier_name)));

      let resolvedCarrier = carrier;
      if (!resolvedCarrier) {
        const carrierLabel = String(row.carrier_name || row.carrier_code || '').trim();
        if (!carrierLabel) {
          throw new Error(`Cannot resolve carrier '${row.carrier_code || row.carrier_name || row.carrier_id || 'unknown'}'`);
        }

        const baseCode = String(row.carrier_code || carrierLabel)
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 30) || 'IMP-CARRIER';

        const placeholder = await resolveCarrierPlaceholder({
          organizationId,
          baseCode,
          carrierLabel,
        });

        if (!placeholder) {
          throw new Error(`Cannot resolve carrier '${carrierLabel}'`);
        }

        carriersById.set(placeholder.id, placeholder);
        carriersByCode.set(String(placeholder.code || '').toLowerCase(), placeholder);
        carriersByName.set(String(placeholder.name || '').toLowerCase(), placeholder);
        carriersByNormCode.set(normalizeLookupKey(placeholder.code), placeholder);
        carriersByNormName.set(normalizeLookupKey(placeholder.name), placeholder);

        resolvedCarrier = placeholder;
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
              resolvedCarrier.id,
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
              resolvedCarrier.id,
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

          await Promise.all(
            timelineEvents.map((event) =>
              client.query(
                `INSERT INTO shipment_events (shipment_id, event_type, location, description, event_timestamp)
                 VALUES ($1, $2, $3::jsonb, $4, $5)`,
                [
                  shipmentId,
                  event.event_type,
                  JSON.stringify(event.location),
                  event.description,
                  event.event_timestamp,
                ]
              )
            )
          );
        }

        if (status === 'delivered') {
          await client.query(
            `UPDATE orders
             SET status = 'delivered', actual_delivery = COALESCE($1, actual_delivery, NOW()), updated_at = NOW()
             WHERE id = $2`,
            [deliveryActual, order.id]
          );
        } else if (status === 'returned') {
          await client.query(`UPDATE orders SET status = 'returned', updated_at = NOW() WHERE id = $1`, [order.id]);
        } else if (status === 'cancelled') {
          await client.query(`UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [order.id]);
        } else {
          await client.query(`UPDATE orders SET status = 'shipped', updated_at = NOW() WHERE id = $1`, [order.id]);
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
  });
}

function normalizeImportedOrderRow(row) {
  const unitPrice = parseFloat(row.unit_price) || 0;
  const qty = parseInt(row.quantity, 10) || 1;
  const lineTotal = unitPrice * qty;

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
    street: row.street || 'N/A',
    city: row.city || 'N/A',
    state: row.state || '',
    postal_code: row.postal_code || '000000',
    country: row.country || 'India',
  };

  return {
    qty,
    unitPrice,
    lineTotal,
    priority,
    status,
    shippingAddress,
  };
}

async function insertImportedOrder(client, organizationId, jobId, row, normalized) {
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
      normalized.status,
      normalized.priority,
      'outbound',
      row.currency || 'INR',
      JSON.stringify(normalized.shippingAddress),
      normalized.lineTotal,
      normalized.lineTotal,
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
      normalized.qty,
      normalized.unitPrice,
      normalized.lineTotal,
    ]
  );
}

/**
 * Import orders and seed order-item rows for historical backfills.
 */
export async function handleImportOrders(payload) {
  const { organizationId, _jobId: jobId } = payload;
  return runCommerceImport(payload, 'orders', async (row, ctx) => {
      if (!row.customer_name) throw new Error('customer_name is required');
      if (!row.sku) throw new Error('sku is required');
      const normalized = normalizeImportedOrderRow(row);

      if (ctx.dryRun) return;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await insertImportedOrder(client, organizationId, jobId, row, normalized);

        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
  });
}
