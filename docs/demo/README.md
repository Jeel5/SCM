# SCM Demo Portals

> Last updated: 2026-03-18
> All three portals are standalone HTML pages — no build step required.

---

## Overview

The demo folder (`/demo/`) contains three HTML pages that visualize the end-to-end order lifecycle:

| File | Purpose | Who uses it |
|---|---|---|
| `demo/customer.html` | Place orders via webhook | Simulates a retailer's customer checkout |
| `demo/carrier-portal.html` | View & respond to assignment requests | Simulates a carrier partner's dashboard |
| `demo/order-tracking.html` | Track any order by ID or tracking number | Customer / internal ops view |

All three talk directly to the backend API at `http://localhost:3000`.  
No CORS login, no token — the demo routes are open in development (`NODE_ENV !== 'production'`).

---

## Prerequisites

### 1. Start the backend

```bash
cd backend
npm run dev
# Server starts on http://localhost:3000
```

### 2. Open the HTML files in a browser

You can open them directly as `file://` — CORS is configured to allow `null` origin for local files:

```
demo/customer.html
demo/carrier-portal.html
demo/order-tracking.html
```

Or serve them with a static server if you prefer:

```bash
cd demo
python3 -m http.server 8080
# Open http://localhost:8080/customer.html
```

No separate database setup is needed — the schema is in `init.sql` and is applied when Docker creates the `db` container.

---

## Active Carriers in the Database

These carriers are seeded and available today:

| Name | Code | Service Type | Status |
|---|---|---|---|
| BlueDart Express | `BLUEDART` | standard | available |
| Delhivery | `DELHIVERY` | standard | available |
| DTDC Courier | `DTDC` | standard | available |
| Ecom Express | `ECOM` | standard | available |
| Shadowfax | `SHADOWFAX` | standard | available |

The carrier portal loads these dynamically from `GET /api/demo/carriers`.

---

## Active Organizations

| Name | Code | Notes |
|---|---|---|
| Croma | `CROMA` | Has a seeded `webhook_token` for order webhooks |

Get the token for testing:
```sql
SELECT name, webhook_token FROM organizations WHERE code = 'CROMA';
```

---

## Complete End-to-End Flow

```
customer.html                         backend                        carrier-portal.html
     │                                    │                                   │
     │  POST /api/webhooks/:token/orders  │                                   │
     │ ─────────────────────────────────► │                                   │
     │                                    │  INSERT background_jobs            │
     │  { job_id: "..." }                 │  (type='process_order')           │
     │ ◄───────────────────────────────── │                                   │
     │                                    │                                   │
     │                              Job Worker polls every 5s                 │
     │                                    │                                   │
     │                                    │  INSERT orders + order_items      │
     │                                    │  INSERT carrier_assignments (x3)  │
     │                                    │   └─ TOP 3 carriers by score      │
     │                                    │   └─ status = 'pending'           │
     │                                    │   └─ expires in 10 min            │
     │                                    │                                   │
     │                                    │       GET /api/demo/carriers      │
     │                                    │ ◄─────────────────────────────────│
     │                                    │  [BlueDart, Delhivery, DTDC ...]  │
     │                                    │ ─────────────────────────────────►│
     │                                    │                                   │ Carrier selected
     │                                    │  GET /carriers/assignments/pending?carrierId=DELHIVERY
     │                                    │ ◄─────────────────────────────────│
     │                                    │  [{ assignmentId, orderData }]    │
     │                                    │ ─────────────────────────────────►│
     │                                    │                                   │ User clicks Accept
     │                                    │  POST /assignments/:id/accept     │
     │                                    │ ◄─────────────────────────────────│
     │                                    │  INSERT shipments                 │
     │                                    │  UPDATE other assignments → cancelled
     │                                    │ ─────────────────────────────────►│
```

---

## Customer Portal — `customer.html`

### What it does

1. Loads all active organizations from `GET /api/demo/organizations`
2. Shows a product catalogue (hardcoded demo products)
3. On checkout, sends the order to `POST /api/webhooks/:orgToken/orders`
4. Displays the returned `job_id` and full request/response payload

### Webhook payload sent

```json
{
  "event_type": "order.created",
  "source": "croma",
  "data": {
    "external_order_id": "DEMO-1234567890",
    "customer_name": "Test Customer",
    "customer_email": "customer@example.com",
    "customer_phone": "9999999999",
    "shipping_address": {
      "street": "123 Main St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "country": "India"
    },
    "items": [
      { "sku": "IPHONE-15", "name": "iPhone 15", "quantity": 1, "price": 79999 }
    ],
    "payment_method": "prepaid",
    "total_amount": 79999
  }
}
```

The backend also accepts **bare payloads** (no wrapper envelope) — if the body contains `customer_name` or `items` directly, the controller auto-wraps it.

---

## Carrier Portal — `carrier-portal.html`

### What it does

