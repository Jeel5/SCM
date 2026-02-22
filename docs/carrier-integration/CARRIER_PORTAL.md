# Carrier Assignment System & Portal

> Last updated: 2026-02-22

---

## Overview

When an order is processed by `handleProcessOrder`, the system automatically sends assignment requests to up to 3 carriers simultaneously. Carriers respond through the demo portal or their own systems (HMAC-signed webhook calls). The first carrier to accept wins; the others are auto-cancelled.

---

## Current Carriers (Live in DB)

| Name | Code | Service Type | Status |
|---|---|---|---|
| BlueDart Express | `BLUEDART` | standard | available |
| Delhivery | `DELHIVERY` | standard | available |
| DTDC Courier | `DTDC` | standard | available |
| Ecom Express | `ECOM` | standard | available |
| Shadowfax | `SHADOWFAX` | standard | available |

Carrier codes in the DB are simple uppercase abbreviations. Do **not** use suffix formats like `DTDC-001` or `DHL-001` — those codes do not exist.

---

## Assignment State Machine

```
order created
      │
      ▼
requestCarrierAssignment(orderId)
   ├─ SELECT TOP 3 carriers WHERE is_active=true AND availability_status='available'
   │   ordered by reliability_score DESC
   └─ For each: INSERT carrier_assignments (status='pending', expires_at=+10min)
                                │
         ┌──────────────────────┼───────────────────────┐
         ▼                      ▼                       ▼
    pending               pending                  pending
         │                      │                       │
    accepted ──────────►  cancelled              cancelled
    (first to accept)
         │
    INSERT shipments
    UPDATE order (status='shipped')
    UPDATE other assignments (status='cancelled')
         │
    rejected ← permanent — this carrier cannot handle the order
         │
    busy     ← temporary — carrier at capacity, keep pending
         │
    expired  ← 10-min window elapsed with no response
```

After expiry or all-reject: `assignmentRetryService` schedules a retry with the next batch of 3 carriers. Maximum 9 carriers (3 batches) before the order is placed `on_hold` for manual intervention.

---

## API Endpoints

### Internal (JWT authenticated)

```
POST /api/orders/:orderId/request-carriers
  → Manually trigger assignment for an order
  → Auth: authenticate + authorize('shipments:update')

GET /api/orders/:orderId/assignments
  → List all assignment records for an order
  → Auth: authenticate + authorize('shipments:read')

GET /api/assignments/:assignmentId
  → Get full assignment details
  → Auth: authenticate + authorize('shipments:read')
```

### Carrier-facing (HMAC authenticated)

These are called by the carrier's own system (or the demo portal simulating it).  
Authentication uses HMAC-SHA256 signature:

```
POST /api/assignments/:assignmentId/accept
POST /api/assignments/:assignmentId/reject
POST /api/assignments/:assignmentId/busy
POST /api/carriers/:code/availability
```

Required request headers:
```
X-Carrier-Signature: sha256=<hmac_sha256(body, webhook_secret)>
X-Carrier-Timestamp: <unix_ms>
```

Where `webhook_secret` is the carrier's `webhook_secret` field from the `carriers` table.

### Open (no auth — carrier portal polling)

```
GET /api/carriers/assignments/pending?carrierId=<CODE_OR_UUID>
  → Returns pending assignments for a carrier
  → Accepts either carrier code (e.g., DELHIVERY) or UUID
  → Used by the demo carrier portal to poll for new requests
```

---

## Carrier Portal (`demo/carrier-portal.html`)

A standalone HTML page that simulates a carrier partner's dispatch system.

### How to use

1. Start the backend: `cd backend && npm run dev`
2. Open `demo/carrier-portal.html` in a browser
3. Carrier buttons load automatically from `GET /api/demo/carriers`
4. Click a carrier (e.g., "Delhivery") to select it
5. Pending assignment requests appear for that carrier
6. Click **Accept**, **Reject**, or **Busy**
7. The portal polls for new requests every 5 seconds

### What the portal shows for a pending assignment

