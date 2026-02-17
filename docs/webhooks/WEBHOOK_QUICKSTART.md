# 🚀 Quick Start: Webhook Simulation

## Prerequisites
Make sure your backend server is running:
```bash
cd backend
npm run dev
```

## Method 1: Using NPM Scripts (Easiest)

```bash
cd backend

# Simulate all webhook types once
npm run simulate:all

# Start continuous simulation (every 30 seconds)
npm run simulate:continuous

# Send burst of 20 random webhooks
npm run simulate:burst

# Custom simulation
npm run simulate order        # Single order
npm run simulate tracking     # Single tracking update
npm run simulate inventory    # Single inventory update
```

## Method 2: Using Node Directly

```bash
cd backend

# Single webhook types
node simulateWebhooks.js order
node simulateWebhooks.js tracking
node simulateWebhooks.js inventory
node simulateWebhooks.js return
node simulateWebhooks.js rates

# All webhooks at once
node simulateWebhooks.js all

# Continuous simulation (custom interval)
node simulateWebhooks.js continuous 10   # Every 10 seconds
node simulateWebhooks.js continuous 60   # Every 60 seconds

# Burst mode
node simulateWebhooks.js burst 50        # Send 50 webhooks
```

## Method 3: Using REST API

### Preview webhook data (doesn't send):
```bash
# Get sample Amazon order
curl http://localhost:5000/api/webhooks/sample/amazon_order

# Get sample tracking update
curl http://localhost:5000/api/webhooks/sample/tracking

# Get sample inventory update
curl http://localhost:5000/api/webhooks/sample/inventory
```

### Send webhook manually:
```bash
# Send order webhook
curl -X POST http://localhost:5000/api/webhooks/orders \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "order.created",
    "source": "amazon",
    "timestamp": "2026-01-30T10:00:00Z",
    "data": {
      "order_id": "AMZ-TEST-001",
      "customer": {
        "name": "Test Customer",
        "email": "test@example.com"
      },
      "items": [
        {
          "sku": "SKU-001",
          "name": "Test Product",
          "quantity": 1,
          "price": "29.99"
        }
      ],
      "totals": {
        "total": "29.99"
      },
      "shipping_address": {
        "street": "123 Test St",
        "city": "Test City",
        "state": "CA",
        "zip": "12345",
        "country": "USA"
      }
    }
  }'
```

## Method 4: Using Postman/Thunder Client

1. Import the collection (create `webhook-tests.json`):

```json
{
  "info": {
    "name": "SCM Webhooks",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Send Amazon Order",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{{amazon_order_sample}}"
        },
        "url": {
          "raw": "http://localhost:5000/api/webhooks/orders",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["api", "webhooks", "orders"]
        }
      }
    },
    {
      "name": "Get Sample Data",
      "request": {
        "method": "GET",
        "url": {
          "raw": "http://localhost:5000/api/webhooks/sample/amazon_order",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["api", "webhooks", "sample", "amazon_order"]
        }
      }
    }
  ]
}
```

## What Happens When You Simulate?

1. **Webhook Generated** → Mock data created (order/tracking/inventory)
2. **HTTP POST** → Sent to webhook endpoint
3. **Queued as Job** → Added to `background_jobs` table
4. **Worker Processes** → Job handler executes within seconds
5. **Data Stored** → Order/shipment/inventory inserted into database

## Monitoring

### Watch server logs:
```bash
# In backend directory
npm run dev

# You'll see:
# 🔔 Simulating webhook: order.created → http://localhost:5000/api/webhooks/orders
# ✅ Webhook delivered: order.created (200)
# 📦 Received order webhook: order.created from amazon
# ✅ Order webhook queued as job 123
# 🔄 Processing job 123: process_order
# ✅ Order AMZ-123456 processed as ID 45
```

### Check job status:
```bash
curl http://localhost:5000/api/webhooks/status/{jobId}
```

### Query database:
```sql
-- See all jobs
SELECT * FROM background_jobs ORDER BY created_at DESC LIMIT 10;

-- See processed orders
SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;

-- See tracking updates
SELECT * FROM shipments ORDER BY updated_at DESC LIMIT 10;
```

## Common Scenarios

### Test Order Flow
```bash
# 1. Simulate order creation
npm run simulate order

# 2. Check logs to see order processed
# 3. Query database: SELECT * FROM orders WHERE platform = 'amazon';

# 4. Simulate tracking update for that order
npm run simulate tracking

# 5. Check shipments table
```

### Load Testing
```bash
# Send 100 webhooks rapidly
node simulateWebhooks.js burst 100

# Check job queue processing
# Query: SELECT status, COUNT(*) FROM background_jobs GROUP BY status;
```

### Continuous Integration Testing
```bash
# Start continuous simulation in background
npm run simulate:continuous &

# Let it run for 5 minutes
sleep 300

# Stop (find process and kill)
pkill -f simulateWebhooks
```

## Troubleshooting

### Webhooks not processing?
- Check server is running: `curl http://localhost:5000/health`
- Check logs for errors
- Verify database tables exist: `\dt` in psql
- Check job worker is running (should see in logs)

### Jobs stuck in 'pending' status?
- Worker might be stopped
- Restart server: `npm run dev`
- Check `background_jobs` table: `SELECT * FROM background_jobs WHERE status = 'pending'`

### Rate limiting?
- Current system has no rate limiting
- Jobs process at ~5 concurrent by default
- Can increase in `jobWorker.js`: Change `concurrency: 5` to higher number

## Next Steps

1. ✅ Start server
2. ✅ Run webhook simulation
3. ✅ Check logs
4. ✅ Query database to see data
5. 🔜 Build frontend to display this data
6. 🔜 Add real webhook integrations when ready

## Production Webhooks

When you have real webhooks from Amazon/Shopify/etc:

### Option 1: Expose with ngrok
```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 5000

# Copy URL like: https://abc123.ngrok.io
# Configure in Amazon/Shopify: https://abc123.ngrok.io/api/webhooks/orders
```

### Option 2: Deploy to production
- Deploy backend to cloud (AWS/Vercel/Railway)
- Configure webhook URLs in external systems
- Add webhook signature verification for security

## Additional Resources

- [Full Webhook Guide](./WEBHOOK_SIMULATION.md)
- [API Documentation](./backend/QUICK_REFERENCE.md)
- Postman collection: `webhook-tests.json`
