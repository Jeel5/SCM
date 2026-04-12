import InventoryRepository from '../repositories/InventoryRepository.js';
import logger from '../utils/logger.js';
import operationalNotificationService from './operationalNotificationService.js';

async function resolveAutoRestockSupplierId({ organizationId, productId }, tx = null) {
  if (!organizationId) return null;

  let supplierId = null;
  if (productId) {
    const productRes = await InventoryRepository.query(
      `SELECT supplier_id
       FROM products
       WHERE id = $1
         AND (organization_id = $2 OR organization_id IS NULL)
       LIMIT 1`,
      [productId, organizationId],
      tx
    );
    supplierId = productRes.rows[0]?.supplier_id || null;
  }

  if (supplierId) return supplierId;

  const fallbackRes = await InventoryRepository.query(
    `INSERT INTO suppliers (organization_id, name, code, contact_name, is_active)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (organization_id, code) DO UPDATE SET
       name = EXCLUDED.name,
       is_active = true,
       updated_at = NOW()
     RETURNING id`,
    [organizationId, 'Auto Restock Supplier', 'AUTO-RESTOCK', 'System Auto Replenishment'],
    tx
  );

  return fallbackRes.rows[0]?.id || null;
}

/**
 * Create an auto restock order if an item is at/below reorder point and no open restock exists.
 *
 * `item` may use either camelCase or snake_case fields.
 */
export async function maybeCreateAutoRestockOrder(item, triggerReason = 'low_stock_threshold', tx = null) {
  const organizationId = item.organizationId || item.organization_id || null;
  const warehouseId = item.warehouseId || item.warehouse_id || null;
  const productId = item.productId || item.product_id || null;
  const sku = item.sku || null;
  const productName = item.productName || item.product_name || sku || 'Unknown Product';
  const available = Number(item.availableQuantity ?? item.available_quantity ?? 0);
  const reserved = Number(item.reservedQuantity ?? item.reserved_quantity ?? 0);
  const reorderPoint = Number(item.reorderPoint ?? item.reorder_point ?? NaN);
  const maxStockLevel = Number(item.maxStockLevel ?? item.max_stock_level ?? 0);
  const unitCost = Number(item.unitCost ?? item.unit_cost ?? 0);

  if (!organizationId || !warehouseId || !sku) return { status: 'not_applicable' };
  if (!Number.isFinite(reorderPoint) || reorderPoint <= 0 || available > reorderPoint) {
    return { status: 'not_applicable' };
  }

  const supplierId = await resolveAutoRestockSupplierId({ organizationId, productId }, tx);
  if (!supplierId) return { status: 'skipped_no_supplier' };

  const existingRes = await InventoryRepository.query(
    `SELECT ro.id, ro.restock_number
     FROM restock_orders ro
     JOIN restock_order_items roi ON roi.restock_order_id = ro.id
     WHERE ro.organization_id = $1
       AND ro.destination_warehouse_id = $2
       AND ro.supplier_id = $3
       AND ro.status IN ('draft', 'submitted', 'confirmed', 'in_transit')
       AND ((roi.product_id = $4) OR ($4::uuid IS NULL AND roi.sku = $5))
     LIMIT 1`,
    [organizationId, warehouseId, supplierId, productId, sku],
    tx
  );

  if (existingRes.rows[0]) {
    return {
      status: 'skipped_existing_open',
      id: existingRes.rows[0].id,
      restockNumber: existingRes.rows[0].restock_number,
    };
  }

  const reservedPressureBuffer = Math.max(reserved, 0);
  const desiredLevel = maxStockLevel > 0
    ? maxStockLevel
    : (reorderPoint + reservedPressureBuffer);
  const suggestedQty = Math.max(desiredLevel - available, 1);
  const totalAmount = Math.max(unitCost, 0) * suggestedQty;

  const orderRes = await InventoryRepository.query(
    `INSERT INTO restock_orders
       (organization_id, supplier_id, destination_warehouse_id, status, is_auto_generated,
        trigger_reason, total_items, total_amount, currency, requested_at, notes, created_by)
     VALUES ($1, $2, $3, 'submitted', true, $4, $5, $6, 'INR', NOW(), $7, NULL)
     RETURNING id, restock_number`,
    [
      organizationId,
      supplierId,
      warehouseId,
      triggerReason,
      suggestedQty,
      totalAmount,
      `Auto-generated from ${triggerReason} for SKU ${sku}. Available ${available}, reserved ${reserved}, reorder point ${reorderPoint}.`,
    ],
    tx
  );

  await InventoryRepository.query(
    `INSERT INTO restock_order_items
       (restock_order_id, product_id, sku, product_name, quantity_ordered, unit_cost, total_cost)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      orderRes.rows[0].id,
      productId,
      sku,
      productName,
      suggestedQty,
      Math.max(unitCost, 0),
      totalAmount,
    ],
    tx
  );

  operationalNotificationService.queueOrganizationNotification({
    organizationId,
    type: 'system',
    title: 'Reorder Created',
    message: `Auto-reorder ${orderRes.rows[0].restock_number || orderRes.rows[0].id} created for ${productName} (${suggestedQty} units).`,
    link: '/inventory',
    metadata: {
      event: 'inventory_reorder_created',
      triggerReason,
      sku,
      productId,
      warehouseId,
      restockOrderId: orderRes.rows[0].id,
      restockNumber: orderRes.rows[0].restock_number,
      quantity: suggestedQty,
      available,
      reserved,
      reorderPoint,
    },
  });

  logger.info('Auto restock order created', {
    organizationId,
    warehouseId,
    sku,
    available,
    reserved,
    reorderPoint,
    triggerReason,
    restockOrderId: orderRes.rows[0].id,
    restockNumber: orderRes.rows[0].restock_number,
    suggestedQty,
  });

  return {
    status: 'created',
    id: orderRes.rows[0].id,
    restockNumber: orderRes.rows[0].restock_number,
    suggestedQty,
  };
}

export default {
  maybeCreateAutoRestockOrder,
};
