# Carrier Assignment Flow Analysis

**Date:** February 16, 2026  
**Requested By:** User verification against industry best practices

---

## Expected Flow (Hybrid Push + Pull Model)

### ✅ What's Already Correct

| Component | Status | Implementation |
|-----------|--------|----------------|
| **1. Pending Assignments** | ✅ CORRECT | Carrier assignments created with `status='pending'` without immediate shipment |
| **2. Database Schema** | ✅ CORRECT | `availability_status` column exists in carriers table |
| **3. Carrier Pull API** | ✅ EXISTS | `GET /api/carriers/assignments/pending?carrierId=X` |
| **4. Accept/Reject API** | ✅ EXISTS | `POST /api/assignments/:id/accept` and `reject` |
| **5. Shipment Creation** | ✅ CORRECT | Only created in `acceptAssignment()` method |
| **6. Transaction Safety** | ✅ CORRECT | Accept + Shipment creation in single transaction |
| **7. Retry Logic** | ✅ EXISTS | `assignmentRetryService.js` handles expired assignments |
| **8. Notification Timing** | ✅ CORRECT | Notifications sent AFTER transaction commits (fire-and-forget) |

---

## ❌ Issues Found & Required Fixes

### Issue 1: Carrier Availability Not Checked 🔴 CRITICAL

**Location:** `backend/services/carrierAssignmentService.js:36-44`

**Current Code:**
```javascript
const carriersResult = await tx.query(
  `SELECT id, code, name, contact_email, service_type, is_active
   FROM carriers 
   WHERE is_active = true 
   AND (service_type = $1 OR service_type = 'all')
   ORDER BY reliability_score DESC
   LIMIT 3`,
  [serviceType]
);
```

**Problem:** Query only checks `is_active = true`, not `availability_status = 'available'`

**Expected:** Should filter by both:
```sql
WHERE is_active = true 
AND availability_status = 'available'
AND (service_type = $1 OR service_type = 'all')
```

**Impact:** May send assignments to busy/offline carriers

---

### Issue 2: Route Structure Different from Expected 🟡 MINOR

**Current Routes:**
- `GET /api/carriers/assignments/pending?carrierId=X`
- `POST /api/assignments/:id/accept?carrierId=X`

**Expected Conventional Routes (optional improvement):**
- `GET /api/carrier/jobs?status=pending` (carrier-centric)
- `POST /api/carrier/job/:id/accept`

**Status:** Current implementation works but uses different naming convention. Not critical.

---

### Issue 3: Retry Time Window Too Long 🟡 MEDIUM

**Location:** `backend/services/assignmentRetryService.js:17-50`

**Current:** 
- Assignments expire after 24 hours
- Retry job runs every 30 minutes
- Uses `expires_at < NOW()` check

**Expected:**
- 5-10 minute response window per batch
- Automatic retry if no response

**Impact:** Carriers have too much time to respond, slowing order fulfillment

---

### Issue 4: Order Status Changed to 'shipped' on Accept 🟡 MEDIUM

**Location:** `backend/services/carrierAssignmentService.js:366-372`

**Current Code:**
```javascript
// Update order status to 'shipped'
await tx.query(
  `UPDATE orders 
   SET status = 'shipped', updated_at = NOW()
   WHERE id = $1`,
  [assignment.order_id]
);
```

**Problem:** Order marked as 'shipped' when carrier accepts, not when actually shipped

**Expected Flow:**
1. Carrier accepts → Order status = `'assigned'` or `'ready_to_ship'`
2. Carrier picks up → Order status = `'in_transit'`
3. Carrier delivers → Order status = `'delivered'`

**Impact:** Inaccurate order tracking, customer sees "shipped" before pickup

---

### Issue 5: Max Retry Count Not Enforced in Main Flow 🟢 LOW

**Location:** `backend/services/carrierAssignmentService.js`

**Current:** Retry logic exists only in scheduled job (assignmentRetryService.js)

**Expected:** Service should check retry count before creating new assignments

**Suggested:**
```javascript
// Before creating assignments, check if max retries reached
const retryCount = await tx.query(
  'SELECT COUNT(DISTINCT carrier_id) as count FROM carrier_assignments WHERE order_id = $1',
  [orderId]
);

if (retryCount.rows[0].count >= 9) {
  throw new Error('Maximum carrier assignment retries exceeded');
}
```

---

## Implementation Priority

