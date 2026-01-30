# Supply Chain Management (SCM) System - Complete Flow & Architecture

## 1. WHO USES THIS SOFTWARE?

### Primary Customer: **E-Commerce Companies / Online Retailers**
Examples: Amazon, Flipkart, Myntra, any company that sells products online and needs to deliver them to customers.

### System Users (Different Roles):

#### A. **Admin/Operations Team** (Your Customer - "Ben Company")
- **Portal**: Main React Frontend (localhost:5173)
- **Access**: Full system - sees everything
- **Responsibilities**:
  - Receive orders from their online platform (website/app)
  - Manage inventory across warehouses
  - Assign orders to carrier partners
  - Monitor shipments, returns, exceptions
  - Handle finances and SLA tracking
  - Master Data Management (add warehouses, carriers, products)

#### B. **Carrier Partners** (DHL, FedEx, Blue Dart, etc.)
- **Portal**: carrier-portal.html (standalone HTML page)
- **Access**: Only see orders assigned to them
- **Responsibilities**:
  - Receive assignment notifications for new orders
  - Accept or reject assignments
  - Pick up orders from warehouses
  - Deliver to customers
  - Update delivery status
  - Handle failed deliveries

#### C. **Warehouse Staff** (Ben Company's warehouse employees)
- **Portal**: (To be built - not yet in system)
- **Access**: See orders assigned to their warehouse
- **Responsibilities**:
  - Check inventory
  - Pack orders
  - Hand over to carriers
  - Receive returns
  - Update stock levels

#### D. **End Customers** (People who buy from Ben Company)
- **Portal**: Ben Company's website/app (external - not part of this SCM)
- **Interaction**: Place orders, track shipments, initiate returns
- **NOTE**: They don't directly access this SCM system - they use Ben Company's customer-facing app

---

## 2. THE COMPLETE ORDER FLOW

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 1: ORDER CREATION                            │
└─────────────────────────────────────────────────────────────────────┘

Customer (Rahul) → Ben Company Website → Places Order
                                          ↓
                                    Order Details:
                                    - Product: iPhone 15
                                    - Quantity: 1
                                    - Ship To: Mumbai, MH 400001
                                    - Amount: ₹79,999
                                          ↓
                                 SCM System (Orders Table)
                                    Status: "pending"


┌─────────────────────────────────────────────────────────────────────┐
│                STEP 2: INVENTORY CHECK & ALLOCATION                  │
└─────────────────────────────────────────────────────────────────────┘

SCM System checks:
  - Which warehouse has iPhone 15 in stock?
  - Which warehouse is closest to Mumbai?
  
  Result: Delhi Warehouse has stock
          ↓
  Order assigned to: Delhi Warehouse
  Warehouse staff notified: "Pack this order"
  Stock reduced: iPhone 15 count decreases by 1


┌─────────────────────────────────────────────────────────────────────┐
│                STEP 3: CARRIER ASSIGNMENT (CURRENT FOCUS)            │
└─────────────────────────────────────────────────────────────────────┘

SCM System logic:
  1. Find suitable carriers for "Express" delivery to Mumbai
  2. Check carrier availability, reliability score, past performance
  3. Create assignments for top 3 carriers:
     - DHL-001: Priority 1
     - FEDEX-001: Priority 2
     - BLUEDART-001: Priority 3
  
  carrier_assignments table:
  ┌─────┬──────────┬────────────┬──────────┬────────────────────────────┐
  │ ID  │ Order ID │ Carrier    │ Status   │ Assignment Details         │
  ├─────┼──────────┼────────────┼──────────┼────────────────────────────┤
  │ 1   │ ORD-123  │ DHL-001    │ pending  │ Pickup: Delhi Warehouse    │
  │     │          │            │          │ Deliver: Mumbai 400001     │
  │     │          │            │          │ Package: iPhone 15 (1kg)   │
  │     │          │            │          │ Expires: 2 hours           │
  └─────┴──────────┴────────────┴──────────┴────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│              STEP 4: CARRIER ACCEPTS ASSIGNMENT                      │