1. On load, calls `GET /api/demo/carriers` → renders one button per carrier
2. Clicking a carrier selects it and calls `GET /api/carriers/assignments/pending?carrierId=<CODE>`
3. Shows the first pending assignment: order details, pickup/delivery address, expiry timer
4. **Accept** → `POST /api/assignments/:id/accept` (HMAC signed)
5. **Reject** → `POST /api/assignments/:id/reject` (HMAC signed)
6. **Status Update** panel → `POST /api/carriers/:code/tracking` with tracking event
7. Polls every 5 seconds — only when a carrier is selected (null guard prevents 404 spam)

### HMAC Authentication

Accept/Reject endpoints require a valid HMAC-SHA256 signature:

```
X-Carrier-Signature: sha256=<hmac_of_body>
X-Carrier-Timestamp: <unix_timestamp_ms>
```

The carrier portal fetches the carrier's `webhook_secret` from `GET /api/demo/carrier-secret/:code`
and uses it to sign the request body before calling accept/reject.

### Assignment lifecycle

```
pending → accepted  (carrier accepts — shipment created)
        → rejected  (carrier rejects — order stays in queue for retry)
        → busy      (carrier busy — stays pending, can accept later)
        → cancelled (another carrier accepted — this one auto-cancelled)
        → expired   (10-min window elapsed — retry scheduled)
```

---

## Order Tracking — `order-tracking.html`

Tracks any shipment by:
- Order ID (UUID)
- External order ID (e.g., `DEMO-123`)
- Tracking number (from carrier)

Calls `GET /api/shipments/:trackingNumber/tracking` or similar endpoint.

---

## Demo API Endpoints (dev only — 404 in production)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/demo/organizations` | All active orgs with webhook tokens |
| `GET` | `/api/demo/carriers` | All active carriers (`is_active=true`) |
| `GET` | `/api/demo/carrier-shipments/:code` | Shipments for a carrier by code |
| `GET` | `/api/demo/carrier-secret/:code` | Carrier's HMAC webhook secret |

All demo routes are guarded by `devOnly` middleware — if `NODE_ENV=production` they return `404`.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "No active carriers found" | `is_active=false` in DB or wrong column in query | Verify carriers table: `SELECT code, is_active FROM carriers` |
| "Invalid webhook token" | Wrong token in URL | Get correct token: `SELECT webhook_token FROM organizations WHERE code='CROMA'` |
| Carrier portal shows "No Pending Requests" | No assignments created yet | Place a new order from customer portal and wait ~5s |
| `carrierId=null` 404 spam in console | `loadCarriers()` failed before poll started | Check `/api/demo/carriers` returns 200; null guard in poller prevents spam |
| Job stays `pending` in DB | Job worker not running | Check server started with `npm run dev`; worker starts automatically |
| Assignment created but carrier not visible | `service_type` mismatch | Carrier assignment queries `service_type='standard'`; ensure order priority maps to this |Order placed → SCM calls ALL carrier APIs → Compares quotes → Selects best carrier → Creates shipment

**Key Points:**
- Calls DHL, FedEx, BlueDart, Delhivery APIs
- Gets real-time pricing
- Uses smart selection algorithm (price + reliability + speed)
- Creates actual shipment with winning carrier

---

## 🎮 Demo Workflow

### Step 1: Customer Portal (`customer.html`)

1. **Select Product** - Choose from laptop, phone, or book
2. **See Phase 1 Estimate** - Instant shipping cost (zone-based calculation)
3. **View Request/Response** - See exact data sent to backend
4. **Place Order** - Simulate payment completion
5. **Phase 2 Triggered** - Real carrier quote requests sent to all carriers

### Step 2: Carrier Portal (`carrier-portal.html`)

1. **Switch Carriers** - Toggle between DHL, FedEx, BlueDart, Delhivery
2. **View Quote Request** - See ALL data sent:
   - Complete shipment details
   - Product information
   - Origin/destination
   - Special requirements
3. **Make Decision**:
   - **Accept**: Set price, delivery days, service type
   - **Reject**: Choose reason, add message
4. **View Response Data** - See exact data sent back to backend

### Step 3: Order Tracking (`order-tracking.html`)

1. **View Timeline**:
   - Phase 1: Quick estimate
   - Phase 2: Quote requests sent
   - Carrier responses received
   - Best carrier selected
2. **See All Data**:
   - Request data to carriers
   - Response data from carriers
   - Selection logic output
3. **Monitor Status** - Real-time updates as carriers respond

## 🔍 Data Visibility

Every page shows **EXACTLY** what data was sent and received:

### Customer Portal
- ✅ Phase 1 request/response
- ✅ Phase 2 order data sent to carriers
- ✅ Order confirmation details

### Carrier Portal
- ✅ Complete incoming request data
- ✅ Shipment details breakdown
- ✅ Internal analysis
- ✅ Response data being sent back

### Order Tracking
- ✅ Timeline of all events
- ✅ Complete Phase 1 data
- ✅ Complete Phase 2 data
- ✅ All carrier responses
- ✅ Selection algorithm output

## 🎬 Recommended Demo Flow

1. **Open all 3 pages** in separate tabs/windows
2. **Start on Customer Portal**:
   - Select a product (auto-calculates estimate)
   - Review Phase 1 data
   - Click "Place Order & Pay Now"
