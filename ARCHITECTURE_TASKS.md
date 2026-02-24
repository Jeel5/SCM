# Architecture Task Summary

**Last Updated:** 2026-02-23  
**Status:** Development Phase (Webhooks & Finance Future)  
**Analysis:** ChatGPT suggestions reviewed and filtered by actual system state

---

## 🔴 CRITICAL — Act Now if Building

### 1. Carrier Portal Security — `/carriers/assignments/pending`
**Status:** Development Phase  
**Issue:** Endpoint has NO authentication (anyone can call)  
**Impact:** Partners could spy on other carriers' assignments  
**Fix:** Add authentication middleware before shipping
- Option A: API key header (`x-carrier-key`)
- Option B: OAuth token (if building carrier dashboard)
- **Recommendation:** Start with API key (simpler for now)

**Action:** Add carrier auth middleware to verify identity before exposing any `/carriers/*` endpoints  
**Complexity:** Low | **Priority:** HIGH (before carrier portal goes live)

---

### 2. Webhook Security Architecture (FUTURE — Plan Now)
**Status:** Not yet implemented  
**When relevant:** When you start accepting carrier webhooks  
**Critical gaps ChatGPT identified:**
- ❌ Comment says "No authentication required" — DANGEROUS
- ❌ Would allow anyone to inject fake quotes
- ❌ No idempotency (duplicate webhooks = duplicate quotes)
- ❌ No multi-tenant isolation check

**Correct pattern to implement later:**
```
Webhook received → Verify HMAC signature → Validate schema → 
Check idempotency (event_id) → Verify organization → 
Queue job → Return 200 OK immediately → Worker processes DB
```