- Customer name + shipping address
- Order items and total value
- Pickup address (warehouse)
- Expiry countdown (10-minute window per batch)
- Assignment ID

### Accept flow

The portal generates an HMAC signature using the carrier's `webhook_secret` (fetched from `GET /api/demo/carrier-secret/:code`), then sends:

```json
POST /api/assignments/:id/accept
Headers:
  X-Carrier-Signature: sha256=...
  X-Carrier-Timestamp: 1740220215000

Body:
{
  "driverName": "Rakesh Kumar",
  "driverPhone": "9876543210",
  "vehicleNumber": "MH-01-AB-1234",
  "estimatedPickup": "2026-02-22T16:00:00Z"
}
```

On success: shipment row is created, all other pending assignments for the same order are cancelled.

### Reject flow

```json
POST /api/assignments/:id/reject

{
  "reason": "Route not serviceable",
  "reasonCode": "OUT_OF_ZONE"
}
```

### Status Update panel

The portal also has a panel to simulate delivery status events:

```json
POST /api/carriers/:code/tracking

{
  "trackingNumber": "DLVY-20260222-001",
  "status": "in_transit",
  "location": "Pune Hub",
  "description": "Package arrived at Pune sorting facility"
}
```

---

## Carrier Assignment Service

**File:** `backend/services/carrierAssignmentService.js`

Key methods:

| Method | Description |
|---|---|
| `requestCarrierAssignment(orderId, orderData)` | Full assignment flow — finds carriers, creates assignment rows, notifies carriers |
| `getPendingAssignments(carrierId, filters)` | Returns pending assignments for a carrier UUID |
| `acceptAssignment(assignmentId, payload)` | Processes acceptance — creates shipment, cancels others |
| `rejectAssignment(assignmentId, reason)` | Marks rejected — triggers retry if all 3 rejected |
| `markBusy(assignmentId)` | Marks busy — keeps it pending for later |

Carrier selection query:
```sql
SELECT id, code, name, contact_email, service_type, is_active, availability_status
FROM carriers
WHERE is_active = true
  AND availability_status = 'available'
  AND (service_type = $1 OR service_type = 'all')
ORDER BY reliability_score DESC
LIMIT 3
```

`$1` is the order's `priority` field (defaults to `'standard'`).

---

## Retry Logic

**Service:** `backend/services/assignmentRetryService.js`  
**Cron:** Every 30 minutes (configured in `cron_schedules` table)  
**Job type:** `assignment_retry`

Handles four scenarios each run:

1. **Expired assignments** — any `status='pending'` rows past `expires_at` → mark expired, try next batch
2. **Busy carriers now available** — carriers whose `availability_status` changed back to `'available'` → reset their assignment to `pending`
3. **All-rejected batch** — if all 3 assignments for an order are `rejected` → immediately try next batch
4. **Max attempts exceeded** — if `COUNT(DISTINCT carrier_id) >= 9` for an order → set order `status='on_hold'`, note manual review required

---

## Testing Scenarios

### Scenario A: Normal acceptance

1. Place order via `demo/customer.html`
2. Wait 5s (job worker processes)
3. Open `demo/carrier-portal.html` → select "Delhivery"
4. Assignment appears → click Accept
5. Check DB: `SELECT status FROM orders WHERE external_order_id='...'` → `shipped`
6. `SELECT * FROM shipments` → new row with tracking number

### Scenario B: Race condition (multiple browsers)

1. Open `demo/carrier-portal.html` in 3 browser windows
2. Window 1: select "Delhivery", Window 2: select "DTDC", Window 3: select "ECOM"
3. All three should show the same pending assignment
4. Click Accept in Window 1
5. Windows 2 and 3: assignment disappears on next 5s poll (auto-cancelled)

### Scenario C: All reject → retry

1. All 3 carriers reject
2. Retry service detects zero accepted + all rejected
3. Next batch of 3 carriers gets assignments
4. Repeat up to 9 total carrier attempts

### Useful DB queries