└─────────────────────────────────────────────────────────────────────┘

DHL-001 logs into carrier-portal.html:
  - Sees: "1 Pending Assignment"
  - Details shown:
    ✓ Order Number: ORD-123
    ✓ Customer: Rahul Kumar
    ✓ Pickup Location: Delhi Warehouse, Sector 18, Noida
    ✓ Delivery Location: Rahul Kumar, 123 Marine Drive, Mumbai 400001
    ✓ Package Details: iPhone 15, 1kg, ₹79,999
    ✓ Service Type: Express (24-hour delivery)
    ✓ Pickup Time: Before 6 PM today
  
  DHL clicks "Accept" button
          ↓
  carrier_assignments table updated:
    Status: "pending" → "accepted"
    responded_at: NOW()
    carrier_reference_id: DHL-SHIP-987654
  
  Other carriers (FEDEX, BLUEDART) assignments cancelled automatically


┌─────────────────────────────────────────────────────────────────────┐
│                STEP 5: SHIPMENT CREATION                             │
└─────────────────────────────────────────────────────────────────────┘

When DHL accepts:
  SCM creates shipment record:
  
  shipments table:
  ┌──────────────┬──────────┬────────────┬─────────────┬──────────────┐
  │ Tracking No. │ Order ID │ Carrier    │ Status      │ Current Loc  │
  ├──────────────┼──────────┼────────────┼─────────────┼──────────────┤
  │ DHL987654    │ ORD-123  │ DHL-001    │ pending_    │ Delhi WH     │
  │              │          │            │ pickup      │              │
  └──────────────┴──────────┴────────────┴─────────────┴──────────────┘
  
  Order status: "pending" → "assigned_to_carrier"


┌─────────────────────────────────────────────────────────────────────┐
│                  STEP 6: PHYSICAL PICKUP                             │
└─────────────────────────────────────────────────────────────────────┘

DHL driver arrives at Delhi Warehouse:
  - Shows carrier_reference_id: DHL-SHIP-987654
  - Warehouse staff scans: Order ORD-123
  - Hands over package to DHL driver
  - DHL updates status in their system
  - DHL calls SCM API: POST /api/shipments/DHL987654/status
    Body: { status: "picked_up", location: "Delhi Warehouse" }
  
  Shipment status: "pending_pickup" → "in_transit"
  Order status: "assigned_to_carrier" → "shipped"


┌─────────────────────────────────────────────────────────────────────┐
│                STEP 7: IN-TRANSIT UPDATES                            │
└─────────────────────────────────────────────────────────────────────┘

DHL provides real-time updates:
  - Departed Delhi: 8:00 PM
  - Arrived Mumbai Hub: 6:00 AM next day
  - Out for Delivery: 10:00 AM
  
  Each update calls: POST /api/shipments/DHL987654/status
  
  Customer Rahul can track on Ben Company website
  Ben Company admin can see live status in dashboard


┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 8: DELIVERY                                  │
└─────────────────────────────────────────────────────────────────────┘

DHL driver delivers to Rahul at Mumbai:
  - Rahul signs delivery proof
  - DHL updates: POST /api/shipments/DHL987654/status
    Body: { 
      status: "delivered", 
      delivered_at: "2026-01-31 14:30",
      proof_of_delivery: "signature_image.jpg"
    }
  
  Shipment status: "in_transit" → "delivered"
  Order status: "shipped" → "delivered"
  
  DHL's reliability_score increases (successful delivery)
  Payment due to DHL calculated and recorded in finances


┌─────────────────────────────────────────────────────────────────────┐
│              ALTERNATE FLOW: FAILED DELIVERY                         │
└─────────────────────────────────────────────────────────────────────┘