**Must-have safeguards:**
1. ✅ HMAC signature verification (X-Signature header)
2. ✅ Schema validation (zod/joi)
3. ✅ Idempotency guard (`UNIQUE(carrier_id, webhook_id)` + check)
4. ✅ Organization ownership check (Org A webhook can't modify Org B order)
5. ✅ Queue-based processing (not sync DB writes)

**Action:** Document this pattern in DESIGN.md before implementing webhooks  
**Complexity:** Medium | **Priority:** HIGH (security-critical, plan now)

---

## 🟡 IMPORTANT — Clean Up Architecture

### 3. Route Structure Reorganization
**Current state:** Routes scattered, some unauthenticated  
**Better structure needed:**
```
routes/
├── admin/           ← Superadmin only (platform-level)
│   └── companies.routes.js
├── internal/        ← Tenant user authenticated
│   ├── orders.routes.js
│   ├── inventory.routes.js
│   └── ...
├── carriers/        ← Partner API (API key or OAuth)
│   └── portal.routes.js
└── webhooks/        ← Webhook signatures (HMAC)
    └── carriers.webhook.routes.js
```

**Why:** Different security models shouldn't live together  
**Action:** Refactor routes into clear domains  
**Complexity:** Medium | **Priority:** MEDIUM (cleanup, not blocking)

---

### 4. Permission System Hardening
**Current state:** Permissions are objects/arrays (mutable at runtime)  
**Issues identified:**
- ❌ Could be accidentally modified
- ❌ Array lookups O(n) — scales poorly

**Fixes:**
1. Freeze permissions at module load
2. Convert to Sets for O(1) lookups

**Code pattern:**
```javascript
export const ALL_PERMISSIONS = Object.freeze([...]);
export const ROLE_PERMISSIONS = Object.freeze({...});

// Convert to Sets for fast lookup
const rolePermissionSets = Object.fromEntries(
  Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => [
    role,
    new Set(perms.includes('*') ? ALL_PERMISSIONS : perms)
  ])
);

// Then: rolePermissionSets[userRole].has(permission) → O(1)
```

**Action:** Update your RBAC module (auth/permissions.js, auth/roles.js)  
**Complexity:** Low | **Priority:** LOW (works now, optimization)

---

### 5. Folder Structure Cleanup
**Issue:** `config/` and `configs/` both exist (confusing)  
**Current:** `/backend/configs/db.js`  
**Better:** Consolidate naming convention  
**Also:** Move RBAC files to `/backend/auth/` instead of nested elsewhere

**Action:** Rename `configs/` → `config/`, move any scattered auth files into `auth/`  
**Complexity:** Low | **Priority:** LOW (cosmetic)

---

## 🟠 FUTURE — Plan Architecture for Finance & Ledger

### 6. Finance Module Design (FUTURE)
**Status:** Planned feature  
**What ChatGPT flagged:**
- ❌ No dedicated finance permissions (they suggested reusing `settings.organization` ← WRONG)
- ❌ No ledger concept
- ❌ No idempotency for refunds
- ❌ Finance queries not transactional

**What you should do:**
1. **Create dedicated permissions:**
   ```javascript
   finance.create_invoice
   finance.update_invoice
   finance.process_refund
   finance.resolve_dispute
   ```
   (Never couple finance to settings permissions)

2. **Design Ledger table:**
   ```sql
   ledger (id, org_id, account_type, amount, reference_type, reference_id, created_at)
   -- Every transaction: invoice created (+), refund (-), adjustment (±)
   ```

3. **Make all financial writes transactional:**
   ```javascript
   BEGIN;
   INSERT invoice
   INSERT ledger entry
   COMMIT;
   ```

4. **Add Idempotency-Key header support:**
   - Client sends: `Idempotency-Key: unique-id`
   - Store processed keys in `idempotency_keys` table
   - Return cached response if key seen before

5. **Financial Summary must be precomputed** (not live query)
   - Create `financial_snapshots` table (updated by event)
   - Read from snapshot, not live SUM/JOIN

**Action:** Create `/backend/finance/DESIGN.md` documenting this before implementing  
**Complexity:** High | **Priority:** MEDIUM (future but needs planning)

---

### 7. Superadmin Route Namespace & Enforcement
**Status:** Development (not yet critical)  
**Issue:** Superadmin routes need clear namespace + explicit middleware

**To implement later:**
```javascript
// routes/admin/companies.routes.js
const router = Router();

// Enforce superadmin on ALL routes in this router
router.use(authenticate, requireSuperadmin);

router.get('/companies', ...)
router.post('/companies', ...)
router.delete('/companies/:id', ...)
// Mounted as: app.use('/api/admin', adminRoutes);
// Result: /api/admin/companies
```

**What to add:**
1. ✅ `requireSuperadmin` middleware (check role === 'superadmin')
2. ✅ Namespace admin routes under `/api/admin/*`
3. ✅ Audit logging (every admin action logged with who/what/when)
4. ✅ Soft delete companies (not hard delete)
5. ✅ Pagination on `GET /companies` (even if small now)
6. ✅ Rate limiting on admin endpoints

**Action:** When building admin panel, implement the above checklist  
**Complexity:** Medium | **Priority:** MEDIUM (future feature)

---

## ✅ GOOD DECISIONS (Keep Going)

ChatGPT confirmed you're doing these right:
- ✅ Finance isolated as separate module
- ✅ Multi-tenant enforcement (`organization_id` checks)
- ✅ Permission-based access control
- ✅ Controller → Service separation exists
- ✅ Graceful shutdown logic (SIGTERM handling)
- ✅ Transaction support with worker queue

---

## � CRITICAL — Security Holes Found in Inventory, MDM, Orders

### 1. Missing Authorization on ALL MDM Mutations ⚠️ ACT NOW
**Issue:** MDM endpoints authenticate but DON'T authorize  
**Examples:** `POST /warehouses`, `DELETE /products`, `POST /carriers`  
**Impact:** ANY logged-in user can create warehouses, delete products, modify master data  
**Critical Fix (Add to every mutation route):**
```javascript
// Current: WRONG
router.post('/warehouses', authenticate, injectOrgContext, createWarehouse);

// Correct:
router.post('/warehouses', authenticate, injectOrgContext, authorize('warehouses.manage'), createWarehouse);
```
**Decision:** ChatGPT is 100% correct. This is a security hole.  
**Action:** Add permission checks (`warehouse.manage`, `product.manage`, `carrier.manage`, etc.) to ALL MDM mutations  
**Complexity:** Low | **Priority:** 🔴 CRITICAL (do this week)

---

### 2. Public Carrier Endpoints Expose Internal Data
**Status:** Currently OK for demo, MUST fix before production  
**Routes:** `GET /carriers`, `GET /carriers/:id` (unauthenticated)  
**Issue:** Pricing, routing logic, internal codes exposed  
**Your comment:** `// public - needed by simulation/demo site`  
**Decision:** ✅ Keep for development. Before go-live, either:
- Option A: Require API key auth
- Option B: Create `/public/carriers` with sanitized DTO (hide internal_codes, routing_logic, secret_integrations)

**Action:** Add TODO before production. For now, mark as demo-only in code.  
**Complexity:** Low | **Priority:** 🟠 MEDIUM (future hardening)

---

### 3. Inventory Adjustments + Transfers NOT Transactional
**Data issue:** Stock can disappear if adjustment fails mid-operation  
**Example:** `transferInventory` removes from A, adds to B — if B fails, stock vanishes  
**Current code:** Likely does both operations separately  
**ChatGPT identified:** Industry requires DB transactions or event + compensation  
**Decision:** Use DB transactions first (simpler):
```javascript
await withTransaction(async (tx) => {
  await InventoryRepository.addStock(..., tx);
  await InventoryRepository.addStock(..., tx);
  // Both succeed or both fail
});
```
**Action:** Wrap `transferInventory` in transaction. Check `adjustStock` also uses transactions.  
**Complexity:** Low | **Priority:** 🔴 CRITICAL (data integrity)

---

### 4. Missing Inventory Reservation System
**Issue:** No reserve → release → commit flow  
**Risk:** Two customers buy last item → overselling  
**You have:** `reserved_quantity` column exists  
**You're missing:** API/logic to reserve on order creation, release on cancel, commit on ship  
**Timeline:**
- **Phase 1 (NOW):** Fix transaction safety first
- **Phase 2 (SOON):** When orders connect to inventory, add reservation logic
- **Phase 3 (LATER):** Complex allocation algorithms

**Action:** Document flow in order design. NOT urgent yet.  
**Complexity:** Medium | **Priority:** 🟡 MEDIUM (needed soon, not now)

---

### 5. Inventory Stats Should Be Precomputed (ALREADY DONE ✅)
**ChatGPT flagged:** Live SUM/COUNT kills performance  
**Your actual code:** You already fixed this! Storing `current_utilization` in warehouses table, updating via background job  
**⭐ This is smart design.** Keep doing this.

---

## 🟠 IMPORTANT — Inventory & MDM Refactoring Tasks

### Inventory Module Cleanup
1. **Routing:** Mount at `/api/inventory` (stop repeating /inventory prefix)
2. **Middleware:** Apply `router.use(authenticate, injectOrgContext)` once at top
3. **Warehouse Scope:** EVERY query must filter by both `organization_id` AND `warehouse_id`
4. **Transfer Atomicity:** Wrap in transaction (see #3 above)
5. **Reason Codes:** Do you already have `reason` enum on adjustments? (DAMAGED, LOST, EXPIRED, etc.)
   - Required for finance reconciliation

### MDM Module Reorganization
**Current:** Routes mixed (tenant + platform)  
**Better:**
```
routes/mdm/
├── tenant/
│   ├── warehouses.routes.js
│   └── products.routes.js
└── platform/
    ├── carriers.routes.js
    └── sla.routes.js
```
**Why:** Warehouses/products are TENANT data. Carriers/SLAs are PLATFORM data. Different security models.  
**Complexity:** Medium | **Priority:** 🟡 MEDIUM (cleanup, not blocking)

### Soft Delete Master Data (Not Urgent Now)
**Issue:** Hard delete breaks referential integrity  
**When it matters:** If you delete a warehouse but orders reference it by ID  
**Simple fix:** Rename `DELETE /warehouses/:id` to add validation:
```javascript
// Disallow if inventory exists
const count = await countInventory(warehouseId);
if (count > 0) throw new Error('Cannot delete warehouse with inventory');
```
**Full soft delete:** Use `status = inactive` instead of hard delete (future)  
**Complexity:** Low | **Priority:** 🟡 MEDIUM (data safety)

---

## 🟠 IMPORTANT — Orders Architecture (Event-Driven Missing)

### Order State Machine (REQUIRED)
**Current:** Order has status field  
**Missing:** Validation that status transitions are legal  
**Implement:**
```
CREATED → ALLOCATED → PICKED → SHIPPED → DELIVERED → CLOSED
              ↑                   ↓
              └─ CANCELLED ───────┘
```
**Use:** `OrderStatusService` to enforce valid transitions  
**Complexity:** Low | **Priority:** 🟡 MEDIUM (prevents bad states)

### Inventory Integration (CRITICAL GAP)
**Current:** Orders exist, inventory exists, but NO LINK  
**Missing:**
1. When order created → reserve inventory (`reserved_quantity += qty`)
2. When order cancelled → release (`reserved_quantity -= qty`)
3. When order shipped → commit (`reserved_quantity -= qty`, actual removal)

**Action:** Before orders go live, implement reservation flow  
**Complexity:** Medium | **Priority:** 🟠 HIGH (prevents overselling)

### Event-Driven (NOT Direct Calls)
**Anti-pattern:** Controller calls inventory directly
**Pattern:** Controller emits event, worker processes
```javascript
// Controller:
emit('OrderCreated', orderData);
res.json(order);

// Worker listens:
on('OrderCreated', async (order) => {
  await reserveInventory(order);
  emit('InventoryReserved', ...);
});
```
**Why:** Order + inventory have different failure modes. Keep them async.  
**Action:** Design order → worker flow before shipping  
**Complexity:** Medium | **Priority:** 🟡 MEDIUM (architecture, not urgent)

### Transfer Orders Must Be Atomic
**Current:** `transferInventory` endpoint  
**Issue:** If operation half-completes, stock disappears  
**Fix:** Wrap in DB transaction (see #3 above)  
**Action:** Verify transfer is transactional  
**Complexity:** Low | **Priority:** 🔴 CRITICAL (fix this week)

---

## 🟠 IMPORTANT — Organizations & Platform Control Plane

### Explicit Superadmin Enforcement (SECURITY)
**Current:** Implicit via `authorize('superadmin')`  
**Better:** Explicit middleware
```javascript
// Instead of:
router.use(authenticate, authorize('superadmin'));

// Use:
router.use(authenticate, requireSuperadmin());
```
**Why:** Permissions can change. Superadmin must be hardcoded enforcement.  
**Complexity:** Low | **Priority:** 🟡 MEDIUM (harder to break)

### Organization Lifecycle States (NOT Hard Delete)
**Current:** `DELETE /companies/:id` hard deletes  
**Better:** Use status enum
- `active`
- `suspended`
- `trial`
- `archived`

**Why:** Billing, invoices, compliance require audit trail  
**Complexity:** Low | **Priority:** 🟡 MEDIUM (not urgent, but better design)

### Organization Creation Must Be Atomic
**This matters when:** You have actual customers  
**Currently:** Probably OK since dev phase  
**When implementing:** Wrap in transaction:
```javascript
BEGIN;
  1. Create organization
  2. Create default admin user
  3. Create default roles
  4. Create billing profile
COMMIT;
```
**Complexity:** Medium | **Priority:** 🟡 MEDIUM (structure before go-live)

### Audit Logging on Organization Changes (ENTERPRISE)
**Need:** Log who created/suspended/archived organizations  
**Fields:** `actor_id`, `action`, `timestamp`, `before_state`, `after_state`, `ip_address`  
**When:** Required for compliance customers  
**Complexity:** Low | **Priority:** 🟠 LOW (future)

---

## 🟠 IMPORTANT — Returns Module (State Machine + Events)

### Return State Machine (REQUIRED)
**Implement:**
```
REQUESTED → APPROVED → IN_TRANSIT → RECEIVED → INSPECTED → 
  (RESTOCKED | DISPOSED | REFUNDED) → CLOSED
```
**Current:** Probably just CRUD  
**Missing:** Prevent invalid state transitions  
**Action:** Add `ReturnStatusService` like you have for other state machines  
**Complexity:** Low | **Priority:** 🟡 MEDIUM (prevents bad states)

### Inventory Integration (NOT DIRECT)
**Anti-pattern:** Return controller updates inventory directly  
**Pattern:** Emit `ReturnReceived` event, worker reintegrates stock  
**Why:** Returns affect: inventory, finance, analytics. Keep async.  
**Action:** Design return event flow before returns go live  
**Complexity:** Medium | **Priority:** 🟡 MEDIUM (prevents cascading failures)

### Finance Integration (ASYNC)
**Rule:** Return approval ≠ refund execution  
**Flow:** Approved → Inspected → Refund Decision → Refund Processed  
**Why:** Warehouse receives return Monday, customer refund processes Friday (manual review)  
**Action:** Never call refund logic directly from return controller  
**Complexity:** Medium | **Priority:** 🟠 HIGH (money logic cannot be synchronous)

### Validation Hardening
Before `createReturn`, check:
- Order belongs to organization ✓
- Item exists in order ✓
- Quantity ≤ purchased quantity ✓
- Return window still valid ✓
- Order eligible for return (shipped, not cancelled) ✓

**Action:** Add validation layer  
**Complexity:** Low | **Priority:** 🟡 MEDIUM (prevents bad returns)

---

## 📋 NOT APPLICABLE / CHATGPT CONTEXT GAPS

### Inventory Movement Event Architecture (FUTURE)
**ChatGPT flagged:** Industry uses event-driven stock (SUM of movements, not direct updates)  
**Reality:** Your current direct-update approach works fine at this scale  
**Decision:** NOT urgent. Focus on making updates transactional first.  
**When to revisit:** When you need:
- Per-unit audit trails
- Complex allocation (ML-based bin packing)
- Carrier scans integration
- Warehouse automation

### Route Reorganization Priority
**ChatGPT suggested:** Split into admin/internal/carriers/webhooks  
**Reality:** Works currently as single router  
**Decision:** Reorganize when it becomes painful (20+ route files)  
**NOT urgent** but good to have in backlog

### Carrier Lookup Caching
**ChatGPT:** Cache to avoid SELECT per webhook  
**Reality:** You're in dev, not at 100k webhooks/day  
**Decision:** Skip for now. Add caching only if profiling shows bottleneck.

---

## 🎯 SUMMARY BY TIMELINE

### 🔴 **THIS WEEK** (Security + Data Integrity)
- [ ] Add authorization checks to ALL MDM mutations (warehouse.manage, product.manage, etc.)
- [ ] Verify `transferInventory` is wrapped in DB transaction
- [ ] Verify `adjustStock` is wrapped in DB transaction

### 🟠 **NEXT 2 WEEKS** (Before Shipping Features)
- [ ] Add Order State Machine validation
- [ ] Design inventory reservation flow (reserve on order, release on cancel, commit on ship)
- [ ] Design return state machine + event flow
- [ ] Organize MDM routes (tenant vs platform separation)

### 🟡 **THIS MONTH** (Architecture Cleanup)
- [ ] Reorganize routes into clear domains (admin/internal/carriers/webhooks)
- [ ] Implement superadmin middleware (`requireSuperadmin`)
- [ ] Add soft delete support to master data
- [ ] Document order + return event patterns

### 📅 **LATER** (After MVP)
- [ ] Add idempotency keys to POST endpoints
- [ ] Implement organization lifecycle (active/suspended/archived)
- [ ] Add audit logging to platform actions
- [ ] Implement event-driven inventory (movement-based SUM)

---

---

# 📋 ROUND 2 ANALYSIS — Shipments, SLA, Auth, Webhooks Modules

**Input Source:** found.txt Round 2  
**Analysis Approach:** Critical evaluation of FutureState vs Current Reality  
**Trust Level:** ChatGPT architectural patterns ✅ | ChatGPT urgency levels ❌

---

## 🔴 URGENT — Webhook Implementation Foundation

### 1. HMAC Signature Verification (CRITICAL for Webhooks)
**Status:** Your webhooks code needs this BEFORE shipping  
**Issue:** Current code likely accepts unauthenticated requests  
**What ChatGPT said:** "verify X-Webhook-Signature header"  
**My Assessment:** ✅ 100% correct. This is INDUSTRY STANDARD.

**Implementation Pattern:**
```javascript
// middleware/verifyWebhookSignature.js
const crypto = require('crypto');

export const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-webhook-signature'];
  const rawBody = req.rawBody; // Must capture raw body before JSON parsing
  const secret = process.env.WEBHOOK_SECRET;
  
  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  
  if (hash !== signature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  next();
};
```

**Action:** Implement this middleware before webhook endpoints go live  
**Complexity:** Low | **Priority:** 🔴 CRITICAL (security hole)

---

### 2. Raw Body Capture for Signature Verification
**What ChatGPT said:** "Capture raw request body before JSON parsing"  
**Status:** Your Express setup likely parses JSON before signature check  
**My Assessment:** ✅ Correct. Signature verification requires exact bytes.

**Setup Pattern:**
```javascript
// app.js - BEFORE routes
app.use(express.raw({ type: 'application/json' })); // Capture raw
app.use((req, res, next) => {
  if (Buffer.isBuffer(req.body)) {
    req.rawBody = req.body; // Store raw
    req.body = JSON.parse(req.body); // Then parse
  }
  next();
});
```

**Action:** Add raw body capture to webhook routes  
**Complexity:** Low | **Priority:** 🔴 CRITICAL (required for HMAC)

---

### 3. Webhook Event Storage + Idempotency
**What ChatGPT said:** Store events, reject duplicates via event_id  
**Status:** You need `webhook_events` table  
**My Assessment:** ✅ Correct. Essential for replay + debugging.

**Schema:**
```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  external_event_id TEXT,  -- Carrier's event_id
  source VARCHAR(50),      -- 'carrier_bluedart', 'warehouse_tata', etc.
  event_type VARCHAR(100), -- 'tracking_update', 'order_imported'
  payload_json JSONB,
  signature_valid BOOLEAN,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  status ENUM('queued', 'processing', 'completed', 'failed'),
  retry_count INT DEFAULT 0,
  UNIQUE(organization_id, external_event_id) -- Prevent duplicates
);
```

**Action:** Add webhook_events table + duplicate check  
**Complexity:** Low | **Priority:** 🔴 CRITICAL (prevents data duplication)

---

### 4. Webhook Error Handling: ACK Fast Strategy
**What ChatGPT said:** Store event, queue job, return 200 immediately  
**Status:** Your current code probably processes sync  
**My Assessment:** ✅ Correct. External systems timeout after 2 seconds.

**Pattern:**
```javascript
// Webhook route
export const webhookOrderImported = asyncHandler(async (req, res) => {
  // 1. Validate signature (done by middleware)
  // 2. Store event
  const event = await storeWebhookEvent(req.body, req.organization_id);
  
  // 3. Enqueue async job
  await jobQueue.add('processWebhookEvent', event);
  
  // 4. ACK immediately (before job runs)
  res.status(200).send('received');
  
  // Worker processes async → updates DB, creates orders, etc.
});
```

**Why:** If you process sync, carrier retries → duplicate events spam your system  
**Action:** Restructure webhook routes to ACK fast  
**Complexity:** Medium | **Priority:** 🔴 CRITICAL (prevents retries/duplicates)

---

## 🟠 IMPORTANT — Shipments Module Architecture

### 5. Shipment State Machine (NOT URGENT, Pattern is Good)
**What ChatGPT said:** Strict state transitions (CREATED → ASSIGNED → PICKED_UP → ...) 
**Status:** Your shipments controller probably allows any status update  
**My Assessment:** ✅ Pattern is correct for enterprise. NOT urgent given current build state.

**When to implement:**
- BEFORE shipping tracking logic
- BEFORE carrier integrations
- BEFORE customer-facing tracking page

**For now:** Document the state flow in DESIGN.md  
**Action:** Add `ShipmentStatusService` validation when building full shipment lifecycle  
**Complexity:** Medium | **Priority:** 🟡 MEDIUM (implement before integrations)

---

### 6. Append-Only Tracking Events (GOOD PATTERN)
**What ChatGPT said:** "Never UPDATE shipment status. Instead, INSERT tracking_event."  
**Status:** You probably UPDATE shipment.status directly  
**My Assessment:** ✅ Correct for audit trail + historical accuracy. FUTURE upgrade.

**Schema Pattern:**
```sql
CREATE TABLE shipments (
  id UUID PRIMARY KEY,
  status VARCHAR(50), -- current state
  ...
);

CREATE TABLE shipment_tracking_events (
  id UUID PRIMARY KEY,
  shipment_id UUID,
  status VARCHAR(50),
  location JSONB,
  event_source VARCHAR(50), -- 'carrier', 'manual', 'system'
  timestamp TIMESTAMPTZ,
  carrier_scan_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- shipment.status = latest event status
-- Full history in shipment_tracking_events
```

**When to implement:** LATER when you need logistics audit trail  
**Action:** NOT urgent. Document in DESIGN.md  
**Complexity:** High | **Priority:** 🟡 MEDIUM (future upgrade)

---

### 7. Route Calculation as Async Worker
**What ChatGPT said:** "Calculate route async, return job_id, don't compute sync"  
**Status:** Your `calculate-route` endpoint probably computes sync  
**My Assessment:** ✅ Good scaling pattern. NOT urgent now.

**When to implement:** If route calculation becomes slow (>500ms)  
**For now:** Document as optimization point in DESIGN.md  
**Action:** Skip. Add if profiling shows bottleneck.  
**Complexity:** Medium | **Priority:** 🟢 LOW (optimization, not blocking)

---

## 🟡 GOOD PATTERNS — SLA & Exception Management (FUTURE)

### 8. SLA Violation Detection as Background Worker
**What ChatGPT said:** "Don't compute violations in API. Background worker scans shipments."  
**Status:** SLA module not yet built  
**My Assessment:** ✅ Correct architecture. This is FUTURE.

**Pattern (for later):**
```javascript
// Worker runs every 5 minutes
everyMinutes(5, async () => {
  // Scan active shipments
  const shipments = await getActiveShipments();
  
  // For each, check against SLA policy
  for (const s of shipments) {
    const policy = await getSlaPolicy(s.organization_id);
    const violation = checkViolation(s, policy);
    
    if (violation) {
      await createSlaViolation(s.id, policy.id);
      emit('SlaViolationDetected', s.id);
    }
  }
});
```

**When to implement:** When SLA module goes live  
**Action:** Document pattern, implement later  
**Complexity:** Medium | **Priority:** 🟠 LOW (future module)

---

### 9. ETA Prediction Precomputation (FUTURE)
**What ChatGPT said:** "Don't compute ETA live. Use background snapshot."  
**Status:** You probably have static ETA  
**My Assessment:** ✅ Correct for scale. FUTURE enhancement.

**Pattern:**
```sql
-- Current: queryable ETA
shipments.estimated_delivery_date

-- Future: Precomputed snapshot
CREATE TABLE shipment_eta_snapshots {
  shipment_id UUID,
  eta_timestamp TIMESTAMPTZ,
  confidence_score DECIMAL,
  updated_at TIMESTAMPTZ
};
```

**When to implement:** When ETA becomes complex (ML-based)  
**Action:** Skip for now. Document for future.  
**Complexity:** High | **Priority:** 🟢 LOW (future)

---

## 🟡 IMPORTANT — Auth & User Management Upgrades

### 10. Session Table for Token Revocation (GOOD IDEA)
**What ChatGPT said:** "Store sessions in DB, revoke by session_id"  
**Status:** You likely use JWT without session tracking  
**My Assessment:** ✅ Good for logout + device management. Moderate urgency.

**Implementation Priority:** MEDIUM
- ✅ Enables logout (revoke session)
- ✅ Enables device management ("log out from other devices")
- ⚠️ Adds DB query to every authenticated request (cache mitigates)

**Schema:**
```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY,
  user_id UUID,
  refresh_token_hash VARCHAR(255),
  device_type VARCHAR(50),
  ip_address INET,
  last_seen TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Action:** Add when implementing logout fixes  
**Complexity:** Medium | **Priority:** 🟡 MEDIUM (improves UX + security)

---

### 11. Refresh Token Rotation (GOOD SECURITY PATTERN)
**What ChatGPT said:** "On refresh, invalidate old token, issue new one"  
**Status:** Your current code probably doesn't rotate  
**My Assessment:** ✅ Correct security practice (prevents replay attacks).

**Pattern:**
```javascript
export const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  
  // Validate old token
  const session = await validateRefreshToken(refreshToken);
  
  // Invalidate old token
  await invalidateSession(session.id);
  
  // Issue new tokens
  const newSession = await createSession(session.user_id, req.ip);
  const newAccessToken = jwt.sign(...);
  const newRefreshToken = jwt.sign(...);
  
  res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
};
```

**Action:** Implement when fixing token architecture  
**Complexity:** Medium | **Priority:** 🟡 MEDIUM (security best practice)

---

### 12. Password Rules + Breach Checking (CAN SKIP EARLY)
**What ChatGPT said:** "Add bcrypt, check breach database, password history"  
**Status:** You probably have basic bcrypt. Breach checking is extra.  
**My Assessment:** ✅ Good practice for enterprise. NOT urgent for MVP.

**When to implement:** Before SaaS customers  
**Complexity:** Low | **Priority:** 🟢 LOW (nice-to-have)

---

## 🟢 ALREADY DOING WELL — Auth

### ✅ Multi-tenant Access Guarantee
**What ChatGPT said:** "Never accept org_id from request body. Derive from token."  
**Your code:** You already do this (`injectOrgContext` pulls from token)  
**My Assessment:** ✅ Excellent security design. Keep it.

---

## 📊 Summary: Actionable from Found.txt Round 2

| Module | Finding | Status | Urgency | Action |
|--------|---------|--------|---------|--------|
| **Webhooks** | Missing HMAC signature | 🔴 Blocking | NOW | Add verifyWebhookSignature middleware |
| **Webhooks** | Raw body not captured | 🔴 Blocking | NOW | Add express.raw() middleware |
| **Webhooks** | No idempotency check | 🔴 Blocking | NOW | Add webhook_events table + UNIQUE constraint |
| **Webhooks** | Processing sync (should be async) | 🔴 Blocking | THIS WEEK | Restructure to ACK → queue → async process |
| **Shipments** | State machine missing | 🟡 Good pattern | BEFORE INTEGRATIONS | Document, implement when needed |
| **Shipments** | Tracking not append-only | 🟡 Design pattern | MEDIUM TERM | Upgrade when audit needed |
| **SLA** | Violation detection | 🟡 Architecture | FUTURE | Design when SLA module built |
| **Auth** | Session management | 🟡 Enhancement | SOON | Add user_sessions table + logout logic |
| **Auth** | Token rotation | 🟡 Security | MEDIUM | Implement refresh rotation |

---

## ❓ QUICK QUESTIONS FOR YOU

1. **Webhooks:** Are you accepting ANY webhooks currently, or is this future?
2. **Session Management:** Do you have logout implemented? Does it work?
3. **Shipments:** Is this full implementation or MVP version?

These answers help reprioritize further tasks.

---

# 📋 ROUND 3 ANALYSIS — Validation Schemas (Critical Security Review)

**Input Source:** found.txt Round 3  
**Focus:** Validation layer + schema security across all modules  
**Critical Findings:** Multiple HIGH-SEVERITY security holes in schema validation

---

## 🔴 CRITICAL SECURITY ISSUES

### 1. Order Financial Totals NOT Recalculated Server-Side ⚠️ URGENT
**Issue:** Order totals (`subtotal`, `total_amount`, `tax`) likely trusted from client  
**Risk:** 💰 Customers bypass pricing; financial records corrupted  
**ChatGPT Identified:** "Treat as hints only. Recalculate from product catalog."

**Current Code:** Need to verify [ordersController.js](backend/controllers/ordersController.js)

**Correct Pattern:**
```javascript
// Server recalculates EVERYTHING
const items = req.validated.body.items.map(item => {
  const product = await getProduct(item.product_id); // FROM DB
  return {
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: product.unit_price, // NOT from client
    tax: calculateTax(product, item.quantity),
    discount: applyPromo(item, customer)
  };
});
order.total_amount = SUM(items) + tax; // COMPUTED, never client value
```

**Action Required:**
- [ ] Check if `createOrderSchema` or controller trusts client totals
- [ ] If yes: refactor to recalculate server-side
- [ ] Add mismatch detection: warn if client total vs calculated differs >5%

**Complexity:** Medium | **Priority:** 🔴 CRITICAL NOW

---

### 2. Users Can Set Own Role on Registration (Privilege Escalation) ⚠️ URGENT
**Issue:** Registration endpoint probably allows client to set `role: 'admin'`  
**Risk:** 🚨 Privilege escalation — anyone can register as SUPERADMIN  
**Current State:** Need to verify user schemas

**Correct Pattern:**
```javascript
export const registerUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
  // NO role field!
});

