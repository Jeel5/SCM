# Croma Uses Your SCM - Complete Example Flow

## 🏢 Setup

**Customer:** Croma (pays you ₹2,00,000/month for SCM software)

**Infrastructure:**
- 10 warehouses across India (Mumbai, Delhi, Bangalore, Hyderabad, Chennai, etc.)
- Products: TVs, Laptops, Mobiles, ACs, Washing Machines, etc.
- E-commerce site: croma.com
- Carrier partners: DHL, FedEx, Blue Dart, Delhivery, DTDC, Xpressbees

---

## 📱 FLOW 1: Customer Orders Samsung Mobile

### **Step 1: Customer Places Order**

```
Customer: Rahul Sharma (Mumbai)
Action: Visits croma.com
Product: Samsung Galaxy S24
Price: ₹79,999
Payment: Online via Razorpay
Order Created: #CROMA-12345
```

**What happens:**
- Croma's website processes payment
- Croma's website sends order to YOUR SCM via webhook

```javascript
POST https://yourscm.com/api/webhooks/croma/orders
{
  "order_id": "CROMA-12345",
  "customer": {
    "name": "Rahul Sharma",
    "phone": "+91-9876543210",
    "email": "rahul@example.com"
  },
  "product": {
    "name": "Samsung Galaxy S24",
    "sku": "SAM-S24-256-BLK",
    "quantity": 1,
    "price": 79999
  },
  "delivery_address": {
    "line1": "Flat 201, Sunshine Apartments",
    "line2": "Andheri East",
    "city": "Mumbai",
    "state": "Maharashtra",
    "postal_code": "400069"
  },
  "payment_status": "paid"
}
```

---

### **Step 2: Your SCM Receives Order**

**Your SCM Backend:**
- Receives webhook
- Creates order in database
- Status: "pending"
- Shows on Croma's dashboard: "New Order #CROMA-12345"

```sql
INSERT INTO orders (
  order_number,
  customer_name,
  customer_phone,
  shipping_address,
  total_amount,
  status
) VALUES (
  'CROMA-12345',
  'Rahul Sharma',
  '+91-9876543210',
  '{"line1": "Flat 201...", "city": "Mumbai", ...}',
  79999,
  'pending'
);
```

---

### **Step 3: Your SCM Checks Inventory**

**Your SCM queries Croma's warehouses:**

```sql
SELECT w.name, w.city, i.quantity 
FROM inventory i
JOIN warehouses w ON i.warehouse_id = w.id
WHERE i.sku = 'SAM-S24-256-BLK'
  AND i.quantity > 0;
```

**Results:**
| Warehouse | City | Stock | Distance to Mumbai |
|-----------|------|-------|-------------------|
| Mumbai Warehouse | Mumbai | 5 units ✅ | 0 km (same city) |
| Bangalore Warehouse | Bangalore | 3 units | 980 km |
| Delhi Warehouse | Delhi | 0 units ❌ | 1,400 km |

**Decision Logic:**
- Mumbai warehouse has stock ✅
- Mumbai warehouse is closest to customer ✅
- **Assign order to Mumbai Warehouse**

```sql
UPDATE orders 
SET warehouse_id = 'mumbai-wh-001',
    status = 'warehouse_assigned'
WHERE order_number = 'CROMA-12345';
```

**Your SCM notifies Mumbai warehouse:**
- Email sent to: mumbai-warehouse@croma.com
- Message: "Order #CROMA-12345 assigned to you. Pack Samsung S24 for Rahul Sharma."

---

### **Step 4: Your SCM Assigns Carrier**

**Your SCM finds suitable carriers:**

```sql
SELECT c.name, c.code, cs.base_rate, cs.delivery_time
FROM carriers c
JOIN carrier_services cs ON c.id = cs.carrier_id
WHERE cs.service_type = 'express'
  AND cs.from_city = 'Mumbai'
  AND cs.to_city = 'Mumbai'
  AND c.is_active = true
ORDER BY cs.base_rate ASC;
```

