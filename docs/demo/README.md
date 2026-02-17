# SCM Demo - Platform Fulfilled Logistics

## 🎯 Overview

This demo simulates a **platform-fulfilled logistics system** where the platform owns warehouses and controls the entire shipping process. The demo shows the complete **two-phase shipping quote system** with full data visibility.

## 🏗️ Architecture Model

**Platform Fulfilled Model** (like Croma, Apple Store, Flipkart Assured):
- ✅ Platform owns warehouses and inventory
- ✅ Platform controls packaging and quality
- ✅ Platform selects optimal carriers
- ✅ Platform absorbs shipping cost variance (simplified: weight assumed accurate)
- ❌ No vendor management, wallets, or settlements

## 📁 Files

- **index.html** - Demo overview and instructions
- **customer.html** - Customer shopping portal (Phase 1 estimate + Order placement)
- **carrier-portal.html** - Carrier partner portal (receive quotes, accept/reject)
- **order-tracking.html** - Order tracking dashboard (complete data flow timeline)

## 🚀 How to Run

### 0. Setup Database (First Time Only)

The demo requires two additional tables that aren't in the base init.sql. Run this once:

```bash
# Connect to your PostgreSQL database
psql -U your_username -d scm_db -f demo-tables.sql

# Or if using Docker:
docker exec -i scm_postgres psql -U postgres -d scm_db < demo-tables.sql
```

This creates:
- `carrier_quotes` table - stores accepted quotes from carriers
- `carrier_rejections` table - stores carrier rejections with reasons
- Demo carrier records (DHL, FedEx, BlueDart, Delhivery)

### 1. Start Backend Server

```bash
cd backend
npm start
```

Server should be running on `http://localhost:3000`

### 2. Open Demo Pages

Open the HTML files directly in your browser:

```bash
# Option 1: Double-click the files
demo/customer.html
demo/carrier-portal.html  
demo/order-tracking.html

# Option 2: Use a simple HTTP server
cd demo
python3 -m http.server 8080
# Then visit http://localhost:8080/customer.html
```

## 📊 Two-Phase Workflow

### **Phase 1: Quick Estimate (Before Payment)**

Customer enters delivery pincode → SCM calculates zone-based estimate → Customer sees shipping cost at checkout

**Key Points:**
- Uses lightweight zone-based calculation
- No carrier API calls (fast response <50ms)
- Provides rough estimate for checkout
- Customer pays based on this estimate

### **Phase 2: Real Quotes (After Payment)**

Order placed → SCM calls ALL carrier APIs → Compares quotes → Selects best carrier → Creates shipment

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

