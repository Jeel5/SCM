# Webhook System

> Last updated: 2026-02-22

---

## Overview

The SCM backend accepts webhooks from external platforms (e-commerce, warehouses, carriers) and processes them asynchronously via a background job queue backed by PostgreSQL.

Every incoming webhook is immediately queued as a `background_jobs` row and acknowledged with `200 OK + job_id`. The actual processing happens in the `JobWorker` which polls the queue every 5 seconds.

---

## Webhook Routes

All webhook routes are prefixed `/api/webhooks`.

### Org-Scoped Routes (recommended)

Each organization has a unique `webhook_token` (64-char hex, stored in `organizations.webhook_token`).  
Pass the token as the first path segment — the `resolveWebhookOrg` middleware validates it and sets `req.webhookOrganizationId`.

```
POST /api/webhooks/:orgToken/orders      → handleOrderWebhook
POST /api/webhooks/:orgToken/inventory   → handleInventoryWebhook
POST /api/webhooks/:orgToken/returns     → handleReturnWebhook
POST /api/webhooks/:orgToken/tracking    → handleTrackingWebhook
POST /api/webhooks/:orgToken/rates       → handleRatesWebhook
```

### Legacy / No-Token Routes

These exist for backward compatibility and the demo portal.  
`organization_id` is stored as `null` in the database for jobs from these routes.

```
POST /api/webhooks/orders
POST /api/webhooks/tracking
POST /api/webhooks/inventory
POST /api/webhooks/returns
POST /api/webhooks/rates
POST /api/webhooks/generic
```

### Management Routes (require JWT `authenticate`)

```
GET /api/webhooks/status/:jobId    → Check job processing status
GET /api/webhooks/sample/:type     → Generate sample webhook payload for testing
```

---

## Order Webhook

### Envelope format (preferred)

```json
POST /api/webhooks/<orgToken>/orders
Content-Type: application/json

{
  "event_type": "order.created",
  "source": "croma",
  "timestamp": "2026-02-22T10:00:00Z",
  "data": {
    "external_order_id": "CROMA-ORDER-12345",
    "customer_name": "Rahul Sharma",
    "customer_email": "rahul@example.com",
    "customer_phone": "9876543210",
    "shipping_address": {
      "street": "42 MG Road",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "country": "India"
    },
    "items": [
      { "sku": "IPHONE-15-BLK", "name": "iPhone 15 Black", "quantity": 1, "price": 79999 }
    ],
    "payment_method": "prepaid",
    "total_amount": 79999
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook received and queued for processing",
  "job_id": "90ebc30e-83d2-4650-bc93-e9a69430903a"
}
```

### Bare payload format (also accepted)

If the body contains `customer_name`, `items`, or `external_order_id` directly (no wrapper), the controller auto-wraps it:

```json
POST /api/webhooks/<orgToken>/orders
Content-Type: application/json

{
  "external_order_id": "CROMA-123",
  "customer_name": "Rahul Sharma",
  "items": [...]
}
```

This allows demo integrations and legacy clients to send data without constructing an envelope.

### Source-specific normalization

The controller normalizes order data per platform before queuing:

| `source` value | Processing |
|---|---|
| `amazon` | `processAmazonOrder()` — maps Amazon field names |
| `shopify` | `processShopifyOrder()` — maps Shopify field names |
| `ebay` | `processEbayOrder()` — maps eBay field names |
| anything else | Raw `data` passed through (works for `croma`, `demo`, etc.) |

---

## Job Processing Flow

```
Webhook received
      │
      ▼
webhooksController validates payload
      │
      ▼
jobsService.createJob('process_order', { source, event_type, order, organization_id })
      │   INSERT INTO background_jobs → status='pending'
      │
      ▼
Respond 200 immediately with { job_id }
      │
      ▼ (async — up to 5s later)
JobWorker.poll() picks up job
      │   SELECT ... FROM background_jobs WHERE status='pending' LIMIT <slots>
      │
      ▼
jobHandlers.handleProcessOrder(payload)
      │   1. INSERT INTO orders (with organization_id)
      │   2. INSERT INTO order_items
      │   3. carrierAssignmentService.requestCarrierAssignment(orderId, { items: [] })
      │      ├─ Queries TOP 3 carriers by reliability_score WHERE is_active=true AND availability_status='available'
      │      └─ INSERT INTO carrier_assignments × 3 (status='pending', expires in 10 min)
      │
      ▼
UPDATE background_jobs SET status='completed'
```

---

## Job Types