**Results:**
| Carrier | Cost | Delivery Time | Reliability |
|---------|------|---------------|-------------|
| Delhivery | ₹120 | 72 hours | 85% |
| Blue Dart | ₹130 | 48 hours | 92% ✅ |
| DHL | ₹150 | 24 hours | 95% |

**Decision Logic:**
- Blue Dart: Best price-speed-reliability ratio
- **Assign order to Blue Dart**

**Your SCM creates carrier assignment:**

```sql
INSERT INTO carrier_assignments (
  order_id,
  carrier_id,
  service_type,
  status,
  request_payload,
  expires_at
) VALUES (
  'CROMA-12345-order-id',
  'blue-dart-carrier-id',
  'express',
  'pending',
  '{
    "pickup_address": {
      "warehouse_name": "Croma Mumbai Warehouse",
      "address_line1": "MIDC, Andheri East",
      "city": "Mumbai",
      "postal_code": "400093",
      "contact_person": "Warehouse Manager",
      "contact_phone": "+91-9900112233"
    },
    "delivery_address": {
      "customer_name": "Rahul Sharma",
      "address_line1": "Flat 201, Sunshine Apartments",
      "address_line2": "Andheri East",
      "city": "Mumbai",
      "postal_code": "400069",
      "contact_phone": "+91-9876543210"
    },
    "package_details": {
      "products": [{
        "name": "Samsung Galaxy S24",
        "quantity": 1,
        "weight_kg": 0.5
      }],
      "total_weight_kg": 1.5,
      "dimensions_cm": {"length": 20, "width": 15, "height": 8},
      "declared_value": 79999,
      "is_fragile": true
    }
  }',
  NOW() + INTERVAL '2 hours'
);
```

**Your SCM sends assignment to Blue Dart:**

```javascript
// Option 1: API Integration (if Blue Dart has API)
POST https://api.bluedart.com/v1/shipments
Authorization: Bearer blue-dart-api-key
{
  "pickup_address": { ... },
  "delivery_address": { ... },
  "package": { ... },
  "service_type": "express",
  "cod_amount": 0
}

// Option 2: Email (if no API)
Email to: operations@bluedart.com
Subject: New Pickup Request - Croma Order #CROMA-12345
Body: "Please pick up from Mumbai Warehouse..."
```

---

### **Step 5: Blue Dart Accepts & Picks Up**

**Blue Dart Operations:**
1. Receives assignment notification
2. Logs into Blue Dart's system (or YOUR carrier portal)
3. Reviews assignment details
4. Clicks "Accept"

**Your SCM receives acceptance:**

```javascript
// Blue Dart calls your API
POST https://yourscm.com/api/carriers/assignments/123/accept
{
  "carrier_reference_id": "BD-SHIP-987654",
  "estimated_pickup_time": "2026-01-31 18:00",
  "driver_name": "Amit Kumar",
  "driver_phone": "+91-9988776655"
}
```

**Your SCM updates database:**

```sql
UPDATE carrier_assignments
SET status = 'accepted',
    carrier_reference_id = 'BD-SHIP-987654',
    responded_at = NOW()
WHERE id = 123;

UPDATE orders
SET status = 'assigned_to_carrier',
    carrier_tracking_number = 'BD-SHIP-987654'
WHERE order_number = 'CROMA-12345';
```

**Blue Dart driver arrives at warehouse:**
- Time: 6:00 PM same day
- Driver shows QR code: BD-SHIP-987654
- Warehouse staff scans, hands over package
- Driver gets signature from warehouse staff

**Blue Dart confirms pickup:**

```javascript
POST https://yourscm.com/api/shipments/BD-SHIP-987654/status
{
  "status": "picked_up",
  "location": "Croma Mumbai Warehouse",
  "timestamp": "2026-01-31 18:15",
  "proof_of_pickup": "signature_image.jpg"
}
```