If Rahul not at home:
  DHL updates: POST /api/shipments/DHL987654/status
    Body: { 
      status: "delivery_failed", 
      reason: "Customer not available"
    }
  
  Shipment status: "in_transit" → "delivery_attempted"
  
  Exception created:
  exceptions table:
  ┌──────┬──────────┬───────────┬─────────────────────────┬──────────┐
  │ ID   │ Order ID │ Type      │ Description             │ Status   │
  ├──────┼──────────┼───────────┼─────────────────────────┼──────────┤
  │ 1    │ ORD-123  │ delivery_ │ Customer not available  │ open     │
  │      │          │ failed    │ at delivery address     │          │
  └──────┴──────────┴───────────┴─────────────────────────┴──────────┘
  
  Ben Company operations team:
    - Sees alert: "Delivery Failed"
    - Contacts customer
    - Reschedules delivery
    - Or initiates return


┌─────────────────────────────────────────────────────────────────────┐
│                    RETURN FLOW                                       │
└─────────────────────────────────────────────────────────────────────┘

If Rahul wants to return iPhone (damaged, wrong item, etc.):
  
  1. Rahul requests return on Ben Company website
  2. SCM creates return record:
     returns table:
     ┌──────┬──────────┬─────────┬────────────┬─────────────────┐
     │ ID   │ Order ID │ Reason  │ Status     │ Pickup Address  │
     ├──────┼──────────┼─────────┼────────────┼─────────────────┤
     │ 1    │ ORD-123  │ Damaged │ requested  │ Mumbai 400001   │
     └──────┴──────────┴─────────┴────────────┴─────────────────┘
  
  3. SCM assigns return pickup to same/different carrier
  4. Carrier picks up from customer (reverse logistics)
  5. Delivers back to warehouse
  6. Warehouse inspects product
  7. If acceptable: Refund processed
  8. Stock added back to inventory
```

---

## 3. WHAT'S IN THE CARRIER PORTAL (carrier-portal.html)?

### When DHL-001 logs in, they should see:

```javascript
╔═══════════════════════════════════════════════════════════════════╗
║                    DHL-001 CARRIER PORTAL                         ║
╚═══════════════════════════════════════════════════════════════════╝

📦 PENDING ASSIGNMENTS (2)

┌────────────────────────────────────────────────────────────────────┐
│ Assignment #1                                    Expires in: 1h 45m │
├────────────────────────────────────────────────────────────────────┤
│ Order Number: ORD-12345                                            │
│ Service Type: Express (24-hour delivery)                           │
│                                                                     │
│ 📍 PICKUP:                                                          │
│    Delhi Warehouse                                                 │
│    Sector 18, Noida, UP 201301                                     │
│    Contact: +91-9876543210                                         │
│    Pickup Window: Today 2 PM - 6 PM                                │
│                                                                     │
│ 📍 DELIVER TO:                                                      │
│    Rahul Kumar                                                     │
│    123 Marine Drive, Mumbai, MH 400001                             │
│    Contact: +91-9123456789                                         │
│    Deliver By: Tomorrow 6 PM                                       │
│                                                                     │
│ 📦 PACKAGE DETAILS:                                                 │
│    Product: iPhone 15 Pro (Electronics)                            │
│    Weight: 1.5 kg                                                  │
│    Dimensions: 20cm x 15cm x 8cm                                   │
│    Value: ₹79,999                                                  │
│    Fragile: Yes | Insured: Yes                                     │
│                                                                     │
│ 💰 PAYMENT:                                                         │
│    Delivery Charge: ₹250                                           │
│    Payment Type: Prepaid (already paid by customer)                │
│                                                                     │
│ [✅ Accept]  [❌ Reject]  [⏸️ Mark as Busy]                         │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ Assignment #2                                    Expires in: 0h 30m │
├────────────────────────────────────────────────────────────────────┤
│ Order Number: ORD-12346                                            │
│ Service Type: Standard (3-day delivery)                            │
│                                                                     │
│ 📍 PICKUP:                                                          │
│    Mumbai Warehouse                                                │
│    Andheri East, Mumbai, MH 400069                                 │
│    ...                                                             │
└────────────────────────────────────────────────────────────────────┘
```

### This data comes from:

```sql
-- Query executed when carrier portal loads
SELECT 
  ca.id,
  ca.order_id,
  ca.service_type,
  ca.status,
  ca.requested_at,
  ca.expires_at,
  o.order_number,
  o.customer_name,
  o.customer_email,
  o.customer_phone,
  o.total_amount,
  o.shipping_address,  -- This is JSONB containing full address
  ca.request_payload   -- This is JSONB containing:
                       --   - pickup_address (warehouse location)
                       --   - delivery_address (customer location)
                       --   - package_details (weight, dimensions, product)
                       --   - special_instructions
                       --   - payment_info