// Server code:
user.role = 'user'; // ALWAYS default for self-registration
// Only superadmin can create admin users via different endpoint
```

**Action Required:**
- [ ] Check if your user validator allows `role` in registration
- [ ] If yes: remove immediately
- [ ] Ensure role always defaults to 'user'
- [ ] Only superadmin via separate `createOrgUser` endpoint can set roles

**Complexity:** Low | **Priority:** 🔴 CRITICAL NOW

---

### 3. No Mass Assignment Protection (Universal Vulnerability)
**Issue:** Controllers likely accept entire `req.body` without filtering  
**Risk:** Attackers inject unexpected fields (e.g., `is_admin: true`, `organization_id: HACKER_ORG`, `deleted_at: time`)  
**Current:** All endpoints probably vulnerable

**Correct Pattern:**
```javascript
// BAD — accept everything:
const order = await Order.create(req.body);

// GOOD — only validated:
const validated = await createOrderSchema.validateAsync(req.body, { 
  stripUnknown: true  // Remove unexpected fields
});
const order = await Order.create(validated);
```

**Action Required:**
- [ ] Add `stripUnknown: true` to ALL Joi validate() calls
- [ ] Never use `req.body` directly in controllers
- [ ] Create strict policy: "Controllers ONLY access req.validated.*"
- [ ] Code review: scan for direct req.body usage

**Complexity:** Low | **Priority:** 🔴 CRITICAL THIS WEEK

---

## 🟠 HIGH PRIORITY — Schema Fixes (Find & Fix Fast)

### 4. Inventory: Remove `reserved_quantity` From Client Input
**Current Code:** [inventorySchemas.js line 20](backend/validators/inventorySchemas.js#L20)  
**Problem:** Reserved quantities should ONLY be controlled by order system  
**Fix:** Delete this line:
```javascript
// DELETE:
reserved_quantity: Joi.number().integer().min(0).optional().default(0),
```

**Complexity:** 5 min | **Priority:** 🟠 THIS WEEK

---

### 5. Inventory: Enforce Product XOR (Either ID OR Name)
**Current:** Client can send both `product_id` AND `product_name` (ambiguous)  
**Fix:** Add external validation to createInventorySchema
```javascript
.external(async (obj) => {
  const hasId = !!obj.product_id;
  const hasName = !!obj.product_name;
  if (!hasId && !hasName) throw new Error('Must provide either product_id or product_name');
  if (hasId && hasName) throw new Error('Cannot provide both');
})
```

**Complexity:** 15 min | **Priority:** 🟠 THIS WEEK

---

### 6. Order: Remove `status` From Create Schema
**Current:** Client can probably set initial status  
**Fix:** Remove `status` field from `createOrderSchema`  
**Reason:** Status lifecycle is server-controlled (CREATED → ALLOCATED → SHIPPED...)

**Complexity:** 5 min | **Priority:** 🟠 THIS WEEK

---

### 7. Return: Remove `status` + `refund_amount` From Create
**Current:** Both probably client-provided  
**Fix:** Remove both from `createReturnSchema`  
**Reason:** Refund decided AFTER inspection, status managed server-side

**Complexity:** 10 min | **Priority:** 🟠 THIS WEEK

---

## 🟡 GOOD PATTERNS — Implement Next (Not Urgent)

### 8. Standardize to req.validated
**Currently:** Validation middleware scattered  
**Better:** Always use `req.validated.body`, `req.validated.query`, `req.validated.params`

**Complexity:** Medium | **Priority:** 🟡 NEXT CHECKPOINT

---

### 9. Add Param Validation
**Currently:** URL params (`:id`) not validated  
**Add:** UUID validation schemas for all ID parameters

**Complexity:** Low | **Priority:** 🟡 NEXT CHECKPOINT

---

### 10. Centralize Error Responses
**Currently:** Validation errors formatted differently per route  
**Add:** Global error handler for consistent JSON responses

**Complexity:** Low | **Priority:** 🟡 NEXT CHECKPOINT

---

## 📊 Validation Security Priority Matrix

| Issue | Type | Severity | Est. Fix Time | Your Action |
|-------|------|----------|----------------|-------------|
| Order totals trusted from client | Financial | 🔴 CRITICAL | 1-2 hrs | Audit creationOrder logic |
| Client can set own role | Privilege | 🔴 CRITICAL | 30 min | Check + remove from registerUserSchema |
| No stripUnknown on schemas | Injection | 🔴 CRITICAL | 2-3 hrs | Add to all Joi validations |
| reserved_quantity from client | Data | 🟠 HIGH | 5 min | Delete line 20 inventorySchemas.js |
| Status settable on create | Logic | 🟠 HIGH | 10 min | Remove from all "create" schemas |
| No param validation | Input | 🟡 MEDIUM | 1 hr | Create UUID schema |
| req.body used directly | Pattern | 🔴 CRITICAL | Code review | Search + replace with req.validated |

---

## ❓ QUESTIONS FOR YOU (Answer Asap)

1. **Does your `registerUserSchema` include a `role` field that users can set?**
2. **Does your order controller recalculate totals server-side or trust client values?**
3. **Are any controllers using `req.body` directly (not through req.validated)?**

These answers determine if you have data corruption + security vulnerabilities live.

---

# 📋 ROUND 4 ANALYSIS — Warehouse Schemas, Transactions, JWT, Logger

**Input Source:** found.txt Round 4  
**Scope:** Warehouse validation schemas, dbTransaction utility, JWT auth utility, logger config  
**Critical Findings:** JWT fallback secrets + warehouse schema trust issues

---

## 🔴 CRITICAL SECURITY ISSUES

### 1. JWT Fallback Secrets (Immediate Removal Required)
**Current Code:** [backend/utils/jwt.js](backend/utils/jwt.js) uses `process.env.JWT_SECRET || 'fallback-secret-key'`  
**Risk:** In production, if env var missing, system silently runs with known secret → full auth bypass  
**Decision:** ChatGPT is correct. This is a real security hole.

**Fix Pattern:**
```javascript
if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT secrets missing. Refusing to start.');
}
```

**Action:** Remove fallback secrets and fail-fast on startup  
**Complexity:** Low | **Priority:** 🔴 CRITICAL NOW

---

### 2. Warehouse Schema Allows Client to Set `current_utilization`
**Current Code:** [backend/validators/warehouseSchemas.js](backend/validators/warehouseSchemas.js) allows `current_utilization` in create + update  
**Risk:** Clients can override utilization % and break capacity dashboards  
**Decision:** This should be server-controlled only.

**Action:** Remove `current_utilization` from create/update schema or restrict to admin-only  
**Complexity:** Low | **Priority:** 🔴 HIGH (data integrity)

---

## 🟠 IMPORTANT SCHEMA FIXES

### 3. Warehouse `is_active` Should Not Be Client-Set on Create
**Current Code:** createWarehouseSchema has `is_active` default true  
**Decision:** If you want admins to control activation at creation, keep it but gate by permission.  
If creation is always active by default, remove from client input.

**Recommendation:** Remove from create schema; only allow update by admin route  
**Complexity:** Low | **Priority:** 🟠 MEDIUM

---

### 4. Warehouse `manager_id` Type Mismatch
**Current Code:** `manager_id` is number/integer but users are UUIDs  
**Risk:** Validation allows invalid IDs → runtime errors or silent no-op  
**Decision:** Use UUID and enforce org ownership in service layer.

**Action:** Change `manager_id` to Joi UUID  
**Complexity:** Low | **Priority:** 🟠 MEDIUM

---

### 5. Warehouse `country` Should Be ISO-2
**Current Code:** defaults to `India` (string)  
**Decision:** If UI expects country names, keep as-is for now. If you want strict ISO for future integrations, change to 2-letter codes.

**Action:** Decide whether to enforce ISO-2 now or later.  
**Complexity:** Low | **Priority:** 🟡 LOW (future interoperability)

---

## 🟡 TRANSACTION UTILITY — MOSTLY OK

### 6. Transaction Utility Observations
**File:** [backend/utils/dbTransaction.js](backend/utils/dbTransaction.js)

**Good:**
- Begin/commit/rollback logic is sound
- Retry logic handles deadlocks
- Rollback ensures release

**Potential Issues (Not urgent):**
- No protection against nested transactions (if service calls service)
- Rollback logs full stack; may duplicate global error handler logs
- Retry delay has no jitter (can cause stampede)

**Decision:** Not critical right now. Keep as-is unless nested service usage grows.

---

## 🟡 LOGGER CONFIG — NO CRITICAL ISSUES FOUND

### 7. Logger config appears solid
**File:** [backend/utils/logger.js](backend/utils/logger.js)
**No urgent issues detected.**
Potential future improvements only:
- Avoid logging sensitive tokens in auth logs
- Ensure log directories exist in production

---

## 📊 Actionable Summary — Round 4

| Issue | Severity | Action |
|------|----------|--------|
| JWT fallback secrets | 🔴 CRITICAL | Remove fallback, fail fast on startup |
| current_utilization client writable | 🔴 HIGH | Remove from warehouse schemas |
| is_active on create | 🟠 MEDIUM | Remove or restrict to admin |
| manager_id type mismatch | 🟠 MEDIUM | Change to UUID |
| country ISO-2 enforcement | 🟡 LOW | Decide for future integrations |

---

## ❓ Questions for You (Quick)

1. Do you want `is_active` settable during warehouse creation, or always default true?
2. Are you okay enforcing ISO-2 country codes now, or keep free text for UI simplicity?

---

# Round 5 — Middleware Audit

**Files Reviewed:** `middlewares/webhookAuth.js`, `middlewares/multiTenant.js`, `middlewares/rbac.js`, `middlewares/requestLogger.js`, `utils/jwt.js` (re-verification)

**Methodology:** All ChatGPT findings verified against actual source code before inclusion. Claims that did not match the codebase are documented under Omissions with reasons.

---

## 🔴 TASK-R5-001 — Webhook HMAC Signs Parsed Body, Not Raw Bytes

**File:** `backend/middlewares/webhookAuth.js`, line ~184  
**Severity:** Critical Bug  
**ChatGPT Claim:** Verified ✅ — code signs `JSON.stringify(req.body)`, not the original raw bytes.

**Problem:**  
Express's `json()` middleware parses the body before `webhookAuth` runs. `JSON.stringify(req.body)` produces a re-serialized string that may differ from the original payload in:
- Key ordering (no guarantee)
- Unicode escaping
- Whitespace normalization
- Number precision edge cases

This causes valid webhooks to fail signature verification intermittently, and allows invalid webhooks to bypass verification if they can predict how Express will re-serialize.

**Confirmed Code (line ~184):**
```js
const hmac = crypto.createHmac('sha256', secret);
hmac.update(JSON.stringify(req.body)); // ← BUG: re-serialized, not raw
```

**Fix:**  
Capture raw bytes in Express's `verify` callback before the body is parsed:
```js
// In server.js or app setup:
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf; // Buffer of original bytes
  }
}));

