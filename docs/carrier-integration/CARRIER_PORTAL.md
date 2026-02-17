# Carrier Portal & Assignment System

## Overview
Intelligent carrier assignment system with automatic retry logic, busy/reject handling, and real-time tracking.

## 🎯 How It Works

### 1. Carrier Assignment Flow
- **Auto Request**: Order created → Find TOP 3 matching carriers by service type
- **Simultaneous Requests**: All 3 carriers receive assignment at once
- **First to Accept Wins**: Race condition - whoever accepts first gets the job
- **Auto-Cancel Others**: Other pending assignments cancelled automatically

### 2. Carrier Response Types
```javascript
Status Options:
- "accepted" → Shipment created, other assignments cancelled
- "rejected" → Permanent rejection (wrong route, can't handle)
- "busy" → Temporary rejection (at capacity, can accept later)
- "expired" → 24h timeout, system tries next batch
```

### 3. Smart Retry Logic (Automatic)
**Background Job runs every 30 minutes:**

**Scenario A: All Carriers Reject**
- System tries NEXT batch of 3 carriers
- Maximum 3 batches (9 carriers total)
- After 9 rejections → Manual review required

**Scenario B: Carriers Mark "Busy"**
- Assignment stays available for them
- When carrier changes status to "available" → Assignment becomes pending again
- They can accept anytime before expiry

**Scenario C: 24h Timeout**
- Pending assignments marked as "expired"
- System tries next batch of 3 carriers
- Original carriers notified of timeout

### 4. Carrier Portal (Standalone HTML)
**Location**: `carrier-simulation/index.html`
**Type**: Standalone HTML file (simulates carrier's portal)

**How to Use**:
1. Open `carrier-simulation/index.html` in any browser
2. Enter carrier code: DHL-001, FEDEX-001, UPS-001, etc.
3. No authentication needed (simulation only)

**Why Standalone?**
- In production, each carrier (DHL/FedEx/UPS) has their own portal
- They receive API requests on their endpoints
- They process in their own systems
- They send webhooks back to you
- This HTML file **simulates** their portal for testing

**Features**:
- 📦 View all pending assignments
- ⏰ See expiry countdown (hours remaining)
- 📍 Pickup and delivery addresses
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
