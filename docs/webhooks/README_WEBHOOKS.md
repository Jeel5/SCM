# 🎯 SCM Webhook Simulation System - Complete Solution

## Overview

Your SCM project is now equipped with a **complete webhook simulation system** that allows you to test all functionality without real external integrations! 🎉

## What You Get

### ✅ Mock Data Generators
Generates realistic webhook data for:
- **E-commerce Orders** (Amazon, Shopify, eBay)
- **Carrier Tracking** (FedEx, UPS, DHL, USPS)
- **Warehouse Inventory** (stock updates, transfers, adjustments)
- **Customer Returns** (return requests with reasons)
- **Shipping Rates** (multi-carrier rate quotes)

### ✅ Webhook Receivers
API endpoints that accept webhooks and queue them as background jobs:
- `POST /api/webhooks/orders` - Process orders
- `POST /api/webhooks/tracking` - Update tracking
- `POST /api/webhooks/inventory` - Sync inventory
- `POST /api/webhooks/returns` - Handle returns
- `POST /api/webhooks/rates` - Store rates

### ✅ Background Job Processing
Automatic processing of webhook data:
- 5 concurrent workers
- Automatic retry on failure (up to 3 times)
- Dead Letter Queue for failed jobs
- Graceful shutdown handling

### ✅ CLI Tool
Easy-to-use command-line interface:
```bash
npm run simulate:all           # All webhook types
npm run simulate:continuous    # Continuous every 30s
npm run simulate:burst         # Burst of 20 webhooks
```

### ✅ Monitoring Dashboard
Real-time webhook activity monitoring:
- `GET /api/webhooks/dashboard` - Activity dashboard
- `GET /api/webhooks/stats` - Database statistics
- `GET /api/webhooks/status/:jobId` - Individual job status
- `GET /api/webhooks/sample/:type` - Preview mock data

## Quick Start

### 1. First Time Setup

```bash
# Install dependencies (if not already done)
cd backend
npm install

# Create missing database tables
psql -U postgres -d scm_db -f ../add_new_tables.sql

# Start the server
npm run dev
```

### 2. Test Webhook Simulation

**Open Terminal 1 - Server:**
```bash
cd backend
npm run dev
```

**Open Terminal 2 - Simulator:**
```bash
cd backend

# Test single webhook
npm run simulate order

# Watch Terminal 1 for processing logs!
```

### 3. Check the Results

```bash
# View webhook dashboard
curl http://localhost:5000/api/webhooks/dashboard

# View database stats
curl http://localhost:5000/api/webhooks/stats

# Check orders table
psql -U postgres -d scm_db -c "SELECT * FROM orders LIMIT 5;"
```

## Usage Examples

### Single Webhook Types

```bash
# E-commerce orders
node simulateWebhooks.js order

# Tracking updates
node simulateWebhooks.js tracking

# Inventory sync
node simulateWebhooks.js inventory

# Return requests
node simulateWebhooks.js return

# Shipping rates
node simulateWebhooks.js rates
```

### Batch Operations

```bash
# All webhook types at once
node simulateWebhooks.js all

# Continuous simulation (every 30 seconds)
node simulateWebhooks.js continuous 30

# Burst of 50 webhooks
node simulateWebhooks.js burst 50
```

### Using NPM Scripts

```bash
npm run simulate:all          # All types once
npm run simulate:continuous   # Every 30s
npm run simulate:burst        # 20 webhooks
npm run simulate order        # Single order
```

## API Endpoints

### Webhook Receivers (POST)

```bash
# Send order webhook
curl -X POST http://localhost:5000/api/webhooks/orders \
  -H "Content-Type: application/json" \
  -d @sample_order.json

# Send tracking update
curl -X POST http://localhost:5000/api/webhooks/tracking \
  -H "Content-Type: application/json" \
  -d @sample_tracking.json
```

### Monitoring (GET)

```bash
# Activity dashboard (last 24 hours)
curl http://localhost:5000/api/webhooks/dashboard

# Custom time range (last 48 hours)
curl "http://localhost:5000/api/webhooks/dashboard?hours=48"

# Database statistics
curl http://localhost:5000/api/webhooks/stats

# Check specific job status
curl http://localhost:5000/api/webhooks/status/123

# Get sample webhook data
curl http://localhost:5000/api/webhooks/sample/amazon_order
curl http://localhost:5000/api/webhooks/sample/tracking
curl http://localhost:5000/api/webhooks/sample/inventory
```