// In webhookAuth.js:
hmac.update(req.rawBody); // ← sign raw bytes, not re-serialized JSON
```

**Context:** This is the standard pattern used by Stripe, GitHub, and every major webhook provider. It is the only way to guarantee byte-identical HMAC verification.

---

## 🔴 TASK-R5-002 — `timingSafeEqual` Called Without Buffer Length Guard

**File:** `backend/middlewares/webhookAuth.js`, line ~195  
**Severity:** High — Crash vector  
**ChatGPT Claim:** Verified ✅

**Problem:**  
`crypto.timingSafeEqual(a, b)` throws a `TypeError` if the two buffers have different lengths. An attacker or misconfigured client sending a truncated/padded `X-Webhook-Signature` header will crash the middleware, causing a 500 and potentially leaking stack information or disrupting other requests.

**Confirmed Code (line ~195):**
```js
// No length check before this:
if (!crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
  // ...
}
```

**Fix:**
```js
if (
  expectedBuf.length !== receivedBuf.length ||
  !crypto.timingSafeEqual(expectedBuf, receivedBuf)
) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

**Note:** The length check must come first (short-circuit). Comparing lengths before buffers does not introduce a timing oracle because the lengths of HMAC output are deterministic (always 64 hex chars for SHA-256).

---

## 🔴 TASK-R5-003 — `req.user.id` Used in `companiesController.js` Inconsistently

