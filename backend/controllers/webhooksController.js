import logger from '../utils/logger.js';
import { jobsService } from '../services/jobsService.js';
import { asyncHandler, ValidationError, NotFoundError } from '../errors/index.js';
import ProductRepository from '../repositories/ProductRepository.js';
import InventoryRepository from '../repositories/InventoryRepository.js';
// ProductRepository and InventoryRepository are singleton instances (not classes)

/**
 * Webhook Controller
 * Handles incoming webhooks from external systems
 */

/**
 * Handle order webhooks from e-commerce platforms
 */
export const handleOrderWebhook = asyncHandler(async (req, res) => {
    let { event_type, source, data, timestamp, event_id } = req.body;

    // Support bare-payload format (no envelope) — demo portal and direct integrations
    // If the body itself looks like an order (has customer_name or items), wrap it
    if (!event_type && !source && !data) {
      const body = req.body;
      if (body && (body.customer_name || body.items || body.external_order_id)) {
        logger.debug('📦 Bare order payload detected — wrapping in envelope');
        event_type = body.event_type || 'order.created';
        source = body.source || body.platform || 'demo';
        data = body;
        timestamp = body.timestamp || new Date().toISOString();
        event_id = body.event_id || null;
      }
    }

    logger.info(`📦 Received order webhook: ${event_type} from ${source}`);

    // Validate webhook payload
    if (!event_type || !source || !data) {
      logger.warn('Invalid webhook payload', { body: req.body });
      throw new ValidationError('Invalid webhook payload. Expected: { event_type, source, data } or a bare order object with customer_name/items.');
    }

    // Process based on source platform
    let processedOrder;
    switch (source) {
      case 'amazon':
        processedOrder = processAmazonOrder(data);
        break;
      case 'shopify':
        processedOrder = processShopifyOrder(data);
        break;
      case 'ebay':
        processedOrder = processEbayOrder(data);
        break;
      default:
        processedOrder = data; // Generic / croma / demo handler
    }

    // Derive idempotency key: prefer explicit event_id, fall back to composite key
    const idempotencyKey = event_id
      ? `order-${event_id}`
      : (data.external_order_id ? `order-${source}-${data.external_order_id}` : null);

    // Create background job to process order
    // req.webhookOrganizationId is set by resolveWebhookOrg middleware (org-scoped URL)
    const job = await jobsService.createJob(
      'process_order',
      {
        source,
        event_type,
        order: processedOrder,
        organization_id: req.webhookOrganizationId || null,
        received_at: timestamp || new Date().toISOString()
      },
      data.priority === 'high' ? 1 : 5,
      null,
      null,
      idempotencyKey
    );

    logger.info(`✅ Order webhook queued as job ${job.id}${job.is_new === false ? ' (duplicate — already queued)' : ''}`);

    // Respond immediately (webhook pattern - don't make sender wait)
    res.status(200).json({
      success: true,
      message: 'Webhook received and queued for processing',
      job_id: job.id
    });
});

/**
 * Handle carrier tracking webhooks
 */
export const handleTrackingWebhook = asyncHandler(async (req, res) => {
    const { event_type, source, data, timestamp, event_id } = req.body;

    logger.info(`🚚 Received tracking webhook: ${event_type} from ${source}`);

    if (!event_type || !source || !data || !data.tracking_number) {
      throw new ValidationError('Invalid tracking webhook payload');
    }

    // Idempotency: use event_id or (tracking_number + carrier_status)
    const idempotencyKey = event_id
      ? `tracking-${event_id}`
      : `tracking-${data.tracking_number}-${data.status}`;

    // Create job to update shipment tracking
    const job = await jobsService.createJob(
      'update_tracking',
      {
        tracking_number: data.tracking_number,
        carrier: data.carrier,
        status: data.status,
        status_detail: data.status_detail,
        location: data.location,
        estimated_delivery: data.estimated_delivery,
        actual_delivery: data.actual_delivery,
        events: data.events,
        received_at: timestamp || new Date().toISOString()
      },
      data.status === 'delivered' ? 2 : 5,
      null,
      null,
      idempotencyKey
    );

    logger.info(`✅ Tracking webhook queued as job ${job.id}${job.is_new === false ? ' (duplicate)' : ''}`);

    res.status(200).json({
      success: true,
      message: 'Tracking update received',
      job_id: job.id
    });
});

/**
 * Handle warehouse inventory webhooks
 */
export const handleInventoryWebhook = asyncHandler(async (req, res) => {
    const { event_type, source, data, timestamp, event_id } = req.body;

    logger.info(`📊 Received inventory webhook: ${event_type} from ${source}`);

    if (!event_type || !source || !data || !data.warehouse_id) {
      throw new ValidationError('Invalid inventory webhook payload');
    }

    const idempotencyKey = event_id ? `inventory-${event_id}` : null;

    // Create job to sync inventory
    const job = await jobsService.createJob(
      'sync_inventory',
      {
        warehouse_id: data.warehouse_id,
        warehouse_name: data.warehouse_name,
        update_type: data.update_type,
        items: data.items,
        updated_by: data.updated_by,
        notes: data.notes,
        organization_id: req.webhookOrganizationId || null,
        received_at: timestamp || new Date().toISOString()
      },
      data.update_type === 'critical' ? 1 : 5,
      null,
      null,
      idempotencyKey
    );

    logger.info(`✅ Inventory webhook queued as job ${job.id}${job.is_new === false ? ' (duplicate)' : ''}`);

    res.status(200).json({
      success: true,
      message: 'Inventory update received',
      job_id: job.id,
      items_updated: data.items?.length || 0
    });
});

