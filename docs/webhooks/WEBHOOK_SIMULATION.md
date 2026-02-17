# Webhook Simulation Guide

## Overview
Your SCM system now has complete webhook simulation capabilities! This allows you to test the entire system without needing real integrations.

## What's Been Implemented

### 1. Webhook Simulator Service (`services/webhookSimulator.js`)
Generates realistic mock webhook data for:
- **Amazon Orders** - Full order details with customer info, items, totals
- **Shopify Orders** - E-commerce order format
- **Carrier Tracking** - FedEx, UPS, DHL, USPS tracking updates
- **Warehouse Inventory** - Stock updates, adjustments, transfers
- **Return Requests** - Customer return requests with reasons
- **Carrier Rates** - Shipping rate quotes from multiple carriers

### 2. Webhook Receivers (`controllers/webhooksController.js`)
Handles incoming webhooks and queues them as background jobs:
- `/api/webhooks/orders` - Order processing
- `/api/webhooks/tracking` - Tracking updates
- `/api/webhooks/inventory` - Inventory sync
- `/api/webhooks/returns` - Return processing
- `/api/webhooks/rates` - Rate storage
- `/api/webhooks/generic` - Testing/debugging

### 3. Job Handlers (`workers/jobHandlers.js`)
Added 5 new job handlers to process webhook data:
- `process_order` - Inserts orders into database
- `update_tracking` - Updates shipment tracking
- `sync_inventory` - Syncs warehouse inventory
- `process_return` - Processes return requests
- `process_rates` - Stores carrier rates

### 4. CLI Tool (`simulateWebhooks.js`)
Command-line interface for easy testing

## How to Use

### Basic Usage

```bash
# Make the script executable (first time only)
chmod +x backend/simulateWebhooks.js

# Simulate a single order webhook
node backend/simulateWebhooks.js order

# Simulate tracking update
node backend/simulateWebhooks.js tracking

# Simulate inventory update
node backend/simulateWebhooks.js inventory

# Simulate return request
node backend/simulateWebhooks.js return

# Simulate rate response
node backend/simulateWebhooks.js rates

# Simulate ALL webhook types at once
node backend/simulateWebhooks.js all
```

### Advanced Usage

```bash
# Start continuous simulation (every 30 seconds)
node backend/simulateWebhooks.js continuous 30

# Send burst of 20 random webhooks
node backend/simulateWebhooks.js burst 20

# Continuous with custom interval (every 10 seconds)
node backend/simulateWebhooks.js continuous 10
```

### Testing with Postman/Thunder Client

You can also send webhooks manually using HTTP clients:

**POST** `http://localhost:5000/api/webhooks/orders`
```json
{
  "event_type": "order.created",
  "timestamp": "2026-01-30T10:00:00Z",
  "source": "amazon",
  "data": {
    "order_id": "AMZ-123456",
    "customer": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "items": [
      {
        "sku": "SKU-001",
        "name": "Product Name",
        "quantity": 2,
        "price": "29.99"
      }
    ],
    "totals": {
      "total": "59.98"
    }
  }
}
```

## Workflow

1. **Webhook Arrives** → Receiver endpoint validates and queues as job
2. **Job Worker** → Picks up job from queue
3. **Job Handler** → Processes webhook data (inserts to DB, updates records)
4. **Response** → Returns job ID for status checking

Check job status:
```bash
GET http://localhost:5000/api/webhooks/status/{jobId}
```

## For Real Production Webhooks

When you have real webhook integrations:

### 1. Use ngrok for Local Testing
```bash
# Install ngrok
npm install -g ngrok

# Expose your local server
ngrok http 5000

# Use the ngrok URL in external systems
# Example: https://abc123.ngrok.io/api/webhooks/orders
```

### 2. Webhook Security (TODO - Add later)
- Verify webhook signatures (HMAC)
- Rate limiting
- IP whitelisting
- Webhook secret validation

### 3. Webhook Retry Logic
Already implemented! Failed webhooks:
- Retry up to 3 times (configurable)
- Move to Dead Letter Queue after max retries
- Can be manually retried from DLQ

## BullMQ Integration (Optional)

You mentioned BullMQ - it's a Redis-based job queue. Current implementation uses PostgreSQL. To switch to BullMQ:

**Pros:**
- Better performance for high-volume jobs
- Built-in UI dashboard
- Advanced scheduling features

**Cons:**
- Requires Redis installation
- Additional infrastructure

For now, your PostgreSQL job queue works great! Consider BullMQ later if you need to process thousands of webhooks per second.

## Testing Checklist

- [ ] Start server: `npm run dev` in backend/
- [ ] Run webhook simulation: `node backend/simulateWebhooks.js all`
- [ ] Check logs for job processing
- [ ] Query database to see inserted orders/shipments
- [ ] Check job status via API
- [ ] Test Dead Letter Queue for failed jobs
- [ ] Try continuous simulation
- [ ] Test burst mode

## Examples of Generated Data

The simulator generates realistic data:
- Random customer names, emails, addresses
- Valid tracking numbers
- Realistic product SKUs and prices
- Multiple carriers (FedEx, UPS, DHL, USPS)
- Various order statuses and shipping methods
- Warehouse bin locations (A-1-5 format)
- Return reasons (damaged, wrong_item, etc.)

## Next Steps

1. **Run the migration** to create missing tables:
   ```bash
   psql -U postgres -d scm_db -f add_new_tables.sql
   ```

2. **Start the server**:
   ```bash
   cd backend
   npm run dev
   ```

3. **Test webhook simulation**:
   ```bash
   node backend/simulateWebhooks.js all
   ```

4. **Monitor the logs** to see webhooks being processed!

## Questions?

- "How do I add a new webhook type?" → Add generator in webhookSimulator.js, handler in webhooksController.js, job handler in jobHandlers.js
- "How do I increase job concurrency?" → Change `concurrency: 5` in jobWorker.js
- "Can I simulate delays/failures?" → Yes! Modify the simulator to randomly throw errors
- "How do I see processed jobs?" → Query `background_jobs` table or use `/api/jobs` endpoint
