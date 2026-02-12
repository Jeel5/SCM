# Carrier API Integration Testing

This document shows how to use the new carrier rate API integration.

## Overview

The system now calls **external carrier APIs** (DHL, FedEx, Blue Dart, Delhivery) to get real-time shipping quotes instead of calculating prices internally.

## Architecture

```
Customer Order → SCM System
    ↓
SCM calls all carrier APIs in parallel:
    - DHL API
    - FedEx API  
    - Blue Dart API
    - Delhivery API
    ↓
Carriers respond with quotes
    ↓
SCM stores all quotes in database
    ↓
SCM compares quotes and recommends best option
    ↓
Customer sees shipping options
```

## API Endpoints

### 1. Get Shipping Quotes from All Carriers

**POST** `/api/shipping/quotes`

Request:
```json
{
  "origin": {
    "lat": 19.0760,
    "lon": 72.8777,
    "address": "Mumbai, Maharashtra",
    "postalCode": "400001"
  },
  "destination": {
    "lat": 28.7041,
    "lon": 77.1025,
    "address": "Delhi",
    "postalCode": "110001"
  },
  "items": [
    {
      "weight": 1.5,
      "dimensions": {
        "length": 30,
        "width": 20,
        "height": 10
      },
      "is_fragile": true,
      "requires_cold_storage": false
    }
  ],
  "orderId": "ORD-2026-001"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "quotes": [
      {
        "carrierId": "uuid",
        "carrierName": "DHL",
        "carrierCode": "DHL",
        "quotedPrice": 272.50,
        "currency": "INR",
        "estimatedDeliveryDays": 2,
        "estimatedDeliveryDate": "2026-02-02T00:00:00Z",
        "serviceType": "EXPRESS",
        "validUntil": "2026-02-01T00:00:00Z",
        "breakdown": {
          "baseRate": 190.75,
          "fuelSurcharge": 40.88,
          "handlingFee": 27.25,
          "insurance": 13.62
        }
      },
      {
        "carrierId": "uuid",
        "carrierName": "Blue Dart",
        "carrierCode": "BLUEDART",
        "quotedPrice": 225.00,
        "currency": "INR",
        "estimatedDeliveryDays": 2,
        "estimatedDeliveryDate": "2026-02-02T00:00:00Z",
        "serviceType": "STANDARD",
        "validUntil": "2026-02-01T00:00:00Z",
        "breakdown": {
          "baseRate": 162.00,
          "fuelSurcharge": 33.75,
          "handlingFee": 18.00,
          "insurance": 11.25
        }
      }
    ],
    "recommended": {
      "carrierId": "uuid",
      "carrierName": "Blue Dart",
      "carrierCode": "BLUEDART",
      "quotedPrice": 225.00,
      "scores": {
        "price": 0.95,
        "speed": 1.0,
        "reliability": 0.90,
        "total": 0.935
      }
    },
    "totalQuotes": 2
  }
}
```

### 2. Get Quotes with Custom Criteria

**POST** `/api/shipping/quotes/custom`

Request:
```json
{
  "origin": { ... },
  "destination": { ... },
  "items": [ ... ],
  "orderId": "ORD-2026-001",
  "criteria": {
    "prioritizePrice": 0.7,
    "prioritizeSpeed": 0.2,
    "reliabilityWeight": 0.1
  }
}
```

This allows you to customize the selection algorithm:
- `prioritizePrice`: 0-1, higher = price matters more
- `prioritizeSpeed`: 0-1, higher = speed matters more  
- `reliabilityWeight`: 0-1, higher = reliability matters more
- Must sum to 1.0

### 3. Get Quote from Specific Carrier

**POST** `/api/shipping/quotes/:carrierId`

Request:
```json
{
  "origin": { ... },
  "destination": { ... },
  "items": [ ... ],
  "orderId": "ORD-2026-001"
}
```

### 4. Select a Quote

**POST** `/api/shipping/quotes/:quoteId/select`

Request:
```json
{
  "orderId": "ORD-2026-001"
}
```

### 5. Get All Quotes for an Order

**GET** `/api/shipping/quotes/order/:orderId`

## Database Schema

### carrier_quotes Table

Stores all quotes received from carriers:

```sql
CREATE TABLE carrier_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  carrier_id UUID REFERENCES carriers(id),
  quoted_price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  estimated_delivery_days INTEGER,
  estimated_delivery_date TIMESTAMPTZ,
  service_type VARCHAR(50),
  valid_until TIMESTAMPTZ,
  breakdown JSONB,
  is_selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### carriers Table Updates

Added API configuration columns:

```sql
ALTER TABLE carriers
ADD COLUMN api_endpoint VARCHAR(255),
ADD COLUMN api_key_encrypted TEXT,
ADD COLUMN api_version VARCHAR(50);
```

## Example Flow: E-commerce Checkout

### Step 1: Customer adds items to cart

Customer on Croma website adds Samsung S24 to cart.

### Step 2: Get shipping costs

When customer goes to checkout, Croma calls SCM API:

```bash
curl -X POST http://localhost:3000/api/shipping/quotes \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {
      "lat": 19.0760,
      "lon": 72.8777,
      "address": "Croma Warehouse Mumbai",
      "postalCode": "400001"
    },
    "destination": {
      "lat": 28.7041,
      "lon": 77.1025,
      "address": "Customer Address Delhi",
      "postalCode": "110001"
    },
    "items": [{
      "weight": 0.5,
      "dimensions": {"length": 20, "width": 15, "height": 5},
      "is_fragile": true
    }],
    "orderId": "CROMA-ORD-12345"
  }'
