import logger from '../utils/logger.js';
import axios from 'axios';

/**
 * Webhook Simulator Service
 * Generates mock webhook data for testing SCM integrations
 * Simulates: Amazon orders, warehouse inventory, carrier tracking, returns, etc.
 */

class WebhookSimulator {
  constructor() {
    this.baseURL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`; // Your backend URL
  }

  // ==================== MOCK DATA GENERATORS ====================

  /**
   * Generate mock Amazon order webhook
   */
  generateAmazonOrder() {
    const orderStatuses = ['pending', 'confirmed', 'processing'];
    const carriers = ['FedEx', 'UPS', 'DHL', 'USPS'];
    
    return {
      event_type: 'order.created',
      timestamp: new Date().toISOString(),
      source: 'amazon',
      data: {
        order_id: `AMZ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        marketplace: 'amazon.com',
        customer: {
          id: `CUST-${Math.floor(Math.random() * 100000)}`,
          name: this.randomName(),
          email: `customer${Math.floor(Math.random() * 10000)}@example.com`,
          phone: this.randomPhone()
        },
        shipping_address: this.randomAddress(),
        items: this.generateOrderItems(Math.floor(Math.random() * 5) + 1),
        totals: {
          subtotal: (Math.random() * 500 + 50).toFixed(2),
          tax: (Math.random() * 50).toFixed(2),
          shipping: (Math.random() * 20 + 5).toFixed(2),
          total: (Math.random() * 600 + 70).toFixed(2)
        },
        status: orderStatuses[Math.floor(Math.random() * orderStatuses.length)],
        requested_carrier: carriers[Math.floor(Math.random() * carriers.length)],
        shipping_method: 'standard',
        priority: Math.random() > 0.8 ? 'high' : 'normal',
        created_at: new Date().toISOString()
      }
    };
  }

  /**
   * Generate mock Shopify order webhook
   */
  generateShopifyOrder() {
    return {
      event_type: 'orders/create',
      timestamp: new Date().toISOString(),
      source: 'shopify',
      data: {
        id: Math.floor(Math.random() * 1000000),
        order_number: `#${1000 + Math.floor(Math.random() * 9000)}`,
        email: `customer${Math.floor(Math.random() * 10000)}@example.com`,
        created_at: new Date().toISOString(),
        total_price: (Math.random() * 500 + 50).toFixed(2),
        currency: 'USD',
        financial_status: 'paid',
        fulfillment_status: null,
        line_items: this.generateOrderItems(Math.floor(Math.random() * 3) + 1).map(item => ({
          id: Math.floor(Math.random() * 1000000),
          product_id: item.product_id,
          title: item.name,
          quantity: item.quantity,
          price: item.price,
          sku: item.sku
        })),
        shipping_address: this.randomAddress(),
        customer: {
          id: Math.floor(Math.random() * 100000),
          email: `customer${Math.floor(Math.random() * 10000)}@example.com`,
          first_name: this.randomFirstName(),
          last_name: this.randomLastName(),
          phone: this.randomPhone()
        }
      }
    };
  }

  /**
   * Generate mock carrier tracking update webhook
   */
  generateCarrierTracking(carrier = 'FedEx') {
    const statuses = [
      'picked_up',
      'in_transit',
      'out_for_delivery',
      'delivered',
      'exception',
      'attempted_delivery'
    ];
    
    const events = {
      picked_up: 'Package picked up from warehouse',
      in_transit: 'Package is in transit',
      out_for_delivery: 'Out for delivery',
      delivered: 'Package delivered successfully',
      exception: 'Delivery exception - weather delay',
      attempted_delivery: 'Delivery attempted - customer not available'
    };

    const status = statuses[Math.floor(Math.random() * statuses.length)];

    return {
      event_type: 'tracking.update',
      timestamp: new Date().toISOString(),
      source: carrier.toLowerCase(),
      data: {
        tracking_number: `${carrier.substring(0, 3).toUpperCase()}${Date.now()}${Math.floor(Math.random() * 1000)}`,
        carrier: carrier,
        status: status,
        status_detail: events[status],
        location: this.randomCity(),
        estimated_delivery: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        actual_delivery: status === 'delivered' ? new Date().toISOString() : null,
        events: [
          {
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'picked_up',
            location: 'Warehouse - Chicago, IL'
          },
          {
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'in_transit',
            location: 'Distribution Center - Indianapolis, IN'
          },
          {
            timestamp: new Date().toISOString(),
            status: status,
            location: this.randomCity()
          }
        ],
        weight_lb: (Math.random() * 50 + 1).toFixed(2),
        dimensions: {
          length: Math.floor(Math.random() * 20 + 5),
          width: Math.floor(Math.random() * 15 + 5),
          height: Math.floor(Math.random() * 10 + 5)
        }
      }
    };
  }

  /**
   * Generate mock warehouse inventory update webhook
   */
  generateWarehouseInventory(warehouseId = 'WH-001') {
    const updateTypes = ['restock', 'adjustment', 'damage', 'return', 'transfer'];
    const type = updateTypes[Math.floor(Math.random() * updateTypes.length)];

    return {
      event_type: 'inventory.updated',
      timestamp: new Date().toISOString(),
      source: 'warehouse_system',
      data: {
        warehouse_id: warehouseId,
        warehouse_name: `Warehouse ${warehouseId}`,
        update_type: type,
        items: Array.from({ length: Math.floor(Math.random() * 10) + 1 }, () => ({
          sku: `SKU-${Math.floor(Math.random() * 10000)}`,
          product_name: this.randomProductName(),
          previous_quantity: Math.floor(Math.random() * 100),
          new_quantity: Math.floor(Math.random() * 100),
          change: Math.floor(Math.random() * 50) - 25,
          bin_location: `${String.fromCharCode(65 + Math.floor(Math.random() * 5))}-${Math.floor(Math.random() * 20) + 1}-${Math.floor(Math.random() * 10) + 1}`,
          reason: type
        })),
        updated_by: `USER-${Math.floor(Math.random() * 100)}`,
        notes: `${type.charAt(0).toUpperCase() + type.slice(1)} operation completed`
      }
    };
  }

  /**
   * Generate mock return request webhook
   */
  generateReturnRequest() {
    const reasons = [
      'damaged',
      'wrong_item',
      'not_as_described',
      'customer_remorse',
      'defective',
      'size_issue'
    ];

    return {
      event_type: 'return.requested',
      timestamp: new Date().toISOString(),
      source: 'customer_portal',
      data: {
        return_id: `RET-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        original_order_id: `ORD-${Date.now() - 7 * 24 * 60 * 60 * 1000}`,
        customer: {
          id: `CUST-${Math.floor(Math.random() * 100000)}`,
          name: this.randomName(),
          email: `customer${Math.floor(Math.random() * 10000)}@example.com`
        },
        items: this.generateOrderItems(Math.floor(Math.random() * 3) + 1).map(item => ({
          ...item,
          return_reason: reasons[Math.floor(Math.random() * reasons.length)],
          condition: Math.random() > 0.7 ? 'damaged' : 'good'
        })),
        pickup_address: this.randomAddress(),
        refund_amount: (Math.random() * 300 + 20).toFixed(2),
        requested_at: new Date().toISOString(),
        status: 'pending_approval'
      }
    };
  }

  /**
   * Generate mock carrier rate response webhook
   */
  generateCarrierRates(shipmentDetails) {
    const carriers = ['FedEx', 'UPS', 'DHL', 'USPS'];
    
    return {
      event_type: 'rates.response',
      timestamp: new Date().toISOString(),
      source: 'carrier_api',
      data: {
        request_id: `RATE-${Date.now()}`,
        rates: carriers.map(carrier => ({
          carrier: carrier,
          service: Math.random() > 0.5 ? 'Ground' : 'Express',
          rate: (Math.random() * 50 + 10).toFixed(2),
          currency: 'USD',
          estimated_days: Math.floor(Math.random() * 7) + 1,
          delivery_date: new Date(Date.now() + (Math.floor(Math.random() * 7) + 1) * 24 * 60 * 60 * 1000).toISOString(),
          available: Math.random() > 0.1
        })),
        origin: shipmentDetails?.origin || this.randomAddress(),
        destination: shipmentDetails?.destination || this.randomAddress(),
        weight_lb: shipmentDetails?.weight || (Math.random() * 50 + 1).toFixed(2)
      }
    };
  }

  // ==================== HELPER METHODS ====================

  generateOrderItems(count) {
    const products = [
      'Wireless Headphones', 'Laptop Stand', 'USB-C Cable', 'Mechanical Keyboard',
      'Mouse Pad', 'Webcam', 'Monitor', 'Phone Case', 'Tablet', 'Smart Watch'
    ];

    return Array.from({ length: count }, () => ({
      product_id: `PROD-${Math.floor(Math.random() * 10000)}`,
      sku: `SKU-${Math.floor(Math.random() * 10000)}`,
      name: products[Math.floor(Math.random() * products.length)],
      quantity: Math.floor(Math.random() * 5) + 1,
      price: (Math.random() * 200 + 10).toFixed(2),
      weight_lb: (Math.random() * 5 + 0.5).toFixed(2)
    }));
  }

  randomName() {
    return `${this.randomFirstName()} ${this.randomLastName()}`;
  }

  randomFirstName() {
    const names = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Chris', 'Lisa', 'Robert', 'Maria'];
    return names[Math.floor(Math.random() * names.length)];
  }

  randomLastName() {
    const names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    return names[Math.floor(Math.random() * names.length)];
  }

  randomPhone() {
    return `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`;
  }

  randomAddress() {
    const streets = ['Main St', 'Oak Ave', 'Maple Dr', 'Cedar Ln', 'Pine Rd'];
    const cities = ['New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ'];
    const cityState = cities[Math.floor(Math.random() * cities.length)];

    return {
      street: `${Math.floor(Math.random() * 9999) + 1} ${streets[Math.floor(Math.random() * streets.length)]}`,
      city: cityState.split(', ')[0],
      state: cityState.split(', ')[1],
      zip: `${Math.floor(Math.random() * 90000) + 10000}`,
      country: 'USA'
    };
  }

  randomCity() {
    const cities = [
      'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX',
      'Phoenix, AZ', 'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA'
    ];
    return cities[Math.floor(Math.random() * cities.length)];
  }

  randomProductName() {
    const adjectives = ['Premium', 'Essential', 'Pro', 'Ultra', 'Basic'];
    const products = ['Widget', 'Gadget', 'Tool', 'Device', 'Item'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${products[Math.floor(Math.random() * products.length)]}`;
  }

  // ==================== WEBHOOK SIMULATORS ====================

  /**
   * Simulate sending a webhook to your backend
   */
  async sendWebhook(endpoint, payload) {
    try {
      const url = `${this.baseURL}${endpoint}`;
      logger.info(`🔔 Simulating webhook: ${payload.event_type} → ${url}`);
      
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Source': payload.source,
          'X-Webhook-Event': payload.event_type
        },
        timeout: 5000
      });

      logger.info(`✅ Webhook delivered: ${payload.event_type} (${response.status})`);
      return { success: true, status: response.status, data: response.data };
    } catch (error) {
      logger.error(`❌ Webhook failed: ${payload.event_type}`, {
        error: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Simulate multiple webhooks in sequence
   */
  async simulateWebhookSequence(webhookConfigs) {
    const results = [];
    
    for (const config of webhookConfigs) {
      const result = await this.sendWebhook(config.endpoint, config.payload);
      results.push({ config, result });
      
      // Wait between webhooks if specified
      if (config.delay) {
        await new Promise(resolve => setTimeout(resolve, config.delay));
      }
    }
    
    return results;
  }

  /**
   * Start continuous webhook simulation (for testing)
   */
  async startContinuousSimulation(intervalSeconds = 30) {
    logger.info(`🚀 Starting continuous webhook simulation (every ${intervalSeconds}s)`);
    
    const simulate = async () => {
      const webhookTypes = [
        { type: 'amazon_order', generator: () => this.generateAmazonOrder(), endpoint: '/api/webhooks/orders' },
        { type: 'shopify_order', generator: () => this.generateShopifyOrder(), endpoint: '/api/webhooks/orders' },
        { type: 'carrier_tracking', generator: () => this.generateCarrierTracking('FedEx'), endpoint: '/api/webhooks/tracking' },
        { type: 'warehouse_inventory', generator: () => this.generateWarehouseInventory(), endpoint: '/api/webhooks/inventory' },
        { type: 'return_request', generator: () => this.generateReturnRequest(), endpoint: '/api/webhooks/returns' }
      ];

      // Pick random webhook type
      const webhook = webhookTypes[Math.floor(Math.random() * webhookTypes.length)];
      const payload = webhook.generator();
      
      await this.sendWebhook(webhook.endpoint, payload);
    };

    // Run immediately, then on interval
    await simulate();
    this.simulationInterval = setInterval(simulate, intervalSeconds * 1000);
    
    return this.simulationInterval;
  }

  /**
   * Stop continuous simulation
   */
  stopContinuousSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      logger.info('⏹️  Stopped continuous webhook simulation');
    }
  }
}

export default new WebhookSimulator();
