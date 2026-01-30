import logger from '../utils/logger.js';
import { jobsService } from '../services/jobsService.js';

/**
 * Webhook Controller
 * Handles incoming webhooks from external systems
 */

/**
 * Handle order webhooks from e-commerce platforms
 */
export const handleOrderWebhook = async (req, res, next) => {
  try {
    const { event_type, source, data, timestamp } = req.body;
    
    logger.info(`📦 Received order webhook: ${event_type} from ${source}`);

    // Validate webhook payload
    if (!event_type || !source || !data) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook payload'
      });
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
        processedOrder = data; // Generic handler
    }

    // Create background job to process order
    const job = await jobsService.createJob(
      'process_order',
      {
        source,
        event_type,
        order: processedOrder,
        received_at: timestamp || new Date().toISOString()
      },
      data.priority === 'high' ? 1 : 5
    );

    logger.info(`✅ Order webhook queued as job ${job.id}`);

    // Respond immediately (webhook pattern - don't make sender wait)
    res.status(200).json({
      success: true,
      message: 'Webhook received and queued for processing',
      job_id: job.id
    });

  } catch (error) {
    logger.error('Error handling order webhook:', error);
    next(error);
  }
};

/**
 * Handle carrier tracking webhooks
 */
export const handleTrackingWebhook = async (req, res, next) => {
  try {
    const { event_type, source, data, timestamp } = req.body;
    
    logger.info(`🚚 Received tracking webhook: ${event_type} from ${source}`);

    if (!event_type || !source || !data || !data.tracking_number) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tracking webhook payload'
      });
    }

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
      data.status === 'delivered' ? 2 : 5
    );

    logger.info(`✅ Tracking webhook queued as job ${job.id}`);

    res.status(200).json({
      success: true,
      message: 'Tracking update received',
      job_id: job.id
    });

  } catch (error) {
    logger.error('Error handling tracking webhook:', error);
    next(error);
  }
};

/**
 * Handle warehouse inventory webhooks
 */
export const handleInventoryWebhook = async (req, res, next) => {
  try {
    const { event_type, source, data, timestamp } = req.body;
    
    logger.info(`📊 Received inventory webhook: ${event_type} from ${source}`);

    if (!event_type || !source || !data || !data.warehouse_id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid inventory webhook payload'
      });
    }

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
        received_at: timestamp || new Date().toISOString()
      },
      data.update_type === 'critical' ? 1 : 5
    );

    logger.info(`✅ Inventory webhook queued as job ${job.id}`);

    res.status(200).json({
      success: true,
      message: 'Inventory update received',
      job_id: job.id,
      items_updated: data.items?.length || 0
    });

  } catch (error) {
    logger.error('Error handling inventory webhook:', error);
    next(error);
  }
};

/**
 * Handle return request webhooks
 */
export const handleReturnWebhook = async (req, res, next) => {
  try {
    const { event_type, source, data, timestamp } = req.body;
    
    logger.info(`↩️  Received return webhook: ${event_type} from ${source}`);

    if (!event_type || !source || !data || !data.return_id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid return webhook payload'
      });
    }

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
        received_at: timestamp || new Date().toISOString()
      },
      3
    );

    logger.info(`✅ Return webhook queued as job ${job.id}`);

    res.status(200).json({
      success: true,
      message: 'Return request received',
      job_id: job.id,
      return_id: data.return_id
    });

  } catch (error) {
    logger.error('Error handling return webhook:', error);
    next(error);
  }
};

/**
 * Handle carrier rate response webhooks
 */
export const handleRatesWebhook = async (req, res, next) => {
  try {
    const { event_type, source, data, timestamp } = req.body;
    
    logger.info(`💰 Received rates webhook: ${event_type} from ${source}`);

    if (!event_type || !source || !data || !data.request_id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rates webhook payload'
      });
    }

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
      4
    );

    logger.info(`✅ Rates webhook queued as job ${job.id}`);

    res.status(200).json({
      success: true,
      message: 'Rate information received',
      job_id: job.id,
      rates_count: data.rates?.length || 0
    });

  } catch (error) {
    logger.error('Error handling rates webhook:', error);
    next(error);
  }
};

/**
 * Generic webhook handler (for testing/debugging)
 */
export const handleGenericWebhook = async (req, res, next) => {
  try {
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

  } catch (error) {
    logger.error('Error handling generic webhook:', error);
    next(error);
  }
};

/**
 * Get webhook delivery status (check if job was processed)
 */
export const getWebhookStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    
    const job = await jobsService.getJobById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

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

  } catch (error) {
    logger.error('Error getting webhook status:', error);
    next(error);
  }
};

/**
 * Generate sample webhook data (for testing/preview)
 */
export const generateSampleWebhook = async (req, res, next) => {
  try {
    const { type } = req.params;
    const webhookSimulator = (await import('../services/webhookSimulator.js')).default;
    
    let sample;
    switch (type) {
      case 'amazon_order':
        sample = webhookSimulator.generateAmazonOrder();
        break;
      case 'shopify_order':
        sample = webhookSimulator.generateShopifyOrder();
        break;
      case 'tracking':
        sample = webhookSimulator.generateCarrierTracking('FedEx');
        break;
      case 'inventory':
        sample = webhookSimulator.generateWarehouseInventory();
        break;
      case 'return':
        sample = webhookSimulator.generateReturnRequest();
        break;
      case 'rates':
        sample = webhookSimulator.generateCarrierRates();
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook type',
          available: ['amazon_order', 'shopify_order', 'tracking', 'inventory', 'return', 'rates']
        });
    }
    
    res.json({
      success: true,
      type,
      sample
    });
    
  } catch (error) {
    logger.error('Error generating sample webhook:', error);
    next(error);
  }
};

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