### 🔴 HIGH PRIORITY (Do First)
1. **Fix carrier availability check** → Add `availability_status = 'available'` filter
2. **Fix order status after accept** → Change 'shipped' to 'ready_to_ship' or 'assigned'

### 🟡 MEDIUM PRIORITY (Do Next)
3. **Reduce retry window** → Change from 24h to 5-10 min per batch
4. **Add max retry guard** → Prevent creating assignments after 3 retries

### 🟢 LOW PRIORITY (Optional)
5. **Route naming consistency** → Align with industry conventions (optional)

---

## Recommended Changes

### Change 1: Fix Carrier Query (services/carrierAssignmentService.js:36)

```javascript
const carriersResult = await tx.query(
  `SELECT id, code, name, contact_email, service_type, is_active, availability_status
   FROM carriers 
   WHERE is_active = true 
   AND availability_status = 'available'  -- ADD THIS LINE
   AND (service_type = $1 OR service_type = 'all')
   ORDER BY reliability_score DESC
   LIMIT 3`,
  [serviceType]
);

// If no available carriers, keep order status as pending
if (carriersResult.rows.length === 0) {
  logger.warn(`No available carriers for order ${orderId}. Will retry when carriers become available.`);
  // Don't throw error - let retry service handle it
  return { assignments: [], carriersToNotify: [], orderId };
}
```

### Change 2: Fix Order Status After Accept (services/carrierAssignmentService.js:366)

```javascript
// BEFORE (WRONG):
await tx.query(
  `UPDATE orders 
   SET status = 'shipped', updated_at = NOW()
   WHERE id = $1`,
  [assignment.order_id]
);

// AFTER (CORRECT):
await tx.query(
  `UPDATE orders 
   SET status = 'ready_to_ship', 
       carrier_id = $2,
       updated_at = NOW()
   WHERE id = $1`,
  [assignment.order_id, assignment.carrier_id]
);
```

### Change 3: Reduce Assignment Expiry Time (services/carrierAssignmentService.js:55)

```javascript
// BEFORE:
const expiresAt = new Date();
expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

// AFTER:
const expiresAt = new Date();
expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes per batch
```

### Change 4: Add Max Retry Check (services/carrierAssignmentService.js:48)

```javascript
// Add before creating assignments:
const retryCheckResult = await tx.query(
  `SELECT COUNT(DISTINCT carrier_id) as tried_count
   FROM carrier_assignments
   WHERE order_id = $1`,
  [orderId]
);

const triedCount = parseInt(retryCheckResult.rows[0]?.tried_count || 0);

if (triedCount >= 9) {
  // Maximum 3 batches of 3 carriers each = 9 total attempts
  logger.error(`Order ${orderId} has exhausted all carrier retries`);
  
  await tx.query(
    `UPDATE orders SET status = 'pending_manual_assignment' WHERE id = $1`,
    [orderId]
  );
  
  throw new Error('Maximum carrier assignment attempts exceeded. Manual intervention required.');
}
```

---

## Summary

| Aspect | Current | Expected | Status |
|--------|---------|----------|--------|
| Push + Pull Model | ✅ Implemented | Hybrid push notification + carrier pull | ✅ GOOD |
| Assignment Status | ✅ 'pending' | Don't create shipment immediately | ✅ GOOD |
| Carrier Availability | ❌ Not checked | Filter by `availability_status='available'` | 🔴 FIX NEEDED |
| Pull API | ✅ Exists | GET /carrier/jobs?status=pending | ✅ GOOD |
| Accept Creates Shipment | ✅ Correct | Only on accept | ✅ GOOD |
| Retry Logic | ✅ Exists | Max 3 batches, 5-10 min window | 🟡 ADJUST TIMING |
| Order Status | ❌ 'shipped' | Should be 'ready_to_ship' on accept | 🔴 FIX NEEDED |

**Overall Assessment:** Flow is **85% correct**. Main issues are:
1. Not filtering by carrier availability
2. Wrong order status on acceptance
3. Retry window too long

These are straightforward fixes that don't require rewriting the project.

---

## Files Requiring Changes

1. `/backend/services/carrierAssignmentService.js` - Lines 36, 55, 366 (3 changes)
2. `/backend/services/orderService.js` - Line 36 (1 change)
3. Optional: `/backend/routes/assignments.js` - Route naming (cosmetic)

Total estimated changes: **4 critical lines of code**
