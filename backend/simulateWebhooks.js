#!/usr/bin/env node
/**
 * Webhook Simulator CLI
 * Command-line tool to simulate webhooks for testing
 * 
 * Usage:
 *   node simulateWebhooks.js order              # Simulate single order webhook
 *   node simulateWebhooks.js tracking           # Simulate tracking update
 *   node simulateWebhooks.js inventory          # Simulate inventory update
 *   node simulateWebhooks.js return             # Simulate return request
 *   node simulateWebhooks.js rates              # Simulate rate response
 *   node simulateWebhooks.js all                # Simulate all webhook types
 *   node simulateWebhooks.js continuous [30]    # Start continuous simulation (30s interval)
 *   node simulateWebhooks.js burst [10]         # Send burst of 10 webhooks
 */

import webhookSimulator from './services/webhookSimulator.js';
import logger from './utils/logger.js';

const command = process.argv[2];
const param = process.argv[3];

async function main() {
  console.log('🎬 SCM Webhook Simulator\n');

  switch (command) {
    case 'order':
    case 'orders':
      console.log('📦 Simulating Amazon Order Webhook...');
      const amazonOrder = webhookSimulator.generateAmazonOrder();
      await webhookSimulator.sendWebhook('/api/webhooks/orders', amazonOrder);
      
      console.log('\n📦 Simulating Shopify Order Webhook...');
      const shopifyOrder = webhookSimulator.generateShopifyOrder();
      await webhookSimulator.sendWebhook('/api/webhooks/orders', shopifyOrder);
      break;

    case 'tracking':
      console.log('🚚 Simulating Carrier Tracking Webhook...');
      const tracking = webhookSimulator.generateCarrierTracking('FedEx');
      await webhookSimulator.sendWebhook('/api/webhooks/tracking', tracking);
      break;

    case 'inventory':
      console.log('📊 Simulating Warehouse Inventory Webhook...');
      const inventory = webhookSimulator.generateWarehouseInventory();
      await webhookSimulator.sendWebhook('/api/webhooks/inventory', inventory);
      break;

    case 'return':
    case 'returns':
      console.log('↩️  Simulating Return Request Webhook...');
      const returnReq = webhookSimulator.generateReturnRequest();
      await webhookSimulator.sendWebhook('/api/webhooks/returns', returnReq);
      break;

    case 'rates':
      console.log('💰 Simulating Carrier Rates Webhook...');
      const rates = webhookSimulator.generateCarrierRates();
      await webhookSimulator.sendWebhook('/api/webhooks/rates', rates);
      break;

    case 'all':
      console.log('🔄 Simulating All Webhook Types...\n');
      
      const webhooks = [
        { name: 'Amazon Order', payload: webhookSimulator.generateAmazonOrder(), endpoint: '/api/webhooks/orders' },
        { name: 'Shopify Order', payload: webhookSimulator.generateShopifyOrder(), endpoint: '/api/webhooks/orders' },
        { name: 'FedEx Tracking', payload: webhookSimulator.generateCarrierTracking('FedEx'), endpoint: '/api/webhooks/tracking' },
        { name: 'UPS Tracking', payload: webhookSimulator.generateCarrierTracking('UPS'), endpoint: '/api/webhooks/tracking' },
        { name: 'Inventory Update', payload: webhookSimulator.generateWarehouseInventory(), endpoint: '/api/webhooks/inventory' },
        { name: 'Return Request', payload: webhookSimulator.generateReturnRequest(), endpoint: '/api/webhooks/returns' },
        { name: 'Carrier Rates', payload: webhookSimulator.generateCarrierRates(), endpoint: '/api/webhooks/rates' }
      ];

      for (const webhook of webhooks) {
        console.log(`\n📨 Sending: ${webhook.name}`);
        await webhookSimulator.sendWebhook(webhook.endpoint, webhook.payload);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between webhooks
      }
      break;

    case 'continuous':
      const interval = parseInt(param) || 30;
      console.log(`🔁 Starting continuous simulation (every ${interval} seconds)`);
      console.log('Press Ctrl+C to stop\n');
      
      await webhookSimulator.startContinuousSimulation(interval);
      
      // Keep process alive
      process.on('SIGINT', () => {
        webhookSimulator.stopContinuousSimulation();
        console.log('\n\n👋 Stopped webhook simulation');
        process.exit(0);
      });
      break;

    case 'burst':
      const count = parseInt(param) || 10;
      console.log(`💥 Sending burst of ${count} webhooks...\n`);
      
      const webhookTypes = ['order', 'tracking', 'inventory', 'return', 'rates'];
      const promises = [];
      
      for (let i = 0; i < count; i++) {
        const type = webhookTypes[Math.floor(Math.random() * webhookTypes.length)];
        let payload, endpoint;
        
        switch (type) {
          case 'order':
            payload = webhookSimulator.generateAmazonOrder();
            endpoint = '/api/webhooks/orders';
            break;
          case 'tracking':
            payload = webhookSimulator.generateCarrierTracking('FedEx');
            endpoint = '/api/webhooks/tracking';
            break;
          case 'inventory':
            payload = webhookSimulator.generateWarehouseInventory();
            endpoint = '/api/webhooks/inventory';
            break;
          case 'return':
            payload = webhookSimulator.generateReturnRequest();
            endpoint = '/api/webhooks/returns';
            break;
          case 'rates':
            payload = webhookSimulator.generateCarrierRates();
            endpoint = '/api/webhooks/rates';
            break;
        }
        
        promises.push(webhookSimulator.sendWebhook(endpoint, payload));
      }
      
      await Promise.all(promises);
      console.log(`\n✅ Sent ${count} webhooks`);
      break;

    default:
      console.log(`❌ Unknown command: ${command}\n`);
      console.log('Available commands:');
      console.log('  order              - Simulate order webhook');
      console.log('  tracking           - Simulate tracking update');
      console.log('  inventory          - Simulate inventory update');
      console.log('  return             - Simulate return request');
      console.log('  rates              - Simulate rate response');
      console.log('  all                - Simulate all webhook types');
      console.log('  continuous [sec]   - Start continuous simulation');
      console.log('  burst [count]      - Send burst of webhooks');
      console.log('\nExamples:');
      console.log('  node simulateWebhooks.js order');
      console.log('  node simulateWebhooks.js continuous 30');
      console.log('  node simulateWebhooks.js burst 20');
      process.exit(1);
  }

  // Exit after single commands
  if (!['continuous'].includes(command)) {
    console.log('\n✅ Done!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