| `job_type` | Handler | What it does |
|---|---|---|
| `process_order` | `handleProcessOrder` | Inserts order + items, triggers carrier assignment |
| `update_tracking` | `handleUpdateTracking` | Updates shipment tracking status from carrier webhook |
| `sync_inventory` | `handleInventorySync` | Syncs inventory data from warehouse system |
| `process_return` | `handleProcessReturn` | Processes return request |
| `sla_monitoring` | `handleSLAMonitoring` | Scans active shipments for SLA violations |
| `exception_escalation` | `handleExceptionEscalation` | Auto-escalates overdue exceptions |
| `invoice_generation` | `handleInvoiceGeneration` | Generates carrier invoice for a billing period |
| `data_cleanup` | `handleDataCleanup` | Purges old logs/notifications/completed jobs |
| `notification_dispatch` | `handleNotificationDispatch` | Sends batch email/SMS/push notifications |
| `report_generation` | `handleReportGeneration` | Generates analytics/performance reports |
| `assignment_retry` | `handleAssignmentRetry` | Retries carrier assignment for stalled orders |

---

## Background Job Worker

**File:** `backend/jobs/jobWorker.js`

- Polls `background_jobs` every **5 seconds** for `status='pending'` rows
- Runs up to **5 jobs concurrently** (configurable)
- On completion: sets `status='completed'`, stores `result` JSON
- On failure: increments `attempts`, sets `status='failed'`, stores `error_message`
- Graceful shutdown: waits up to 30s for active jobs before stopping

```javascript
const worker = new JobWorker({
  pollInterval: 5000,  // ms
  concurrency: 5       // max parallel jobs
});
await worker.start();
```

---

## Cron Scheduler

**File:** `backend/jobs/cronScheduler.js`

Checks `cron_schedules` table every **60 seconds** for rows whose `next_run` ≤ NOW. For each due schedule it creates a `background_jobs` row via `jobsService.createJob()`, then updates `last_run` and calculates the next run time using `cron-parser`.

Typical scheduled jobs:
- SLA monitoring (every 15 min)
- Exception escalation (every 30 min)
- Data cleanup (daily)

---

## Getting Your Org's Webhook Token

```bash
# Direct DB query
PGPASSWORD='<password>' psql -U postgres -d scm_db -c \
  "SELECT name, webhook_token FROM organizations WHERE is_active = true;"

# Or via application after login:
GET /api/organizations/:id  # requires superadmin or admin JWT
```

---

## Testing with curl

```bash
# Replace <token> with the actual org webhook_token
TOKEN="7d0aa9fe498ea6bc704bd230ea00bdc57c4c246213d91eba3c1ceaaabab83293"

curl -X POST "http://localhost:3000/api/webhooks/$TOKEN/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "order.created",
    "source": "croma",
    "data": {
      "external_order_id": "TEST-001",
      "customer_name": "Test User",
      "customer_email": "test@example.com",
      "customer_phone": "9999999999",
      "shipping_address": {
        "street": "123 Test St",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001",
        "country": "India"
      },
      "items": [{ "sku": "TEST-SKU", "name": "Test Product", "quantity": 1, "price": 999 }],
      "total_amount": 999
    }
  }'
```

Check job status:
```bash
curl "http://localhost:3000/api/webhooks/status/<job_id>" \
  -H "Authorization: Bearer <jwt>"
```

---

## Simulation CLI

```bash
cd backend

# Simulate a single order webhook
npm run simulate order

# All webhook types at once
npm run simulate:all

# Continuous (every 30s)
npm run simulate:continuous

# Burst (20 webhooks)
npm run simulate:burst
```

**Note:** The simulator sends to the legacy `/api/webhooks/orders` (no org token) — orders land with `organization_id = null`.  
For testing the full multi-tenant flow, use the Customer Portal demo page or curl with an org token.

---

## Database Tables

### `background_jobs`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `job_type` | varchar | e.g., `process_order` |
| `status` | varchar | `pending`, `processing`, `completed`, `failed` |
| `payload` | jsonb | Input data for the handler |
| `result` | jsonb | Output from the handler on success |
| `error_message` | text | Error message on failure |
| `priority` | integer | 1 (highest) – 10 (lowest) |
| `attempts` | integer | How many times this job ran |
| `max_retries` | integer | Max allowed attempts |
| `created_at` | timestamptz | |
| `started_at` | timestamptz | |
| `completed_at` | timestamptz | |

### `cron_schedules`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `name` | varchar | Human-readable label |
| `job_type` | varchar | Matches a key in `jobHandlers` |
| `cron_expression` | varchar | e.g., `*/15 * * * *` |
| `payload` | jsonb | Static payload passed to every run |
| `is_active` | boolean | |
| `last_run` | timestamptz | |
| `next_run` | timestamptz | |

---

## Troubleshooting

| Problem | Check |
|---|---|
| `{"success":false,"message":"Invalid webhook token"}` | Token in URL doesn't match `organizations.webhook_token` |
| `{"success":false,"message":"Invalid webhook payload"}` | Body missing `event_type`, `source`, `data` AND missing bare-payload fields |
| Job stays `pending` forever | Server not running, or job worker failed to start (check startup logs) |
| Job `failed` with error | `SELECT error_message FROM background_jobs WHERE status='failed' ORDER BY created_at DESC LIMIT 5` |
| Carrier assignments not created | `handleProcessOrder` error in `assignment trigger` (check server logs for `⚠️ Carrier assignment trigger failed`) |### 3. Check the Results

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