```sql
-- See all assignments for an order
SELECT ca.id, ca.status, ca.expires_at, c.code as carrier, c.name
FROM carrier_assignments ca
JOIN carriers c ON ca.carrier_id = c.id
WHERE ca.order_id = '<orderId>'
ORDER BY ca.created_at;

-- Pending assignments per carrier
SELECT c.code, COUNT(*) as pending_count
FROM carrier_assignments ca
JOIN carriers c ON ca.carrier_id = c.id
WHERE ca.status = 'pending'
GROUP BY c.code;

-- Orders awaiting assignment
SELECT id, order_number, status, created_at
FROM orders
WHERE status = 'pending_carrier_assignment';
```

---

## Production Notes

- In production, each carrier has their **own external system** — we send HTTP webhook requests to their API endpoint, and they respond with an HMAC-signed callback to our `/api/assignments/:id/accept` (or reject).
- The demo portal **replaces** that round-trip for local testing.
- Never use `DHL-001`, `FEDEX-001`, `UPS-001` style codes — those are from older docs. Current DB uses `BLUEDART`, `DELHIVERY`, `DTDC`, `ECOM`, `SHADOWFAX`.
- The expiry window is **10 minutes** per assignment batch (not 24 hours as in older docs).
- 💰 Order value and items list
- ✅ Accept with driver details
- ⏸️ Mark as "Busy" (temporary rejection)
- ❌ Reject with reason (permanent)
- 🔄 Auto-refresh every 30 seconds
- 🎨 Beautiful gradient UI with animations

---

## 📋 API Endpoints

### Assignment Management
- `POST /api/orders/:orderId/request-carriers` - Trigger assignment for order
- `GET /api/carriers/assignments/pending?carrierId=XXX` - Get pending assignments
- `GET /api/assignments/:id` - Get assignment details
- `POST /api/assignments/:id/accept` - Accept assignment
- `POST /api/assignments/:id/reject` - Reject assignment (permanent)
- `POST /api/assignments/:id/busy` - Mark as busy (temporary)

### Example: Accept Assignment
```bash
curl -X POST http://localhost:3001/api/assignments/abc-123/accept?carrierId=DHL-001 \
  -H "Content-Type: application/json" \
  -d '{
    "driverName": "John Doe",
    "driverPhone": "+1234567890",
    "vehicleInfo": "Truck TN-123",
    "estimatedPickup": "2026-01-30T14:00:00Z"
  }'
```

---

## 🗂️ Database Schema

### carrier_assignments Table
```sql
status: pending | assigned | accepted | rejected | busy | expired | cancelled
expires_at: NOW() + 24 hours
```

### carriers Table
```sql
availability_status: available | busy | offline
last_status_change: TIMESTAMPTZ (tracks when status changed)
```

---

## 🔄 Background Jobs

### Carrier Assignment Retry Job
**Schedule**: Every 30 minutes (`*/30 * * * *`)
**Handler**: `handleCarrierAssignmentRetry`

**Actions**:
1. Process expired assignments → Try next batch
2. Detect newly available carriers → Reset busy assignments to pending
3. Handle all-rejected orders → Try next batch
4. Escalate to manual review after 9 attempts

---

## 🧪 Testing Workflow

### Setup
1. **Start Backend**: `npm run dev` (in backend/)
2. **Create Order**: Use your admin portal → Orders → Create Order
3. **Open Carrier Portal**: Double-click `carrier-simulation/index.html`
4. **Enter Code**: DHL-001 (or any test carrier code)

### Scenario 1: Single Carrier Accepts
### Scenario 1: Single Carrier Accepts
1. Open `carrier-simulation/index.html` in browser
2. Enter carrier code "DHL-001"
3. See pending assignment with countdown timer
4. Click "Accept" → Enter driver details
5. Shipment created, order status changes to "shipped"

### Scenario 2: Multiple Carriers - Race Condition
1. Open 3 browser tabs/windows
2. Tab 1: Login as DHL-001
3. Tab 2: Login as FEDEX-001  
4. Tab 3: Login as UPS-001
5. All 3 see the same assignment
6. First to click "Accept" wins
7. Other 2 tabs: Assignment disappears (auto-cancelled)

