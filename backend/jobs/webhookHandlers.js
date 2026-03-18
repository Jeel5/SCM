import orderService from '../services/orderService.js';
import logger from '../utils/logger.js';
import returnRepo from '../repositories/ReturnRepository.js';
import inventoryRepo from '../repositories/InventoryRepository.js';
import warehouseRepo from '../repositories/WarehouseRepository.js';
import shipmentRepo from '../repositories/ShipmentRepository.js';

/**
 * Process Order Job (from webhook)
 * Processes incoming order from e-commerce platforms
 */
export async function handleProcessOrder(payload) {
  const startTime = Date.now();

  try {
    const { source, order, organization_id, webhook_channel_id } = payload;

    logger.info(`Processing order from ${source}` +
      (organization_id ? ` (org: ${organization_id})` : ' (no org)'));

    // Different platforms send customer data differently.
    // Support both flat (customer_name) and nested (customer.name) shapes.
    if (!order) throw new Error('Webhook job payload is missing the "order" object');

    const customerName = order.customer_name || order.customer?.name || null;
    const customerEmail = order.customer_email || order.customer?.email || null;
    const customerPhone = order.customer_phone || order.customer?.phone || order.customer?.mobile || null;

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
          'Use GET /api/webhooks/:orgToken/catalog to fetch valid product SKUs before placing orders.'
        );
      }
    }

    // Normalize webhook payload fields to match orderService.createOrder expectations.
    const orderData = {
      organization_id: organization_id || null,
      external_order_id: order.external_order_id || `${source || 'webhook'}-${Date.now()}`,
      platform: order.platform || source || 'webhook',
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      priority: order.priority || 'standard',
      total_amount: order.total_amount || 0,
      tax_amount: order.tax_amount || 0,
      shipping_amount: order.shipping_amount || 0,
      currency: order.currency || 'INR',
      shipping_address: order.shipping_address || {},
      notes: order.notes || null,
      tags: {
        ...(order.tags || {}),
        ...(webhook_channel_id ? { source_channel_id: webhook_channel_id } : {}),
      },
      items: (order.items || []).map((item) => ({
        product_name: item.product_name || item.name || 'Unknown',
        sku: item.sku || null,
        product_id: item.product_id || null,
        quantity: parseInt(item.quantity, 10) || 1,
        unit_price: parseFloat(item.unit_price ?? item.price ?? 0),
        weight: parseFloat(item.weight ?? item.unit_weight ?? 0.5),
        category: item.category || null,
        dimensions: item.dimensions || null,
        is_fragile: item.is_fragile || false,
        is_hazardous: item.is_hazardous || false,
      })),
    };

    const createdOrder = await orderService.createOrder(orderData, true);

    logger.info(`✅ Webhook order processed: ${createdOrder.order_number} (id: ${createdOrder.id})`);

    return {
      success: true,
      orderId: createdOrder.id,
      orderNumber: createdOrder.order_number,
      externalOrderId: orderData.external_order_id,
      itemsCount: (createdOrder.items || []).length,
      duration: `${Date.now() - startTime}ms`,
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
export async function handleUpdateTracking(payload) {
  const startTime = Date.now();

  try {
    const { tracking_number, status, status_detail, location } = payload;

    logger.info(`Updating tracking for ${tracking_number}: ${status}`);

    const shipment = await shipmentRepo.findByTrackingNumber(tracking_number);

    if (!shipment) {
      logger.warn(`Shipment not found for tracking number: ${tracking_number}`);
      return { success: false, reason: 'shipment_not_found' };
    }

    const shipmentTrackingService = (await import('../services/shipmentTrackingService.js')).default;

    const trackingEvent = {
      eventType: status,
      description: status_detail || status,
      location: typeof location === 'string'
        ? { city: location }
        : location,
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
      duration: `${Date.now() - startTime}ms`,
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
export async function handleSyncInventory(payload) {
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
      duration: `${Date.now() - startTime}ms`,
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
export async function handleProcessReturn(payload) {
  const startTime = Date.now();

  try {
    const { return_id, original_order_id, customer, items, refund_amount, organization_id } = payload;

    logger.info(`Processing return ${return_id} for order ${original_order_id}`);

    const newReturn = await returnRepo.createFromWebhook({
      organizationId: organization_id || null,
      externalReturnId: return_id,
      externalOrderId: original_order_id,
      customerName: customer.name,
      customerEmail: customer.email,
      items: items,
      refundAmount: refund_amount,
    });

    logger.info(`✅ Return ${return_id} processed as ID ${newReturn.id}`);

    return {
      success: true,
      returnId: newReturn.id,
      itemsCount: items?.length || 0,
      duration: `${Date.now() - startTime}ms`,
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
export async function handleProcessRates(payload) {
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
      duration: `${Date.now() - startTime}ms`,
    };
  } catch (error) {
    logger.error('Process rates job failed:', error);
    throw error;
  }
}