FROM carrier_assignments ca
JOIN orders o ON ca.order_id = o.id
WHERE ca.carrier_id = 'DHL-001'
  AND ca.status = 'pending'
  AND ca.expires_at > NOW()
ORDER BY ca.requested_at DESC;
```

---

## 4. WHAT'S MISSING IN YOUR CURRENT SYSTEM?

### ❌ **Problem**: carrier_assignments table exists but has NO data

**Why?**
1. You created 4 orders manually in the database
2. But carrier_assignments table is empty
3. The assignment logic was added AFTER orders were created
4. So those orders never got assigned to any carriers

**Fix**: Need to either:
- Create assignments for existing orders (run SQL script)
- Or create new orders through the admin UI (which will auto-assign carriers)

### ❌ **Problem**: request_payload is empty

When assignments are created, the `request_payload` JSONB field should contain:

```json
{
  "pickup_address": {
    "warehouse_name": "Delhi Warehouse",
    "address_line1": "Plot 123, Sector 18",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "postal_code": "201301",
    "contact_person": "Warehouse Manager",
    "contact_phone": "+91-9876543210",
    "pickup_window": "2 PM - 6 PM"
  },
  "delivery_address": {
    "customer_name": "Rahul Kumar",
    "address_line1": "123 Marine Drive",
    "address_line2": "Near Gateway of India",
    "city": "Mumbai",
    "state": "Maharashtra",
    "postal_code": "400001",
    "contact_phone": "+91-9123456789",
    "delivery_instructions": "Ring bell twice"
  },
  "package_details": {
    "products": [
      {
        "name": "iPhone 15 Pro",
        "sku": "IPHONE-15-PRO-256",
        "quantity": 1,
        "weight_kg": 0.5,
        "category": "Electronics"
      }
    ],
    "total_weight_kg": 1.5,
    "dimensions_cm": { "length": 20, "width": 15, "height": 8 },
    "declared_value": 79999,
    "is_fragile": true,
    "is_insured": true
  },
  "service_requirements": {
    "service_type": "express",
    "expected_pickup_date": "2026-01-31",
    "expected_delivery_date": "2026-02-01",
    "delivery_attempts": 3,
    "signature_required": true
  },
  "payment_info": {
    "payment_mode": "prepaid",
    "carrier_charges": 250,
    "cod_amount": 0
  }
}
```

This is what the carrier needs to see to do their job!

---

## 5. BUSINESS MODEL: WHO PAYS WHOM?

```
┌──────────────────┐      Orders Product      ┌──────────────────┐
│  End Customer    │─────────────────────────→│  Ben Company     │
│  (Rahul)         │←─────────────────────────│  (Your Client)   │
└──────────────────┘   Receives Product       └──────────────────┘
         │                                              │
         │ Pays ₹79,999                                │
         │ (Product + Shipping)                        │
         └──────────────────────────────────────────────┘
                                                        │
                    ┌───────────────────────────────────┤
                    │                                   │
                    ↓                                   ↓
         ┌──────────────────┐                ┌──────────────────┐
         │  Carrier (DHL)   │                │  Ben Company     │
         │  Delivers        │                │  Pays Carrier    │
         │  Package         │                │  ₹250 delivery   │
         └──────────────────┘                └──────────────────┘
                    ↑
                    │ Uses SCM System to
                    │ receive assignments
                    └───────────────────────────────────┐
                                                        │
                                              ┌──────────────────┐
                                              │  This SCM        │
                                              │  Software        │
                                              │  (Manages all)   │
                                              └──────────────────┘