### Scenario 3: All Mark "Busy"
1. Open 3 browser tabs with different carrier codes
2. All mark the same order as "Busy"
3. Assignments remain visible for all
4. Wait 30 minutes → Retry job runs
5. When any carrier changes status to "available", assignment resets to pending
6. They can now accept

### Scenario 4: All Reject
1. Open 3 browser tabs
2. All carriers reject (with different reasons)
3. Wait 30 minutes → Retry job runs
4. System finds NEXT batch of 3 carriers
5. New carriers see the assignment
6. Logs show: "Retrying carrier assignment (attempt 2/3)"

---

## 🎨 Frontend Components

### Standalone Carrier Portal
**Location**: `carrier-simulation/index.html`

**Architecture**:
- Pure HTML/CSS/JavaScript (no frameworks)
- Direct API calls to backend
- No authentication required
- Runs independently from main app

**Key Features**:
- Material design with Tailwind-inspired styling
- Real-time countdown timers
- Color-coded urgency (red ≤2h, orange ≤6h, green >6h)
- Three-action buttons: Accept / Busy / Reject
- Modal forms with validation
- Toast-like alerts
- Auto-refresh (30s interval)
- Gradient background with card shadows

**Why Separate?**
In production, carriers have their own portals. This HTML file simulates that environment without mixing it with your authenticated admin portal.

---

## 🔧 Configuration

### Environment Variables
```bash
# Backend
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=scm
DB_USER=your_user
DB_PASSWORD=your_password

# Cron Jobs
CRON_CHECK_INTERVAL=60000 # Check every minute
```

### Carrier Codes (Examples)
```javascript
DHL-001, DHL-002, DHL-003
FEDEX-001, FEDEX-002
UPS-001, UPS-002
BLUEDART-001
DTDC-001
```

---

## 📊 Real-World Example

**Day 1 - 10:00 AM**: Order #ORD-1001 created
- System finds 3 carriers: DHL-001, FEDEX-001, UPS-001
- Sends assignment requests to all 3
- Expiry: 24 hours (tomorrow 10:00 AM)

**Day 1 - 10:15 AM**: DHL-001 marks "Busy"
- Assignment stays available for DHL
- FEDEX and UPS still have pending assignments

**Day 1 - 11:30 AM**: FEDEX-001 rejects (route not serviceable)
- FEDEX assignment marked rejected
- UPS and DHL still available

**Day 1 - 2:00 PM**: DHL changes status to "Available"
- Retry job detects change
- DHL's assignment reset to pending
- DHL can now accept

**Day 1 - 3:45 PM**: UPS-001 accepts!
- Shipment created: #SHP-20260130-001
- DHL and FEDEX assignments auto-cancelled
- Order status → "shipped"

---

## ⚠️ Important Notes

1. **Carrier Status Persistence**: Availability status persists across sessions
2. **Max Retries**: After 9 carriers (3 batches), manual review required
3. **Expiry Window**: 24 hours from initial request
4. **Race Condition**: First to accept wins, others cancelled
5. **Busy vs Reject**: 
   - Busy = "Not now, but maybe later"
   - Reject = "Never for this order"

---

## 🎯 Production Checklist

- [ ] Add OAuth authentication for carrier portal
- [ ] Implement webhook notifications to carrier systems
- [ ] Add email/SMS alerts for pending assignments
- [ ] Set up monitoring for retry job failures
- [ ] Configure rate limiting on API endpoints
- [ ] Add carrier performance metrics
- [ ] Implement audit logging for all actions

---

## 📞 Support

For issues or questions:
- Check backend logs: `backend/logs/`
- Review cron job status: `SELECT * FROM cron_schedules WHERE job_type = 'carrier_assignment_retry'`
- Monitor background jobs: `SELECT * FROM background_jobs WHERE job_type = 'carrier_assignment_retry'`