/**
 * Handle return request webhooks
 */
export const handleReturnWebhook = asyncHandler(async (req, res) => {
    const { event_type, source, data, timestamp, event_id } = req.body;

    logger.info(`↩️  Received return webhook: ${event_type} from ${source}`);

    if (!event_type || !source || !data || !data.return_id) {
      throw new ValidationError('Invalid return webhook payload');
    }

    const idempotencyKey = event_id
      ? `return-${event_id}`
      : `return-${data.return_id}`;

    // Create job to process return
    const job = await jobsService.createJob(
      'process_return',
      {
        return_id: data.return_id,
        original_order_id: data.original_order_id,
        customer: data.customer,
        items: data.items,
        pickup_address: data.pickup_address,
        refund_amount: data.refund_amount,
        status: data.status,
        organization_id: req.webhookOrganizationId || null,
        received_at: timestamp || new Date().toISOString()
      },
      3,
      null,
      null,
      idempotencyKey
    );

    logger.info(`✅ Return webhook queued as job ${job.id}${job.is_new === false ? ' (duplicate)' : ''}`);

    res.status(200).json({
      success: true,
      message: 'Return request received',
      job_id: job.id,
      return_id: data.return_id
    });
});

/**
 * Handle carrier rate response webhooks
 */
export const handleRatesWebhook = asyncHandler(async (req, res) => {
    const { event_type, source, data, timestamp, event_id } = req.body;

    logger.info(`💰 Received rates webhook: ${event_type} from ${source}`);

    if (!event_type || !source || !data || !data.request_id) {
      throw new ValidationError('Invalid rates webhook payload');
    }

    const idempotencyKey = event_id
      ? `rates-${event_id}`
      : `rates-${data.request_id}`;

    // Create job to process and store rates
    const job = await jobsService.createJob(
      'process_rates',
      {
        request_id: data.request_id,
        rates: data.rates,
        origin: data.origin,
        destination: data.destination,
        weight_lb: data.weight_lb,
        received_at: timestamp || new Date().toISOString()
      },
      4,
      null,
      null,
      idempotencyKey
    );

    logger.info(`✅ Rates webhook queued as job ${job.id}${job.is_new === false ? ' (duplicate)' : ''}`);

    res.status(200).json({
      success: true,
      message: 'Rate information received',
      job_id: job.id,
      rates_count: data.rates?.length || 0
    });
});

/**
 * Generic webhook handler (for testing/debugging)
 */
export const handleGenericWebhook = asyncHandler(async (req, res) => {
    const payload = req.body;
    const headers = req.headers;

    logger.info(`🔔 Received generic webhook:`, {
      source: headers['x-webhook-source'] || 'unknown',
      event: headers['x-webhook-event'] || payload.event_type || 'unknown',
      payload_size: JSON.stringify(payload).length
    });

    // Log full payload for debugging
    logger.debug('Webhook payload:', JSON.stringify(payload, null, 2));

    res.status(200).json({
      success: true,
      message: 'Generic webhook received',
      received_at: new Date().toISOString()
    });
});

/**
 * Get webhook delivery status (check if job was processed)
 */