---

### **Step 6: Shipment Creation**

**Your SCM creates shipment record:**

```sql
INSERT INTO shipments (
  tracking_number,
  order_id,
  carrier_id,
  status,
  current_location,
  estimated_delivery,
  created_at
) VALUES (
  'BD-SHIP-987654',
  'CROMA-12345-order-id',
  'blue-dart-carrier-id',
  'in_transit',
  'Mumbai Warehouse',
  '2026-02-02 18:00',
  NOW()
);
```

**Your SCM updates order:**

```sql
UPDATE orders
SET status = 'shipped',
    shipped_at = NOW()
WHERE order_number = 'CROMA-12345';
```

**Your SCM notifies customer:**
- SMS: "Your Croma order #CROMA-12345 has been shipped! Track: BD-SHIP-987654"
- Email: Full tracking details with link
- Croma's website: Shows "Shipped" status

---

### **Step 7: In-Transit Updates**

**Blue Dart provides real-time updates:**

**Update 1: Departed from warehouse**
```javascript
POST https://yourscm.com/api/shipments/BD-SHIP-987654/status
{
  "status": "in_transit",
  "location": "Blue Dart Mumbai Hub",
  "timestamp": "2026-01-31 20:00",
  "next_location": "Andheri Sorting Center"
}
```

**Update 2: Arrived at sorting center**
```javascript
POST https://yourscm.com/api/shipments/BD-SHIP-987654/status
{
  "status": "in_transit",
  "location": "Andheri Sorting Center",
  "timestamp": "2026-02-01 08:00",
  "next_location": "Out for Delivery"
}
```

**Update 3: Out for delivery**
```javascript
POST https://yourscm.com/api/shipments/BD-SHIP-987654/status
{
  "status": "out_for_delivery",
  "location": "Andheri East",
  "timestamp": "2026-02-01 10:00",
  "driver_name": "Amit Kumar",
  "driver_phone": "+91-9988776655",
  "estimated_delivery_time": "2026-02-01 14:00"
}
```

**What YOUR SCM does:**
- Stores each status update in database
- Shows live tracking on Croma's dashboard
- Sends SMS to Rahul: "Your order is out for delivery"
- Shows map with current location (if Blue Dart provides GPS)

---

### **Step 8: Delivery**

**Blue Dart driver delivers:**
- Time: 2:30 PM
- Rahul signs on driver's device
- Driver takes photo of delivered package
- Driver marks "Delivered" in Blue Dart app

**Blue Dart confirms delivery:**

```javascript
POST https://yourscm.com/api/shipments/BD-SHIP-987654/status
{
  "status": "delivered",
  "location": "Flat 201, Andheri East",
  "timestamp": "2026-02-01 14:30",
  "delivered_to": "Rahul Sharma",
  "proof_of_delivery": "photo_url.jpg",
  "signature": "signature_image.jpg"
}
```

**Your SCM updates everything:**

```sql
-- Update shipment
UPDATE shipments
SET status = 'delivered',
    delivered_at = '2026-02-01 14:30',
    proof_of_delivery = 'photo_url.jpg'
WHERE tracking_number = 'BD-SHIP-987654';

-- Update order
UPDATE orders
SET status = 'delivered',
    delivered_at = '2026-02-01 14:30'
WHERE order_number = 'CROMA-12345';

-- Update inventory (reduce stock)
UPDATE inventory
SET quantity = quantity - 1
WHERE warehouse_id = 'mumbai-wh-001'
  AND sku = 'SAM-S24-256-BLK';
-- Result: Mumbai warehouse now has 4 Samsung S24 phones

-- Update carrier reliability score
UPDATE carriers
SET reliability_score = reliability_score + 1,
    total_deliveries = total_deliveries + 1,
    successful_deliveries = successful_deliveries + 1
WHERE code = 'BLUE-DART-001';
```