**File:** `backend/controllers/companiesController.js`, lines 42, 167, 220, 264  
**Severity:** Medium — Silent wrong-field logging  
**ChatGPT Claim:** Verified ✅

**Problem:**  
The JWT decode sets `req.user.userId` (not `req.user.id`). Every other controller and middleware (`rbac.js`, `multiTenant.js`, `usersController.js`, etc.) consistently accesses `req.user.userId`. `companiesController.js` uses `req.user.id` in its audit log calls, silently emitting `undefined` for the performer field.

**Impact:**
- Audit logs for all superadmin company operations have `undefined` as the acting user
- Any future security review of company-level actions will show no attributable actor
- No runtime crash or observable error, making this easy to miss in tests

**Fix:** Replace all occurrences in `companiesController.js`:
```js
// Before:
req.user.id
// After:
req.user.userId
```

Search scope: `grep -n 'req\.user\.id[^e]' backend/controllers/companiesController.js` to find all instances.

---

## 🟡 TASK-R5-004 — `multiTenant.js` Issues DB Query on Every Authenticated Request

**File:** `backend/middlewares/multiTenant.js`  
**Severity:** Medium — Performance / scalability  
**ChatGPT Claim:** Verified ✅

**Problem:**  
On every authenticated request, `multiTenant.js` runs:
```sql
SELECT organization_id FROM users WHERE id = $1
```
to determine the user's org context. At low volume this is invisible. At moderate scale (e.g. 50 concurrent users polling dashboards every 30s) this is ~100 additional DB queries/minute that return the same data until the user is reassigned.