export const getWebhookStatus = asyncHandler(async (req, res) => {
    const { jobId } = req.params;

    const job = await jobsService.getJobById(jobId);

    if (!job) throw new NotFoundError('Job');

    res.json({
      success: true,
      data: {
        job_id: job.id,
        status: job.status,
        job_type: job.job_type,
        created_at: job.created_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        attempts: job.attempts,
        result: job.result,
        error: job.error
      }
    });
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Transform Amazon order format to standard format
 */
function processAmazonOrder(data) {
  return {
    external_order_id: data.order_id,
    platform: 'amazon',
    marketplace: data.marketplace,
    customer_name: data.customer.name,
    customer_email: data.customer.email,
    customer_phone: data.customer.phone,
    shipping_address: data.shipping_address,
    items: data.items,
    total_amount: parseFloat(data.totals.total),
    tax_amount: parseFloat(data.totals.tax),
    shipping_amount: parseFloat(data.totals.shipping),
    status: data.status,
    requested_carrier: data.requested_carrier,
    shipping_method: data.shipping_method,
    priority: data.priority,
    order_date: data.created_at
  };
}

/**
 * Transform Shopify order format to standard format
 */
function processShopifyOrder(data) {
  return {
    external_order_id: data.id.toString(),
    platform: 'shopify',
    order_number: data.order_number,
    customer_name: `${data.customer.first_name} ${data.customer.last_name}`,
    customer_email: data.email,
    customer_phone: data.customer.phone || data.phone || null,
    shipping_address: data.shipping_address,
    items: data.line_items.map(item => ({
      product_id: item.product_id.toString(),
      sku: item.sku,
      name: item.title,
      quantity: item.quantity,
      price: item.price
    })),
    total_amount: parseFloat(data.total_price),
    tax_amount: parseFloat(data.total_tax || 0),
    shipping_amount: parseFloat(data.total_shipping || 0),
    currency: data.currency,
    status: data.fulfillment_status || 'pending',
    order_date: data.created_at
  };
}

/**
 * Transform eBay order format to standard format
 */
function processEbayOrder(data) {
  return {
    external_order_id: data.orderId,
    platform: 'ebay',
    customer_name: data.buyer.username,
    customer_email: data.buyer.email,
    shipping_address: data.fulfillmentStartInstructions[0]?.shippingStep?.shipTo,
    items: data.lineItems.map(item => ({
      product_id: item.lineItemId,
      sku: item.sku,
      name: item.title,
      quantity: item.quantity,
      price: item.lineItemCost.value
    })),
    total_amount: parseFloat(data.pricingSummary.total.value),
    status: 'pending',
    order_date: data.creationDate
  };
}

// ─── Catalog & Stock Endpoints ────────────────────────────────────────────────

/**
 * GET /api/webhooks/:orgToken/catalog
 *
 * Public-facing product catalog scoped to the organization.
 * Returns ONLY products that have available_quantity > 0 in inventory.
 *
 * PRODUCTION RULE: External platforms (e-commerce stores, portals) MUST call
 * this endpoint to fetch orderable products and their SKUs before submitting
 * order webhooks. Orders referencing SKUs not in this list will be rejected.
 */
export const handleCatalogWebhook = asyncHandler(async (req, res) => {
  const orgId = req.webhookOrganizationId;
  if (!orgId) throw new ValidationError('Invalid organization token');

  const { category, limit = 200 } = req.query;
  const parsedLimit = Math.min(parseInt(limit) || 200, 500);

  const products = await ProductRepository.findAvailableProducts({
    organizationId: orgId,
    category: category || undefined,
    limit: parsedLimit,
  });

  logger.info(`Catalog requested for org ${orgId}: ${products.length} products available`);

  res.json({
    success: true,
    organization_id: orgId,
    count: products.length,
    products: products.map(p => ({
      id:                 p.id,
      sku:                p.sku,
      name:               p.name,
      category:           p.category,
      description:        p.description,
      selling_price:      p.selling_price,
      cost_price:         p.cost_price,
      mrp:                p.mrp,
      currency:           p.currency || 'INR',
      weight:             p.weight,
      dimensions:         p.dimensions,
      // Brand / identification
      brand:              p.brand || null,
      internal_barcode:   p.internal_barcode || null,
      manufacturer_barcode: p.manufacturer_barcode || null,
      country_of_origin:  p.country_of_origin || null,
      hsn_code:           p.hsn_code || null,
      gst_rate:           p.gst_rate != null ? parseFloat(p.gst_rate) : null,
      warranty_period_days: p.warranty_period_days || 0,
      tags:               Array.isArray(p.tags) ? p.tags : (p.tags ? JSON.parse(p.tags) : []),
      // Handling flags
      is_fragile:         p.is_fragile,
      requires_cold_storage: p.requires_cold_storage,
      is_hazmat:          p.is_hazmat,
      is_perishable:      p.is_perishable,
      package_type:       p.package_type,
      requires_insurance: p.requires_insurance,
      stock: {
        available:       p.total_available,
        reserved:        p.total_reserved,
        warehouse_count: p.warehouse_count,
      },
    })),
    _note: 'Only products with available inventory are listed. Use product.sku when placing orders via POST /:orgToken/orders.',
  });
});

/**
 * GET /api/webhooks/:orgToken/catalog/check-stock?sku=SKU-123&quantity=2
 *
 * Lightweight pre-order stock check. Returns whether a SKU has enough
 * available inventory for the requested quantity. Use before checkout to
 * block payment if out-of-stock.
 */
export const handleStockCheck = asyncHandler(async (req, res) => {
  const orgId = req.webhookOrganizationId;
  if (!orgId) throw new ValidationError('Invalid organization token');

  const { sku, quantity = 1 } = req.query;
  if (!sku) throw new ValidationError('sku query parameter is required');

  const qty = Math.max(1, parseInt(quantity) || 1);
  const warehouseId = await InventoryRepository.findBestWarehouseForSku(sku, orgId, qty);
  const inStock = warehouseId !== null;

  res.json({
    success: true,
    sku,
    quantity_requested: qty,
    in_stock: inStock,
    fulfillable: inStock,
    message: inStock
      ? `SKU "${sku}" has sufficient stock for quantity ${qty}.`
      : `SKU "${sku}" does not have sufficient stock for quantity ${qty}. Check /catalog for available products.`,
  });
});