**Your SCM notifies everyone:**
- SMS to Rahul: "Your Croma order has been delivered!"
- Email to Rahul: "Thank you for shopping with Croma"
- Croma dashboard: Shows "Delivered" status
- Croma operations team: Gets daily report

---

### **Step 9: Billing & Finance**

**Your SCM records transaction:**

```sql
INSERT INTO finance_transactions (
  order_id,
  transaction_type,
  amount,
  party,
  status,
  created_at
) VALUES 
(
  'CROMA-12345-order-id',
  'shipping_charge',
  130,
  'Blue Dart',
  'payable',
  NOW()
);
```

**End of month:**
- Your SCM generates invoice: "Croma owes Blue Dart ₹130 for order #CROMA-12345"
- Blue Dart sends invoice to Croma: ₹130
- Croma pays Blue Dart via bank transfer (outside your system)
- Croma marks transaction as "Paid" in your SCM

---

## 📦 FLOW 2: Samsung Stock Gets Low

### **Step 1: Your SCM Detects Low Stock**

**Your SCM runs cron job every hour:**

```sql
-- Check inventory levels
SELECT 
  i.sku,
  p.name,
  w.name as warehouse,
  i.quantity,
  i.reorder_threshold,
  COUNT(o.id) as pending_orders
FROM inventory i
JOIN products p ON i.product_id = p.id
JOIN warehouses w ON i.warehouse_id = w.id
LEFT JOIN orders o ON o.product_sku = i.sku 
  AND o.warehouse_id = i.warehouse_id
  AND o.status IN ('pending', 'warehouse_assigned')
WHERE i.quantity <= i.reorder_threshold
GROUP BY i.id;
```

**Results:**
| SKU | Product | Warehouse | Stock | Threshold | Pending Orders |
|-----|---------|-----------|-------|-----------|----------------|
| SAM-S24-256-BLK | Samsung S24 | Mumbai | 2 | 5 | 8 |

**Alert calculation:**
- Current stock: 2 units
- Pending orders: 8 orders
- **Problem: Will run out in 1 day!** ⚠️

---

### **Step 2: Your SCM Auto-Creates Purchase Order**

**Your SCM automatically generates PO:**

```sql
INSERT INTO purchase_orders (
  po_number,
  supplier_id,
  warehouse_id,
  status,
  total_amount,
  created_at,
  required_by
) VALUES (
  'PO-2026-001234',
  'samsung-india-supplier-id',
  'mumbai-wh-001',
  'draft',
  3500000,  -- 50 units × ₹70,000 wholesale
  NOW(),
  NOW() + INTERVAL '3 days'
);

INSERT INTO purchase_order_items (
  po_id,
  product_id,
  sku,
  quantity,
  unit_price,
  line_total
) VALUES (
  'PO-2026-001234',
  'samsung-s24-product-id',
  'SAM-S24-256-BLK',
  50,
  70000,
  3500000
);
```

---

### **Step 3: Alert to Croma**

**Your SCM shows on Croma's dashboard:**

```
╔═══════════════════════════════════════════════════════════╗
║  ⚠️  LOW STOCK ALERT                                      ║
╚═══════════════════════════════════════════════════════════╝

Product: Samsung Galaxy S24 (SAM-S24-256-BLK)
Warehouse: Mumbai Warehouse
Current Stock: 2 units
Pending Orders: 8 orders
Reorder Threshold: 5 units

📝 Auto-Generated Purchase Order:
   PO Number: PO-2026-001234
   Supplier: Samsung India
   Quantity: 50 units
   Amount: ₹35,00,000
   Delivery To: Mumbai Warehouse
   Required By: 2026-02-03

[Approve PO] [Edit PO] [Ignore Alert]
```

**Croma manager actions:**
1. Reviews PO details
2. Checks if 50 units is correct quantity
3. Clicks "Approve PO"

---

### **Step 4: PO Sent to Samsung**

**Your SCM sends PO to Samsung India:**