```

**Revenue Model:**
- Ben Company pays YOU (SCM provider) a monthly/annual subscription
- Or per-transaction fee
- Carrier partners are Ben Company's partners, not yours
- You just provide the platform to manage everything

---

## 6. CURRENT STATE vs EXPECTED STATE

### Current State ❌
```
Orders Table: ✅ Has 4 orders
Carriers Table: ✅ Has DHL-001
Carrier_Assignments Table: ❌ EMPTY (root cause!)
Shipments Table: ❌ Empty (no shipments created yet)

Carrier Portal: Shows "0 assignments" because table is empty
```

### Expected State ✅
```
Orders Table: ✅ Has 4 orders (ORD-001, ORD-002, ORD-003, ORD-004)
Carriers Table: ✅ Has 8 carriers (DHL-001, FEDEX-001, etc.)
Carrier_Assignments Table: ✅ Has 12 assignments (3 per order)
  - Each order assigned to top 3 carriers
  - Status: "pending" (waiting for carrier acceptance)
  - request_payload: Full pickup/delivery details

Carrier Portal (DHL-001): Shows "4 pending assignments"
  - Full order details visible
  - Pickup address (warehouse)
  - Delivery address (customer)
  - Package details
  - Can accept/reject
```

---

## 7. WHAT NEEDS TO BE DONE NOW?

### Step 1: Populate carrier_assignments table
```sql
-- For each existing order, create assignments with proper data
INSERT INTO carrier_assignments (
  order_id, 
  carrier_id, 
  service_type, 
  status,
  request_payload,  -- THIS IS THE KEY!
  expires_at
) 
SELECT 
  o.id,
  c.id,
  'express',
  'pending',
  jsonb_build_object(
    'pickup_address', jsonb_build_object(
      'warehouse_name', 'Delhi Main Warehouse',
      'address_line1', 'Sector 18, Noida',
      'city', 'Noida',
      'state', 'UP',
      'postal_code', '201301',
      'contact_phone', '+91-9876543210'
    ),
    'delivery_address', o.shipping_address,  -- Already JSONB in orders table
    'package_details', jsonb_build_object(
      'products', (o.items),  -- From orders.items JSONB
      'total_weight_kg', 2.0,
      'declared_value', o.total_amount
    )
  ),
  NOW() + INTERVAL '24 hours'
FROM orders o
CROSS JOIN carriers c
WHERE o.status IN ('pending', 'confirmed')
  AND c.is_active = true
  AND c.code IN ('DHL-001', 'FEDEX-001', 'BLUEDART-001')
LIMIT 3;  -- Top 3 carriers per order
```

### Step 2: Fix carrier portal to display all fields
The portal needs to parse `request_payload` and show:
- Pickup address (warehouse details)
- Delivery address (customer details)  
- Package details (weight, dimensions, products)

### Step 3: Test the flow
1. Open carrier-portal.html
2. Should see pending assignments with FULL details
3. Click "Accept" on one
4. Should create shipment
5. Order status should update

---

## 8. SUMMARY

**What is SCM?**
A platform for e-commerce companies to manage their entire supply chain:
- Orders from customers
- Inventory in warehouses
- Carrier partnerships
- Shipments & deliveries
- Returns & refunds
- Finances & SLAs

**Who uses it?**
- Admin: E-commerce company operations team
- Carriers: DHL, FedEx (delivery partners)
- Warehouse: Packing & inventory staff
- (Customers use the e-commerce company's app, not SCM directly)

**The Flow:**
Customer orders → Inventory checked → Carrier assigned → Carrier accepts → Package picked up → In transit → Delivered → Payment settled

**Current Issue:**
carrier_assignments table is empty, so carriers see no assignments. Need to populate it with proper order details.