3. **Switch to Carrier Portal**:
   - Select carrier (e.g., DHL)
   - Review complete request data
   - Accept with suggested price or reject
   - Repeat for other carriers (FedEx, BlueDart, etc.)
4. **Check Order Tracking**:
   - See timeline of events
   - View all carrier responses
   - See selected carrier (if any accepted)
   - Review complete data exchange

## 🔧 Features

### Phase 1 (Quick Estimate)
- ⚡ Instant calculation
- 📍 Zone-based distance estimation
- 💰 Conservative price range
- 🚫 No carrier API calls

### Phase 2 (Real Quotes)
- 📨 Requests sent to ALL carriers
- ⏱️ Carriers respond asynchronously
- ✅ Accept/Reject based on constraints
- 🎯 Automatic best carrier selection

### Data Transparency
- 📤 Every request logged
- 📥 Every response logged
- 🔍 JSON format for easy inspection
- 📊 Real-time status updates

## 🎨 UI Features

- **Color-Coded Statuses**:
  - 🟢 Green = Accepted
  - 🔴 Red = Rejected
  - 🟡 Yellow = Pending
  - 🔵 Blue = Selected
- **Responsive Design** - Works on all screen sizes
- **Dark Code Blocks** - Easy to read JSON data
- **Timeline View** - Visual progress tracker

## 💾 Data Storage

Demo uses **localStorage** to persist data across pages:
- `orderData` - Current order details
- `carrierResponses` - All carrier responses
- `currentOrderId` - Active order ID

To **reset** demo: Click "Clear Order & Start New" on tracking page

## 🔌 Backend Endpoints Used

```
POST /api/shipping/estimate          - Phase 1: Quick estimate
POST /api/orders                     - Create order
POST /api/shipping/quotes/real       - Phase 2: Get real quotes
POST /api/carriers/webhook/:carrier  - Carrier response webhook
GET  /api/orders/:id/quote-status    - Poll for responses
```

## 🐛 Troubleshooting

**Backend not responding?**
- Check backend is running on port 3000
- Check CORS is enabled in server.js
- Open browser console for errors

**No carriers showing in portal?**
- Place an order from customer portal first
- Check localStorage has orderData
- Refresh carrier portal page

**Quote status not updating?**
- Auto-refreshes every 3 seconds
- Manually click refresh button
- Check carriers have responded

## 🎓 Educational Value

This demo helps understand:
- **Two-phase quoting** - Why Phase 1 is fast, Phase 2 is accurate
- **Asynchronous processing** - Carriers respond at different times
- **Data contracts** - Exact structure of requests/responses
- **Selection algorithms** - How best carrier is chosen
- **Webhook patterns** - How carrier partners integrate
- **Real-world constraints** - Why carriers reject shipments

## 🔄 Auto-Refresh

- **Customer Portal**: No auto-refresh
- **Carrier Portal**: Checks for orders every 5 seconds
- **Order Tracking**: Updates every 3 seconds

## 📝 Notes

- This is a **simulation** - no real carrier APIs are called
- All carrier responses are manual (from carrier portal)
- Actual production would have real async webhooks
- Demo focuses on **data visibility** not real-time automation

## 🎯 Next Steps

After understanding the demo:
1. Review the actual service code in `backend/services/shipping/`
2. See database schema for quote/rejection tables
3. Implement real carrier API integrations
4. Add authentication for carrier portals
5. Build admin dashboard for monitoring

---

## 🏛️ Architectural Design Choices

### **Platform-Fulfilled Model**

This SCM is built as a **platform-fulfilled logistics engine**, similar to:
- ✅ Croma (platform warehouse)
- ✅ Apple Store (company-owned fulfillment)
- ✅ Flipkart Assured (platform-controlled inventory)

**What this means:**
- Platform owns warehouses and inventory
- Platform controls packaging and quality
- Platform absorbs shipping cost variances
- No vendor management or marketplace complexity
- Pure logistics optimization focus

### **What's NOT Included (By Design)**

❌ **Vendor/Seller Management** - No multi-vendor marketplace logic  
❌ **Vendor Wallets** - No vendor financial accounts  
❌ **Vendor Settlements** - No payment reconciliation  
❌ **Vendor Penalties** - No vendor financial penalties  
❌ **Marketplace Disputes** - No vendor-customer dispute handling  

**Note:** The system does include **carrier SLA penalties** (penalizing carriers for late delivery), which is appropriate for platform-fulfilled logistics.

### **Simplifications for Mini Project**

For this demonstration project:
- ✅ Product weight/dimensions assumed always accurate
- ✅ No warehouse weight variance checking
- ✅ No re-quoting after packaging (Phase 3 not implemented)
- ✅ Platform absorbs any cost differences
- ✅ Focus on core carrier integration & optimization

**Production additions would include:**
- Warehouse weighing and measurement
- Weight variance threshold detection
- Re-quote logic if variance exceeds 15%
- Automatic carrier switching for cost optimization

---

**Enjoy exploring the two-phase shipping quote system! 🚚📦**