**Option 1: Email**
```
To: orders@samsung.co.in
Subject: Purchase Order PO-2026-001234 from Croma

Dear Samsung India Team,

Please find attached Purchase Order PO-2026-001234

Product: Samsung Galaxy S24 (Black, 256GB)
Quantity: 50 units
Unit Price: ₹70,000
Total: ₹35,00,000

Delivery Address:
Croma Mumbai Warehouse
MIDC, Andheri East, Mumbai 400093
Contact: +91-9900112233

Required By: 2026-02-03

Thank you,
Croma Operations Team
```

**Option 2: API (if Samsung has B2B API)**
```javascript
POST https://api.samsung.com/b2b/purchase-orders
Authorization: Bearer croma-api-key
{
  "po_number": "PO-2026-001234",
  "customer": "Croma",
  "items": [{
    "sku": "SAM-S24-256-BLK",
    "quantity": 50,
    "unit_price": 70000
  }],
  "delivery_address": {
    "warehouse": "Croma Mumbai",
    "address": "MIDC, Andheri East",
    "city": "Mumbai",
    "postal_code": "400093"
  },
  "required_by": "2026-02-03"
}
```

---

### **Step 5: Samsung Fulfills Order**

**Samsung's process:**
1. Receives PO from Croma
2. Samsung's factory checks stock
3. Samsung packs 50 Samsung S24 phones
4. Samsung arranges carrier (TCI Logistics)
5. Samsung ships from Noida factory to Croma Mumbai

**Samsung sends tracking info:**

```javascript
// Samsung calls your API
POST https://yourscm.com/api/purchase-orders/PO-2026-001234/shipment
{
  "invoice_number": "SAM-INV-98765",
  "carrier": "TCI Logistics",
  "tracking_number": "TCI-SHIP-556677",
  "shipped_date": "2026-02-01",
  "estimated_arrival": "2026-02-03",
  "package_count": 2,  // 50 phones in 2 boxes
  "total_weight_kg": 35
}
```

**Your SCM updates PO:**

```sql
UPDATE purchase_orders
SET status = 'in_transit',
    tracking_number = 'TCI-SHIP-556677',
    shipped_at = '2026-02-01',
    estimated_arrival = '2026-02-03'
WHERE po_number = 'PO-2026-001234';
```

**Your SCM shows on dashboard:**
```
📦 Purchase Order PO-2026-001234
Status: In Transit 🚚
Tracking: TCI-SHIP-556677
ETA: Feb 3, 2026 (2 days)
```

---

### **Step 6: Stock Arrives at Warehouse**

**TCI truck arrives at Croma Mumbai warehouse:**
- Date: Feb 3, 2026, 11:00 AM
- Driver unloads 2 large boxes
- Warehouse staff counts: 50 Samsung S24 phones ✅

**Warehouse staff uses your SCM mobile app:**
1. Opens app: "SCM Warehouse Scanner"
2. Scans PO barcode: PO-2026-001234
3. Scans each phone box (50 units)
4. Clicks "Confirm Receipt"

**Your SCM updates inventory:**

```sql
-- Mark PO as received
UPDATE purchase_orders
SET status = 'received',
    received_at = '2026-02-03 11:00',
    received_quantity = 50
WHERE po_number = 'PO-2026-001234';

-- Update inventory (add 50 units)
UPDATE inventory
SET quantity = quantity + 50,
    last_restocked_at = NOW()
WHERE warehouse_id = 'mumbai-wh-001'
  AND sku = 'SAM-S24-256-BLK';
-- Result: Mumbai warehouse now has 52 units (2 + 50)

-- Clear low stock alert
UPDATE inventory_alerts
SET status = 'resolved',
    resolved_at = NOW()
WHERE sku = 'SAM-S24-256-BLK'
  AND warehouse_id = 'mumbai-wh-001'
  AND status = 'active';
```