## Webhook Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. WEBHOOK GENERATED                                             │
│    simulateWebhooks.js → Mock data created                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. HTTP REQUEST                                                  │
│    POST /api/webhooks/orders                                     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. WEBHOOK RECEIVER                                              │
│    webhooksController.handleOrderWebhook()                       │
│    → Validates payload                                           │
│    → Transforms to standard format                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. JOB QUEUED                                                    │
│    jobsService.createJob()                                       │
│    → INSERT INTO background_jobs                                 │
│    → Returns job_id immediately                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. WORKER PICKS UP JOB                                           │
│    jobWorker.poll() (every 5 seconds)                            │
│    → SELECT FROM background_jobs WHERE status = 'pending'        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. JOB PROCESSED                                                 │
│    jobHandlers.handleProcessOrder()                              │
│    → INSERT INTO orders                                          │
│    → INSERT INTO order_items                                     │
│    → UPDATE background_jobs SET status = 'completed'             │
└─────────────────────────────────────────────────────────────────┘
```

## Mock Data Examples

### Amazon Order
```json
{
  "event_type": "order.created",
  "source": "amazon",
  "timestamp": "2026-01-30T10:00:00Z",
  "data": {
    "order_id": "AMZ-1738240800000-123",
    "customer": {
      "name": "John Smith",
      "email": "customer123@example.com",
      "phone": "+12345678901"
    },
    "items": [
      {
        "sku": "SKU-1234",
        "name": "Wireless Headphones",
        "quantity": 2,
        "price": "49.99"
      }
    ],
    "totals": {
      "subtotal": "99.98",
      "tax": "8.50",
      "shipping": "5.99",
      "total": "114.47"
    },
    "status": "confirmed",
    "requested_carrier": "FedEx"
  }
}
```

### Tracking Update
```json
{
  "event_type": "tracking.update",
  "source": "fedex",
  "timestamp": "2026-01-30T12:00:00Z",
  "data": {
    "tracking_number": "FED1738240800000-456",
    "carrier": "FedEx",
    "status": "in_transit",
    "status_detail": "Package is in transit",
    "location": "Chicago, IL",
    "events": [
      {
        "timestamp": "2026-01-28T10:00:00Z",
        "status": "picked_up",
        "location": "Warehouse - Chicago, IL"
      }
    ]
  }
}
```

## Database Schema

### background_jobs table
```sql
- id (SERIAL PRIMARY KEY)
- job_type (VARCHAR) - e.g., 'process_order'
- status (VARCHAR) - 'pending', 'processing', 'completed', 'failed'
- payload (JSONB) - webhook data
- result (JSONB) - processing result
- error (TEXT) - error message if failed
- priority (INTEGER) - 1 (highest) to 10 (lowest)
- attempts (INTEGER) - retry counter
- max_retries (INTEGER) - max retry limit
- created_at, started_at, completed_at (TIMESTAMP)
```

### orders table
```sql
- id (SERIAL PRIMARY KEY)
- external_order_id (VARCHAR) - e.g., 'AMZ-123456'
- platform (VARCHAR) - 'amazon', 'shopify', etc.
- customer_name, customer_email, customer_phone
- shipping_address (JSONB)
- total_amount, tax_amount, shipping_amount (DECIMAL)
- status (VARCHAR)
- created_at, updated_at
```

## Configuration

### Job Worker Settings
Edit [jobWorker.js](backend/workers/jobWorker.js):
```javascript
// Concurrent job processing
concurrency: 5  // Change to 10 for more throughput

// Polling interval
pollInterval: 5000  // milliseconds (5 seconds)

// Shutdown timeout
stopTimeout: 30000  // milliseconds (30 seconds)
```

### Webhook Simulator Settings
Edit [webhookSimulator.js](backend/services/webhookSimulator.js):
```javascript
// Base URL
this.baseURL = 'http://localhost:5000'

// Continuous simulation interval (in CLI)
node simulateWebhooks.js continuous 10  // 10 seconds
```

## Monitoring & Debugging

### View Live Logs
```bash
# Start server with logs
npm run dev

# You'll see:
# 🔔 Simulating webhook: order.created → http://localhost:5000/api/webhooks/orders
# ✅ Webhook delivered: order.created (200)
# 📦 Received order webhook: order.created from amazon
# ✅ Order webhook queued as job 123
# 🔄 Processing job 123: process_order
# ✅ Order AMZ-123456 processed as ID 45
```

### Query Database
```sql
-- Recent jobs
SELECT id, job_type, status, created_at, completed_at 
FROM background_jobs 
ORDER BY created_at DESC 
LIMIT 10;

-- Job statistics
SELECT job_type, status, COUNT(*) 
FROM background_jobs 
GROUP BY job_type, status;

-- Failed jobs
SELECT id, job_type, error, attempts 
FROM background_jobs 
WHERE status = 'failed';

-- Recent orders
SELECT id, external_order_id, platform, customer_name, total_amount, status 
FROM orders 
ORDER BY created_at DESC 
LIMIT 10;