**The org assignment for a user changes extremely rarely** (org migration, superadmin reassignment) — making per-request DB lookup wasteful.

**Fix — Embed `organization_id` in JWT at login:**
```js
// In authService / login handler:
const token = jwt.sign({
  userId: user.id,
  organizationId: user.organization_id, // ← add this
  role: user.role,
}, process.env.JWT_SECRET, { expiresIn: '24h' });
```

```js
// In multiTenant.js:
// Instead of DB query:
req.organizationId = req.user.organizationId; // from JWT payload
```

**Trade-off:** If a user's org is changed, old tokens remain valid until expiry (max 24h). For a supply chain platform where org reassignment is an admin-only exceptional operation, this is an acceptable trade-off. Add org change to the token revocation/invalidation mechanism if you have one.

---

## 🟡 TASK-R5-005 — `requestLogger.js` Uses Weak Request ID Generation

**File:** `backend/middlewares/requestLogger.js`  
**Severity:** Low — Correctness / observability  
**ChatGPT Claim:** Verified ✅

**Problem:**  
Request IDs are generated as:
```js
const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

This is not a UUID and not guaranteed unique under load:
- `Date.now()` has millisecond resolution — multiple requests in the same ms share the same prefix
- `Math.random()` with 9 base-36 chars gives ~10⁻⁷ collision probability per ms — acceptable in dev, not in prod under load
- The format is non-standard and won't be parsed by log aggregators expecting UUID v4

**Fix:**
```js
const { randomUUID } = require('crypto');
const requestId = req.headers['x-request-id'] || randomUUID();
```

Honouring an incoming `x-request-id` header also enables trace propagation from frontend → backend → logs without extra tooling.

---

## 🟡 TASK-R5-006 — `requestLogger.js` Does Not Log Aborted / Dropped Connections

**File:** `backend/middlewares/requestLogger.js`  
**Severity:** Low — Observability gap  
**ChatGPT Claim:** Partially correct — missing `close` listener is real, though the claim overstated severity

**Problem:**  
Only `res.on('finish', ...)` is attached. The `finish` event does not fire for:
- Requests where the client disconnects before a response is sent
- Requests killed by a reverse proxy timeout (nginx/ALB)
- Requests that error before the response stream closes

These are often the most interesting cases for debugging production issues (client impatience, slow queries, network resets).

**Fix — Add `close` listener alongside `finish`:**
```js
let logged = false;
const logOnce = (event) => {
  if (logged) return;
  logged = true;
  const duration = Date.now() - start;
  logger.info({
    requestId,
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    duration,
    event, // 'finish' or 'close'
    userId: req.user?.userId,
  });
};