```

### Step 3: Display shipping options to customer

Croma website shows:

```
Product: Samsung Galaxy S24          ₹79,999
Shipping Options:
  ○ Blue Dart (2 days)                 ₹225 [Recommended]
  ○ DHL Express (2 days)                ₹272
  ○ Delhivery (4 days)                  ₹180

Total:                               ₹80,224
```

### Step 4: Customer selects and confirms

When customer clicks "Place Order", Croma calls:

```bash
curl -X POST http://localhost:3000/api/shipping/quotes/QUOTE_ID/select \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "CROMA-ORD-12345"
  }'
```

## Production Implementation

### For Real Carrier APIs

Currently, the service uses simulated responses for development. To integrate real APIs:

1. **DHL API**
   - Sign up: https://developer.dhl.com/
   - Get API credentials
   - Update `getDHLQuote()` method with actual API call
   
2. **FedEx API**
   - Sign up: https://developer.fedex.com/
   - Get API credentials
   - Update `getFedExQuote()` method
   
3. **Blue Dart API**
   - Contact Blue Dart for API access
   - Update `getBlueDartQuote()` method

### Storing API Keys Securely

```sql
-- Store encrypted API keys
UPDATE carriers 
SET 
  api_endpoint = 'https://api.dhl.com/mydhlapi/rates',
  api_key_encrypted = encrypt('YOUR_API_KEY'),
  api_version = 'v1'
WHERE code = 'DHL';
```

Use environment variables or secrets manager for encryption keys.

## Testing

### Test Case 1: Mumbai to Delhi (Long Distance)

```bash
curl -X POST http://localhost:3000/api/shipping/quotes \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {"lat": 19.0760, "lon": 72.8777, "address": "Mumbai"},
    "destination": {"lat": 28.7041, "lon": 77.1025, "address": "Delhi"},
    "items": [{"weight": 2.0}],
    "orderId": "TEST-001"
  }'
```

Expected: Higher prices, 2-3 day delivery

### Test Case 2: Local Delivery

```bash
curl -X POST http://localhost:3000/api/shipping/quotes \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {"lat": 19.0760, "lon": 72.8777, "address": "Mumbai West"},
    "destination": {"lat": 19.1136, "lon": 72.8697, "address": "Mumbai East"},
    "items": [{"weight": 1.0}],
    "orderId": "TEST-002"
  }'
```

Expected: Lower prices, 1 day delivery

### Test Case 3: Fragile Items

```bash
curl -X POST http://localhost:3000/api/shipping/quotes \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {"lat": 19.0760, "lon": 72.8777, "address": "Mumbai"},
    "destination": {"lat": 28.7041, "lon": 77.1025, "address": "Delhi"},
    "items": [{"weight": 1.5, "is_fragile": true}],
    "orderId": "TEST-003"
  }'
```

Expected: Additional handling fees

## Benefits of This Approach

### ✅ Always Up-to-Date Pricing
- Carriers control their own pricing
- Fuel surcharges automatically included
- Seasonal adjustments handled by carrier

### ✅ Customer-Specific Rates
- Each company may have negotiated rates with carriers
- Volume discounts automatically applied
- Special contracts honored

### ✅ Real-Time Availability
- Carriers indicate if service available for route
- Holiday/weekend schedules respected
- Capacity constraints communicated

### ✅ Maintainable
- No complex pricing logic to maintain
- Carrier API updates don't break system
- Easy to add new carriers

## Monitoring

### Quote Success Rate

Monitor how many carrier APIs respond successfully:

```sql
SELECT 
  DATE(created_at) as date,
  COUNT(DISTINCT carrier_id) as carriers_responding,
  COUNT(*) as total_quotes
FROM carrier_quotes
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Average Quote Response Time

Log and monitor API response times:

```javascript
const startTime = Date.now();
const quote = await callCarrierAPI();
const responseTime = Date.now() - startTime;
logger.info('Carrier API response time', { carrier, responseTime });
```

### Selected Carrier Distribution

Which carriers get selected most often:

```sql
SELECT 
  c.name,
  COUNT(*) as times_selected,
  AVG(cq.quoted_price) as avg_price
FROM carrier_quotes cq
JOIN carriers c ON cq.carrier_id = c.id
WHERE cq.is_selected = true
GROUP BY c.name
ORDER BY times_selected DESC;
```

## Next Steps

1. ✅ Database tables created (carrier_quotes, carrier API columns)
2. ✅ Service layer implemented (carrierRateService.js)
3. ✅ Controller created (shippingQuoteController.js)
4. ✅ Routes configured (/api/shipping/*)
5. ⏳ Test with real order data
6. ⏳ Integrate with order creation flow
7. ⏳ Add to e-commerce checkout
8. ⏳ Connect real carrier APIs (DHL, FedEx, etc.)
9. ⏳ Add error handling and retry logic
10. ⏳ Build admin UI to manage carrier API configs