-- Shipment tracking
SELECT id, tracking_number, carrier, status, current_location 
FROM shipments 
ORDER BY updated_at DESC 
LIMIT 10;
```

### Dashboard API
```bash
# Get webhook activity dashboard
curl http://localhost:5000/api/webhooks/dashboard | jq

# Response includes:
{
  "summary": {
    "total_webhooks": 150,
    "successful": 145,
    "failed": 2,
    "pending": 3,
    "success_rate": "96.67"
  },
  "job_type_breakdown": {
    "process_order": {
      "total": 50,
      "completed": 48,
      "failed": 1,
      "avg_duration": "0.45"
    }
  },
  "recent_jobs": [...],
  "hourly_volume": [...],
  "failures": [...]
}
```

## Production Readiness

### For Real Webhooks

When you get real webhook integrations:

**1. Expose Your Server:**
```bash
# Option A: Use ngrok for testing
ngrok http 5000
# → https://abc123.ngrok.io

# Configure in Amazon Seller Central:
# Webhook URL: https://abc123.ngrok.io/api/webhooks/orders

# Option B: Deploy to production
# Deploy to AWS/Vercel/Railway
# Use production URL: https://api.yourscm.com/webhooks/orders
```

**2. Add Security (TODO):**
```javascript
// Verify webhook signatures
function verifyWebhookSignature(req) {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET;
  const payload = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', secret);
  const computedSignature = hmac.update(payload).digest('hex');
  return signature === computedSignature;
}
```

**3. Rate Limiting:**
```javascript
import rateLimit from 'express-rate-limit';

const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/webhooks', webhookLimiter);
```

## Troubleshooting

### Webhooks not being processed?
1. Check server is running: `curl http://localhost:5000/health`
2. Check database connection
3. Check logs for errors
4. Verify tables exist: `\dt` in psql

### Jobs stuck in 'pending'?
1. Check if job worker is running (look for "🚀 Job Worker started" in logs)
2. Restart server: `npm run dev`
3. Check concurrency setting in jobWorker.js

### High failure rate?
1. Check error messages: `SELECT error FROM background_jobs WHERE status = 'failed'`
2. Check database constraints (foreign keys, unique constraints)
3. Review job handler logic in jobHandlers.js

### Simulation script not working?
1. Ensure server is running first
2. Check baseURL in webhookSimulator.js matches server port
3. Try with curl manually to test endpoint

## Files Created

```
backend/
├── services/
│   └── webhookSimulator.js       # Mock data generator
├── controllers/
│   └── webhooksController.js     # Webhook receivers
├── routes/
│   └── webhooks.js                # Webhook routes
├── workers/
│   ├── jobWorker.js               # Job processing (updated)
│   └── jobHandlers.js             # Job handlers (updated with webhook handlers)
├── simulateWebhooks.js            # CLI tool
└── package.json                   # Updated with npm scripts

docs/
├── WEBHOOK_SIMULATION.md          # Detailed guide
├── WEBHOOK_QUICKSTART.md          # Quick start guide
└── README_WEBHOOKS.md             # This file
```

## Next Steps

1. ✅ **Test the system**
   ```bash
   npm run simulate:all
   ```

2. ✅ **Build frontend UI** to display webhook data
   - Orders dashboard
   - Tracking timeline
   - Inventory viewer
   - Returns management

3. 🔜 **Add real integrations** when ready
   - Amazon MWS/SP-API
   - Shopify webhooks
   - FedEx/UPS APIs

4. 🔜 **Enhance monitoring**
   - Add WebSocket for real-time updates
   - Create admin dashboard
   - Set up alerts for failures

## BullMQ Alternative

You mentioned BullMQ - here's a comparison:

| Feature | Current (PostgreSQL) | BullMQ (Redis) |
|---------|---------------------|----------------|
| Setup | ✅ No additional services | ❌ Requires Redis |
| Performance | ✅ Good (100s jobs/sec) | ✅✅ Excellent (1000s/sec) |
| UI Dashboard | ❌ Build custom | ✅ Built-in Bull Board |
| Persistence | ✅ PostgreSQL | ❌ Redis (in-memory) |
| Integration | ✅ Same DB as app | ❌ Separate service |
| Cost | ✅ Free | 💰 Redis hosting |

**Recommendation:** Stick with current PostgreSQL solution unless you need to process thousands of webhooks per second.

## Support & Resources

- **Documentation:** [WEBHOOK_SIMULATION.md](./WEBHOOK_SIMULATION.md)
- **Quick Start:** [WEBHOOK_QUICKSTART.md](./WEBHOOK_QUICKSTART.md)
- **API Reference:** [backend/QUICK_REFERENCE.md](./backend/QUICK_REFERENCE.md)

---

**Ready to test?** Run:
```bash
cd backend && npm run dev
```

Then in another terminal:
```bash
cd backend && npm run simulate:all
```

🎉 **You now have a complete webhook simulation system!**