res.on('finish', () => logOnce('finish'));
res.on('close', () => logOnce('close'));
```

---

## ❌ Omitted from ChatGPT Round 5 (with Reasons)

| Claim | Verdict | Why Omitted |
|-------|---------|-------------|
| "ADMIN role has `*:*` global access across all operations" | ❌ WRONG | `ADMIN → ['*']` expands to `ALL_PERMISSIONS` only. `SUPERADMIN_PERMISSIONS` are explicitly separate and excluded. System is correctly scoped. |
| "Two RBAC systems exist in parallel" | ❌ WRONG | One authoritative system: `requirePermission()` importing from `config/permissions.js`. An older inline `PERMISSIONS` map exists inside `rbac.js` as legacy duplication, but there is no competing second enforcement system. |
| "`buildOrgFilter` has a `$1` placeholder formatting bug" | ❌ NOT FOUND | This function does not exist in the current codebase. Likely hallucinated based on general pattern matching. |
| "Add Postgres RLS as second enforcement layer" | Skipped | Valid in theory, but enforcing multi-tenancy at the DB layer adds significant ops complexity (per-user roles, session variables) that is not appropriate for current architecture and team size. Application-layer enforcement is sufficient when the middleware chain is trusted. |
| "Embed full permission snapshot in JWT to avoid DB lookups" | Skipped | Over-engineering. JWT bloat for potentially 50+ permissions per role. Permission changes require either token revocation infrastructure or accepting stale permissions until expiry. DB lookup on permission check (not per request) is the right trade-off here. |
| "Implement full idempotency middleware for all state-changing endpoints" | Deferred | Carrier assignments already have `idempotency_key`. Global idempotency middleware is a valid future investment but is a product decision (what to do on duplicate: return cached response? return 409?). Not a bug — defer to a dedicated spike. |
| "Add log sampling (1–5% of normal traffic)" | Skipped | Dev phase — full logging is appropriate. Sampling is a cost optimization for high-volume production. Revisit when log storage costs become a concern. |
| "Implement OpenTelemetry / distributed trace propagation" | Deferred | `x-request-id` header forwarding (TASK-R5-005) is the pragmatic first step. Full OTEL is a future enterprise concern and requires infrastructure changes beyond the backend codebase. |

---

## 📊 Actionable Summary — Round 5

| Task | File | Severity | Action |
|------|------|----------|--------|
| TASK-R5-001 | `webhookAuth.js` | 🔴 CRITICAL | Capture rawBody in express.json verify callback; sign raw bytes |
| TASK-R5-002 | `webhookAuth.js` | 🔴 HIGH | Add buffer length check before `timingSafeEqual` |
| TASK-R5-003 | `companiesController.js` | 🔴 MEDIUM | Replace `req.user.id` → `req.user.userId` (4 spots) |
| TASK-R5-004 | `multiTenant.js` | 🟡 MEDIUM | Embed `organizationId` in JWT; remove per-request DB lookup |
| TASK-R5-005 | `requestLogger.js` | 🟡 LOW | Replace `Date.now()+random` with `crypto.randomUUID()` |
| TASK-R5-006 | `requestLogger.js` | 🟡 LOW | Add `res.on('close')` with dedup flag alongside `finish` |

---