**Your SCM shows on dashboard:**
```
✅ Stock Replenished!
Samsung S24 (Mumbai Warehouse)
Previous: 2 units
Added: 50 units
Current: 52 units ✅

Low stock alert cleared.
```

---

### **Step 7: Billing (Croma ↔ Samsung)**

**Samsung sends invoice to Croma:**

```javascript
// Samsung sends invoice via email or API
POST https://yourscm.com/api/invoices
{
  "invoice_number": "SAM-INV-98765",
  "po_number": "PO-2026-001234",
  "supplier": "Samsung India",
  "amount": 3500000,
  "tax": 630000,  // 18% GST
  "total": 4130000,
  "payment_terms": "Net 30 days",
  "due_date": "2026-03-03"
}
```

**Your SCM records in Finance module:**

```sql
INSERT INTO finance_transactions (
  transaction_type,
  po_id,
  amount,
  party,
  invoice_number,
  status,
  due_date
) VALUES (
  'purchase_invoice',
  'PO-2026-001234',
  4130000,
  'Samsung India',
  'SAM-INV-98765',
  'payable',
  '2026-03-03'
);
```

**Croma's finance team:**
1. Reviews invoice in your SCM
2. Approves payment
3. Transfers ₹41,30,000 to Samsung's bank (outside your system)
4. Marks transaction as "Paid" in your SCM

```sql
UPDATE finance_transactions
SET status = 'paid',
    paid_at = '2026-02-10',
    payment_reference = 'BANK-REF-123456'
WHERE invoice_number = 'SAM-INV-98765';
```

---

## 💰 Money Flow Summary

### **Order #CROMA-12345 (Samsung S24 to Customer)**

```
Rahul (Customer)
   ↓ Pays ₹79,999
Croma (via Razorpay)
   ↓ Pays ₹130 shipping fee
Blue Dart (Carrier)

Croma → Pays YOU ₹2,00,000/month (SCM subscription)
```

### **Purchase Order PO-2026-001234 (Samsung Stock)**

```
Croma
   ↓ Pays ₹41,30,000 (₹35L + ₹6.3L GST)
Samsung India (Supplier)
   ↓ Pays ₹2,000 shipping fee
TCI Logistics (Freight)

Croma → Pays YOU ₹2,00,000/month (SCM subscription)
```

**Note:** All payments between Croma-BlueCart, Croma-Samsung happen outside your system. Your SCM only TRACKS these transactions.

---

## 📊 What YOUR SCM Provides to Croma

| Module | Features | Value |
|--------|----------|-------|
| **Orders** | All orders in one dashboard, auto-warehouse assignment | No manual work |
| **Inventory** | Real-time stock across 10 warehouses, low stock alerts | Never run out |
| **Carriers** | Auto-carrier assignment, rate comparison, tracking | Save ₹20/order |
| **Purchase Orders** | Auto-generate POs, track supplier shipments | Save 2 hours/day |
| **Finance** | Track all invoices, reconciliation, due dates | Save 4 hours/week |
| **Analytics** | Sales reports, inventory turnover, carrier performance | Better decisions |
| **Returns** | Manage returns, auto-create refunds | Happy customers |

**Croma's ROI:**
- Subscription: ₹2,00,000/month
- Saves: 3 employees × ₹50,000 = ₹1,50,000/month
- Saves: Better carrier rates = ₹20 × 5,000 orders = ₹1,00,000/month
- **Total savings: ₹2,50,000/month**
- **Net benefit: ₹50,000/month** + Time saved + Better visibility

---

## 🎯 Your SCM's Role

**You are the "Central Nervous System" that connects:**

```
        Croma's Website
              ↓
         Your SCM 🧠
         /    |    \
        /     |     \
   Warehouse Carrier Supplier
   (Mumbai)  (Blue   (Samsung)
             Dart)
```

**Without your SCM:** Croma needs 10 logins, Excel sheets, manual emails

**With your SCM:** Croma sees everything in one place, automation handles routine tasks
