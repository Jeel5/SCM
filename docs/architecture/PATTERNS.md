# Architecture Fix Patterns
> Code examples for tasks in [ARCHITECTURE_TASKS.md](ARCHITECTURE_TASKS.md).
> Each section is keyed to a Task ID.

---

## TASK-R1-003 / TASK-R1-004 — Inventory Atomicity

```javascript
// Wrap transferInventory and adjustStock in withTransaction
await withTransaction(async (tx) => {
  await InventoryRepository.deductStock(fromWarehouse, sku, qty, orgId, tx);
  await InventoryRepository.addStock(toWarehouse, sku, qty, orgId, tx);
  // Both succeed or both roll back
});
```

---

## TASK-R2-001 — Webhook HMAC Signature Verification

```javascript
// middlewares/verifyWebhookSignature.js
const crypto = require('crypto');
export const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET;
  const hash = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
  if (hash !== signature) return res.status(401).json({ error: 'Invalid signature' });
  next();
};
```

---

## TASK-R2-002 — Raw Body Capture

```javascript
// server.js — before any route registration
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));
```

---

## TASK-R2-003 — Webhook Events Table

```sql
CREATE TABLE webhook_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL,
  external_event_id TEXT,
  source            VARCHAR(50),
  event_type        VARCHAR(100),
  payload_json      JSONB,
  signature_valid   BOOLEAN,
  received_at       TIMESTAMPTZ DEFAULT NOW(),
  processed_at      TIMESTAMPTZ,
  status            VARCHAR(20) DEFAULT 'queued',
  retry_count       INT DEFAULT 0,
  UNIQUE (organization_id, external_event_id)
);
```

---

## TASK-R2-004 — Webhook ACK Fast Pattern

```javascript
export const handleWebhook = asyncHandler(async (req, res) => {
  const event = await WebhookEventRepository.store(req.body, req.organizationId);
  await jobQueue.add('processWebhookEvent', { eventId: event.id });
  res.status(200).send('received'); // Must respond before processing
});
```

---

## TASK-R2-007 — User Sessions Table

```sql
CREATE TABLE user_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL,
  device_type        VARCHAR(50),
  ip_address         INET,
  last_seen          TIMESTAMPTZ,
  revoked_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TASK-R2-008 — Refresh Token Rotation

```javascript
export const refreshToken = async (req, res) => {
  const session = await validateRefreshToken(req.body.refreshToken);
  await invalidateSession(session.id);                // invalidate old
  const newSession = await createSession(session.user_id, req.ip);
  res.json({ accessToken: newJwt(newSession), refreshToken: newSession.token });
};
```

---

## TASK-R3-001 — Server-Side Order Total Recalculation

```javascript
const items = await Promise.all(req.validated.body.items.map(async item => {
  const product = await ProductRepository.findById(item.product_id, req.organizationId);
  return {
    product_id: item.product_id,
    quantity:   item.quantity,
    unit_price: product.unit_price,        // from DB, never from client
    tax:        calculateTax(product, item.quantity),
  };
}));
const total = items.reduce((s, i) => s + i.unit_price * i.quantity + i.tax, 0);
```

---

## TASK-R3-003 — Mass Assignment Protection

```javascript
// Add to every schema validateAsync call:
const validated = await schema.validateAsync(req.body, { stripUnknown: true, abortEarly: false });
// Controllers only access validated.*, never req.body directly
```

---

## TASK-R4-001 — JWT Fail-Fast on Missing Secrets

```javascript
// utils/jwt.js — top of file, executed at module load
if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error('FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be set. Refusing to start.');
}
```

---

## TASK-R5-001 — Sign Raw Bytes Not Re-serialized JSON

```javascript
// server.js
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

// webhookAuth.js — line ~184
hmac.update(req.rawBody);   // ✅ raw Buffer bytes
// NOT: hmac.update(JSON.stringify(req.body))  ← BUG
```

---

## TASK-R5-002 — timingSafeEqual Length Guard

```javascript
const expectedBuf = Buffer.from(expectedHash, 'hex');
const receivedBuf = Buffer.from(receivedHash, 'hex');
if (
  expectedBuf.length !== receivedBuf.length ||       // length first, no timing oracle
  !crypto.timingSafeEqual(expectedBuf, receivedBuf)
) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

---

## TASK-R5-004 — Embed organizationId in JWT (Remove Per-Request DB Query)

```javascript
// authService.js — login
const token = jwt.sign({
  userId: user.id,
  organizationId: user.organization_id,  // ← add this
  role: user.role,
}, process.env.JWT_SECRET, { expiresIn: '24h' });

// multiTenant.js — middleware
req.organizationId = req.user.organizationId; // read from token, no DB query
```

---

## TASK-R5-005 — Crypto UUID for Request IDs

```javascript
const { randomUUID } = require('crypto');
const requestId = req.headers['x-request-id'] || randomUUID();
res.setHeader('x-request-id', requestId); // propagate back to client
```

---

## TASK-R5-006 — Log Aborted Connections

```javascript
let logged = false;
const logOnce = (event) => {
  if (logged) return;
  logged = true;
  logger.info({ requestId, method: req.method, url: req.originalUrl,
                status: res.statusCode, duration: Date.now() - start,
                event, userId: req.user?.userId });
};
res.on('finish', () => logOnce('finish'));
res.on('close',  () => logOnce('close'));   // fires on dropped / aborted connections
```

---

## TASK-R6-001 — Fix exists() Signature

```javascript
// Before (BUG):
async exists(conditions, client = null) {
  const count = await this.count(conditions, client); // client mistakenly passed as organizationId
  return count > 0;
}
// After:
async exists(conditions, organizationId = undefined, client = null) {
  const count = await this.count(conditions, organizationId, client);
  return count > 0;
}
```

---

## TASK-R6-002 — Order By Whitelist (SQL Injection Fix)

```javascript
const ALLOWED_ORDER_FIELDS = ['created_at', 'updated_at', 'id', 'name']; // subclasses extend
const ALLOWED_ORDER_DIRS   = ['ASC', 'DESC'];
const safeField = ALLOWED_ORDER_FIELDS.includes(orderBy) ? orderBy : 'created_at';
const safeDir   = ALLOWED_ORDER_DIRS.includes(order?.toUpperCase()) ? order.toUpperCase() : 'DESC';
query += ` ORDER BY ${safeField} ${safeDir}`;
```

---

## TASK-R6-003 — buildOrgFilter Returning Complete Clause

```javascript
buildOrgFilter(organizationId, tableAlias = null, paramIndex = 1) {
  if (organizationId == null)
    return { clause: '', params: [], nextIndex: paramIndex };
  const col = tableAlias ? `${tableAlias}.organization_id` : 'organization_id';
  return { clause: `${col} = $${paramIndex}`, params: [organizationId], nextIndex: paramIndex + 1 };
}
// Caller:
const { clause, params, nextIndex } = this.buildOrgFilter(orgId, 'i', currentParamCount);
```

---

## TASK-R6-005 — CarrierAssignment Org Scoping via JOIN

```javascript
async findActiveByOrderId(orderId, organizationId, client = null) {
  const query = `
    SELECT ca.id, ca.status, ca.carrier_id
    FROM carrier_assignments ca
    JOIN orders o ON ca.order_id = o.id
    WHERE ca.order_id = $1
      AND o.organization_id = $2
      AND ca.status NOT IN ('rejected', 'cancelled')
  `;
  return (await this.query(query, [orderId, organizationId], client)).rows;
}
```

---

## TASK-R6-006 — Unique Partial Index for Double Assignment Prevention

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_carrier_assignment
  ON carrier_assignments (order_id)
  WHERE status NOT IN ('rejected', 'cancelled', 'expired');
-- Second INSERT on same order_id gets a unique violation → service catches → treats as "already assigned"
```

---

## TASK-R6-008 — Replace Correlated Subqueries with LEFT JOIN

```sql
SELECT c.*,
  COUNT(s.id)::int AS total_shipments,
  COUNT(s.id) FILTER (
    WHERE s.status NOT IN ('delivered', 'returned', 'cancelled')
  )::int AS active_shipments,
  AVG(s.actual_delivery_days)::numeric(10,2) AS avg_delivery_days
FROM carriers c
LEFT JOIN shipments s ON s.carrier_id = c.id
WHERE /* existing filters */
GROUP BY c.id
```

---

## TASK-R6-010 — Stock Mutations with Org Scope

```javascript
async reserveStock(sku, warehouseId, quantity, organizationId, client = null) {
  const query = `
    UPDATE inventory
       SET reserved_quantity  = reserved_quantity + $1,
           available_quantity = available_quantity - $1,
           updated_at         = NOW()
     WHERE sku = $2
       AND warehouse_id  = $3
       AND organization_id = $4          -- ← org scope
       AND available_quantity >= $1
    RETURNING *
  `;
  return (await this.query(query, [quantity, sku, warehouseId, organizationId], client)).rows[0] || null;
}
// Apply same pattern to: releaseStock, deductStock, addStock, markDamaged, updateInventoryItem
```

---

## TASK-R6-011 — Internalize recordMovement into Mutations

```javascript
async deductStock(sku, warehouseId, quantity, organizationId, meta = {}, client = null) {
  const updated = await this._updateStock(sku, warehouseId, quantity, organizationId, 'deduct', client);
  if (updated) {
    await this.recordMovement({
      organization_id: organizationId, warehouse_id: warehouseId,
      inventory_id: updated.id,        movement_type: meta.type   || 'outbound',
      quantity,                        reference_type: meta.refType || null,
      reference_id: meta.refId || null, created_by: meta.userId   || null,
    }, client);
  }
  return updated;
}
```

---

## TASK-R6-012 — Quantity Invariant CHECK Constraint

```sql
-- Run drift audit FIRST:
SELECT id, quantity,
       available_quantity + reserved_quantity + damaged_quantity + in_transit_quantity AS computed
  FROM inventory
 WHERE quantity != available_quantity + reserved_quantity + damaged_quantity + in_transit_quantity;

-- Then add constraint (will fail if any drift found above):
ALTER TABLE inventory
  ADD CONSTRAINT chk_quantity_invariant
    CHECK (quantity = available_quantity + reserved_quantity + damaged_quantity + in_transit_quantity);
```

---

## TASK-R6-013 — SELECT FOR UPDATE Before reserveStock

```javascript
// Callers MUST do this:
await withTransaction(async (tx) => {
  await tx.query(
    'SELECT id FROM inventory WHERE sku = $1 AND warehouse_id = $2 AND organization_id = $3 FOR UPDATE',
    [sku, warehouseId, orgId]
  );
  const reserved = await inventoryRepo.reserveStock(sku, warehouseId, qty, orgId, tx);
  if (!reserved) throw new AppError('Insufficient stock', 422);
});
```

---

## Round 1 Patterns — Finance, Superadmin, Org Lifecycle

### Finance Permissions (TASK-R1-020)
```javascript
// Dedicated finance permissions — never reuse settings.* for finance
const FINANCE_PERMISSIONS = [
  'finance.create_invoice', 'finance.update_invoice',
  'finance.process_refund', 'finance.resolve_dispute'
];
```

### Finance Ledger Table (TASK-R1-020)
```sql
CREATE TABLE ledger (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL,
  account_type   VARCHAR(50),
  amount         NUMERIC(15,2),
  reference_type VARCHAR(50),  -- 'invoice', 'refund', 'adjustment'
  reference_id   UUID,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
-- Every financial event: INSERT into ledger AND application table atomically
```

### Org Creation Atomicity (TASK-R1-012)
```javascript
await withTransaction(async (tx) => {
  const org  = await OrganizationRepository.create(orgData, tx);
  const user = await UserRepository.create({ ...adminData, organization_id: org.id, role: 'admin' }, tx);
  await RoleRepository.createDefaults(org.id, tx);
  await BillingRepository.createProfile(org.id, tx);
});
```

### Order State Machine (TASK-R1-007)
```
CREATED → ALLOCATED → PICKED → SHIPPED → DELIVERED → CLOSED
              ↑                    ↓
              └──── CANCELLED ─────┘
```

---

## TASK-R7-002 — Fix Hardcoded $2/$3 in OrderRepository

```javascript
// findOrderWithItems — replace hardcoded $2 with paramCount
async findOrderWithItems(orderId, organizationId = undefined, client = null) {
  let paramCount = 2; // orderId is $1
  const params = [orderId];
  // ...
  if (organizationId !== undefined) {
    const orgFilter = this.buildOrgFilter(organizationId, 'o');
    if (orgFilter.clause) {
      query += ` AND ${orgFilter.clause}$${paramCount++}`; // dynamic, not $2
      params.push(...orgFilter.params);
    }
  }
}
```

---

## TASK-R7-003 — createOrderWithItems Transaction Guard

```javascript
async createOrderWithItems(orderData, items, client) {
  if (!client) {
    throw new Error('createOrderWithItems MUST be called inside a transaction. Pass a transaction client.');
  }
  // ... rest of method
}
// Service layer:
await withTransaction(async (tx) => {
  const order = await orderRepo.createOrderWithItems(orderData, items, tx);
  await inventoryRepo.reserveStock(..., tx); // same transaction
});
```

---

## TASK-R7-004 — GIN Trigram Index for ILIKE Search

```sql
-- Required for orders, returns, shipments search columns
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_orders_search_trgm
  ON orders USING GIN (order_number gin_trgm_ops, customer_name gin_trgm_ops, customer_email gin_trgm_ops);

CREATE INDEX idx_returns_search_trgm
  ON returns USING GIN (return_number gin_trgm_ops, customer_email gin_trgm_ops);

CREATE INDEX idx_shipments_search_trgm
  ON shipments USING GIN (tracking_number gin_trgm_ops, carrier_name gin_trgm_ops);
```

---

## TASK-R7-005 — Separate COUNT Query (replace COUNT(*) OVER())

```javascript
// Instead of window function in main query:
// BAD: COUNT(*) OVER() as total_count  ← full scan every page

// GOOD: run count separately
async findOrders(filters, client = null) {
  const [dataResult, countResult] = await Promise.all([
    this.query(dataQuery, dataParams, client),
    this.query(`SELECT COUNT(*) FROM orders WHERE ${whereClause}`, countParams, client)
  ]);
  return {
    orders: dataResult.rows,
    totalCount: parseInt(countResult.rows[0].count)
  };
}
```

---

## TASK-R7-006 — Organization Code Generation Race Fix

```javascript
// Option A: retry loop with ON CONFLICT
async generateOrganizationCode(client = null) {
  const prefix = 'ORG';
  const year = new Date().getFullYear().toString().slice(-2);
  // Use DB sequence instead of COUNT:
  const result = await this.query(
    `SELECT nextval('org_code_seq_${year}') as seq`,
    [], client
  );
  return `${prefix}-${year}-${result.rows[0].seq.toString().padStart(3, '0')}`;
}
// OR use a simple retry:
// INSERT INTO organizations ... ON CONFLICT (code) DO NOTHING RETURNING *
// If no rows returned → retry with new code
```

---

## TASK-R7-007 — getOrganizationStats Replace Correlated Subqueries

```sql
-- Replace 4 correlated subqueries with one JOIN:
SELECT
  o.id,
  COUNT(DISTINCT u.id)  FILTER (WHERE u.is_active = true)  AS active_users,
  COUNT(DISTINCT w.id)  FILTER (WHERE w.is_active = true)  AS active_warehouses,
  COUNT(DISTINCT ord.id)                                    AS total_orders,
  COUNT(DISTINCT s.id)                                      AS total_shipments
FROM organizations o
LEFT JOIN users     u   ON u.organization_id  = o.id
LEFT JOIN warehouses w  ON w.organization_id  = o.id
LEFT JOIN orders    ord ON ord.organization_id = o.id
LEFT JOIN shipments s   ON s.organization_id  = o.id
WHERE o.id = $1
GROUP BY o.id
```

---

## TASK-R7-008 — Refund Idempotency Guard

```javascript
// In service layer before calling returnRepo.updateStatus:
async processRefund(returnId, orgId, refundAmount, tx) {
  // 1. Lock the row
  await tx.query('SELECT id, status, refund_amount FROM returns WHERE id = $1 FOR UPDATE', [returnId]);
  // 2. Check already refunded
  const current = await returnRepo.findById(returnId, orgId, tx);
  if (current.refund_amount != null) throw new AppError('Refund already issued for this return', 409);
  if (current.status !== 'inspected') throw new AppError('Return must be inspected before refund', 422);
  // 3. Cap against order value
  const order = await orderRepo.findById(current.order_id, orgId, tx);
  if (refundAmount > order.total_amount) throw new AppError('Refund exceeds order value', 422);
  // 4. Write
  return returnRepo.updateStatus(returnId, 'refunded', orgId, { refund_amount: refundAmount }, tx);
}
```

---

## TASK-R7-010 — Idempotent Tracking Events

```sql
-- Add unique constraint to prevent duplicate tracking rows:
ALTER TABLE shipment_tracking
  ADD CONSTRAINT uniq_tracking_event
    UNIQUE (shipment_id, carrier_status, event_time);
```

```javascript
// In addTrackingEvent — use ON CONFLICT DO NOTHING:
async addTrackingEvent(eventData, client = null) {
  const query = `
    INSERT INTO shipment_tracking
      (shipment_id, status, location, event_time, description, carrier_status)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (shipment_id, carrier_status, event_time) DO NOTHING
    RETURNING *
  `;
  // ...
}
```

---

## TASK-R7-012 — carrier_name Denormalization Fix

```javascript
// In getCarrierPerformance — join carriers table instead of grouping by name string:
async getCarrierPerformance(...) {
  const query = `
    SELECT
      s.carrier_id,
      c.name               AS carrier_name,  -- from carriers table, not denormalized string
      c.code               AS carrier_code,
      COUNT(*)             AS total_shipments,
      ...
    FROM shipments s
    JOIN carriers c ON c.id = s.carrier_id
    WHERE ...
    GROUP BY s.carrier_id, c.name, c.code
  `;
}
```

---

## TASK-R7-013 — Optimistic Locking for Shipment Updates

```sql
ALTER TABLE shipments ADD COLUMN version INT NOT NULL DEFAULT 0;
```

```javascript
// updateStatus with version check:
async updateStatus(shipmentId, status, expectedVersion, organizationId = undefined, ...) {
  const query = `
    UPDATE shipments
    SET status = $1, version = version + 1, updated_at = NOW()
    WHERE id = $2 AND version = $3   -- optimistic lock
    RETURNING *
  `;
  const result = await this.query(query, [status, shipmentId, expectedVersion], client);
  if (!result.rows[0]) throw new AppError('Shipment was modified by another process', 409);
  return result.rows[0];
}
```

---

## TASK-R8-001 — Tenant-Scoped Identity Lookups

```javascript
// findByEmail and findByUsername must scope by org
async findByEmail(email, organizationId, client = null) {
  const query = `SELECT * FROM users WHERE email = $1 AND organization_id = $2`;
  const result = await this.query(query, [email, organizationId], client);
  return result.rows[0] || null;
}
// Same pattern for findByUsername
```

---

## TASK-R8-002 — updatePassword Security Guards

```javascript
// Service layer — call before repo updatePassword
async changePassword(userId, orgId, oldPassword, newPassword) {
  const user = await userRepo.findById(userId, orgId);
  const valid = await bcrypt.compare(oldPassword, user.password_hash);
  if (!valid) throw new AppError('Current password incorrect', 401);

  const hash = await bcrypt.hash(newPassword, 12);
  await withTransaction(async (tx) => {
    await userRepo.updatePassword(userId, hash, tx);
    await userRepo.bumpTokenVersion(userId, tx);   // invalidates all existing JWTs
    await sessionRepo.revokeAll(userId, tx);        // invalidates session store entries
  });
}
```

---

## TASK-R8-003 — Token Invalidation on Deactivate

```javascript
// Add token_version column: ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0;

// In UserRepository — bump version on deactivate:
async deactivate(userId, organizationId = undefined, client = null) {
  let query = `
    UPDATE users
    SET is_active = false, token_version = token_version + 1, updated_at = NOW()
    WHERE id = $1
  `;
  // ... org filter ...
  return result.rows[0];
}

// In JWT verify middleware — add token_version check:
const user = await userRepo.findById(decoded.userId);
if (user.token_version !== decoded.tokenVersion) {
  return res.status(401).json({ error: 'Token has been revoked' });
}
```

---

## TASK-R8-014 — Add Org Filter to All Analytics Queries

```javascript
// analyticsController.js — get org from req user context
export async function getAnalytics(req, res) {
  const organizationId = req.user.organizationId; // from JWT via multiTenant middleware
  if (!organizationId) return res.status(403).json({ error: 'Organization context required' });

  // Add to EVERY query:
  const ordersOverTime = await pool.query(`
    SELECT ...
    FROM orders
    WHERE created_at >= NOW() - INTERVAL '${interval}'
      AND organization_id = $1          -- ← required for every query
    GROUP BY ...
  `, [organizationId]);
  // Apply same pattern to all 8 queries
}
```

---

## TASK-R8-015 — Parallel Analytics Queries

```javascript
// Replace sequential awaits with Promise.all:
const [
  ordersOverTime,
  shipmentsByCarrier,
  topProducts,
  warehouseUtil,
  slaViolations,
  exceptionsByType,
  returnsAnalysis,
  financialMetrics
] = await Promise.all([
  pool.query(ordersQuery, [orgId]),
  pool.query(shipmentQuery, [orgId]),
  pool.query(productsQuery, [orgId]),
  pool.query(warehouseQuery, [orgId]),
  pool.query(slaQuery, [orgId]),
  pool.query(exceptionsQuery, [orgId]),
  pool.query(returnsQuery, [orgId]),
  pool.query(financialQuery, [orgId]),
]);
// All 8 queries execute concurrently — latency becomes MAX(individual) not SUM(all)
```

---

## TASK-R8-016 — Parameterize INTERVAL

```javascript
// BAD — string interpolation even from internal map:
// WHERE created_at >= NOW() - INTERVAL '${interval}'

// GOOD — use proper interval cast with parameterized value:
const intervalMap = { day: '1 day', week: '7 days', month: '30 days', year: '1 year' };
const safeInterval = intervalMap[range] || '30 days';
// Then in query:
`WHERE created_at >= NOW() - $1::interval`
// params: [safeInterval]
```

---

## TASK-R8-019 — Reject Client-Supplied carrierId

```javascript
// acceptAssignment / rejectAssignment — only accept authenticated carrier
export const acceptAssignment = asyncHandler(async (req, res) => {
  if (!req.authenticatedCarrier?.id) {
    return res.status(401).json({ error: 'Carrier webhook authentication required' });
  }
  const carrierId = req.authenticatedCarrier.id; // ONLY from auth — never from req.body/query
  // ...
});
```

---

## TASK-R8-021 — updateCarrierAvailability Auth Guard

```javascript
// Route must require webhook auth or carrier session — not just a URL code:
// routes/carriers.js:
router.post('/:code/availability',
  authenticate,                // ensure caller is authenticated
  requireCarrierAuth,          // ensure authenticated carrier matches :code
  updateCarrierAvailability
);

// OR in controller — verify authenticated carrier matches code:
export const updateCarrierAvailability = asyncHandler(async (req, res) => {
  const { code } = req.params;
  if (req.authenticatedCarrier?.code !== code && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Cannot update another carrier\'s availability' });
  }
  // ...
});
```

---

## TASK-R8-006/7/8 — Warehouse Tenant Scoping

```javascript
// findByCode with org scope:
async findByCode(code, organizationId, client = null) {
  const query = `SELECT * FROM warehouses WHERE code = $1 AND organization_id = $2`;
  return (await this.query(query, [code, organizationId], client)).rows[0] || null;
}

// getActiveWarehouses with org scope:
async getActiveWarehouses(organizationId, client = null) {
  const query = `
    SELECT id, code, name, warehouse_type, address, coordinates
    FROM warehouses WHERE is_active = true AND organization_id = $1 ORDER BY name ASC
  `;
  return (await this.query(query, [organizationId], client)).rows;
}

// getWarehouseInventory with org scope:
async getWarehouseInventory(warehouseId, organizationId, options, client = null) {
  // Add AND i.organization_id = $2 to verify cross-org access is impossible
}
```

---

## TASK-R8-011 — deactivateWarehouse Pre-Check

```javascript
// Service layer before calling deactivateWarehouse:
async deactivateWarehouse(warehouseId, orgId) {
  const hasStock = await warehouseRepo.hasInventory(warehouseId);
  if (hasStock) throw new AppError('Cannot deactivate warehouse with active inventory', 409);

  const activeShipments = await shipmentRepo.countActiveByWarehouse(warehouseId, orgId);
  if (activeShipments > 0) throw new AppError('Cannot deactivate warehouse with active shipments', 409);

  return warehouseRepo.deactivateWarehouse(warehouseId);
}
```

---

## TASK-R10-001 — Orders: updateOrderStatus with Org Scope

```javascript
// BEFORE (cross-tenant modification possible):
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const order = await orderService.updateOrderStatus(id, status); // no org passed

// AFTER (org-scoped + status validation):
const VALID_ORDER_STATUSES = ['created','confirmed','allocated','processing','shipped','delivered','cancelled'];

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const organizationId = req.orgContext?.organizationId;

  if (!VALID_ORDER_STATUSES.includes(status)) {
    throw new AppError(`Invalid status '${status}'. Valid values: ${VALID_ORDER_STATUSES.join(', ')}`, 400);
  }

  const order = await orderService.updateOrderStatus(id, status, organizationId);
  res.json({ success: true, message: 'Order status updated', data: order });
});
```

---

## TASK-R10-002 — Orders: createTransferOrder Org Injection

```javascript
// BEFORE (org-less transfer order):
export const createTransferOrder = asyncHandler(async (req, res) => {
  const order = await orderService.createTransferOrder(req.body); // no org injection

// AFTER (org injected same as createOrder):
export const createTransferOrder = asyncHandler(async (req, res) => {
  const orderData = {
    ...req.body,
    organization_id: req.orgContext?.organizationId || null,
  };
  const order = await orderService.createTransferOrder(orderData);
  res.status(201).json({ success: true, message: 'Transfer order created successfully', data: order });
});
```

---

## TASK-R10-015 — Returns: createReturn Multi-Item Support

```javascript
// BEFORE (silently drops all items after the first):
const firstItem = items[0]; // TODO: Update to handle multiple items
const result = await pool.query(
  `INSERT INTO returns (...) VALUES ($1, ..., $11) RETURNING *`,
  [rmaNumber, order_id, firstItem.product_id, firstItem.quantity, ...]
);

// AFTER (transactional, all items persisted):
export async function createReturn(req, res, next) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const returnResult = await client.query(
      `INSERT INTO returns (rma_number, order_id, reason, notes, requested_by, customer_email,
        refund_amount, refund_method, organization_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [rmaNumber, order_id, reason, reason_details, requested_by, customer_email,
       refund_amount, refund_method, organizationId]
    );
    const returnId = returnResult.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO return_items (return_id, product_id, quantity, condition, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [returnId, item.product_id, item.quantity, item.condition || null, item.reason || null]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: returnResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}
```

---

## TASK-R10-016 — Returns: updateReturn Org Ownership Check

```javascript
// BEFORE (any tenant can mutate any return by UUID):
`UPDATE returns SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = $1`

// AFTER (org-scoped):
const organizationId = req.orgContext?.organizationId;
let whereClause = 'WHERE id = $1';
if (organizationId) {
  params.push(organizationId);
  whereClause += ` AND organization_id = $${params.length}`;
}
const result = await pool.query(
  `UPDATE returns SET ${updateFields.join(', ')}, updated_at = NOW() ${whereClause} RETURNING *`,
  params
);
if (result.rows.length === 0) {
  return res.status(404).json({ error: 'Return not found or access denied' });
}
```

---

## TASK-R10-021 + TASK-R10-022 — Shipments: Fix createShipment Undefined Variables

```javascript
// BEFORE (crashes on every call):
const { order_id, carrier_id, carrier_name, origin, destination } = req.body;
const trackingNumber = value.tracking_number || `TRK-${Date.now()}-...`; // ← value is UNDEFINED
// ...
await client.query(`UPDATE orders SET status = 'shipped' WHERE id = $1`, [orderId]); // ← orderId is UNDEFINED

// AFTER (correct variable names):
const { order_id, carrier_id, origin, destination, tracking_number } = req.body;
const trackingNumber = tracking_number || `TRK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
// ...
await client.query(`UPDATE orders SET status = 'shipped', updated_at = NOW() WHERE id = $1`, [order_id]);
```

---

## TASK-R10-023 — Shipments: Add to_warehouse_id to Orders

```javascript
// BEFORE (fragile address::text match):
const destWarehouseResult = await client.query(
  `SELECT id FROM warehouses WHERE address::text = $1 LIMIT 1`,
  [JSON.stringify(shippingAddress)]
);

// AFTER (direct column reference):
// 1. Schema migration:
// ALTER TABLE orders ADD COLUMN to_warehouse_id UUID REFERENCES warehouses(id);

// 2. createTransferOrder sets it:
// to_warehouse_id: req.body.to_warehouse_id

// 3. Delivery lookup:
const destWarehouseResult = await client.query(
  `SELECT to_warehouse_id FROM orders WHERE id = $1`,
  [order.id]
);
const toWarehouseId = destWarehouseResult.rows[0]?.to_warehouse_id;
if (!toWarehouseId) throw new Error('Transfer order missing to_warehouse_id');
```

---

## TASK-R10-025 — Shipments: getShipmentTimeline Org Filter

```javascript
// BEFORE (any tenant reads any shipment's tracking history):
const result = await pool.query(
  `SELECT se.*, s.tracking_number FROM shipment_events se JOIN shipments s ON se.shipment_id = s.id WHERE se.shipment_id = $1`,
  [id]
);

// AFTER (org-scoped):
const organizationId = req.orgContext?.organizationId;
let query = `SELECT se.*, s.tracking_number FROM shipment_events se JOIN shipments s ON se.shipment_id = s.id WHERE se.shipment_id = $1`;
const params = [id];

if (organizationId) {
  query += ` AND s.organization_id = $2`;
  params.push(organizationId);
}

const result = await pool.query(query, params);
if (result.rows.length === 0 && organizationId) {
  return res.status(404).json({ error: 'Shipment not found or access denied' });
}
```

---

## TASK-R10-011 — Returns/Shipments: Replace Regex Count Query

```javascript
// BEFORE (fragile regex):
const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM').split('ORDER BY')[0];

// AFTER (explicit separate count query, mirrors main query filters):
// Build main query and count query independently sharing params:
let baseWhere = 'WHERE 1=1';
const params = [];

if (organizationId) {
  params.push(organizationId);
  baseWhere += ` AND r.organization_id = $${params.length}`;
}
if (status) {
  params.push(status);
  baseWhere += ` AND r.status = $${params.length}`;
}

const countResult = await pool.query(
  `SELECT COUNT(*) FROM returns r ${baseWhere}`,
  params
);
const dataResult = await pool.query(
  `SELECT r.*, ... FROM returns r ${baseWhere} ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
  [...params, limit, offset]
);
```

---

## TASK-R9-001 — Companies: In-Controller Superadmin Role Guard

```javascript
// routes/companies.js — add role check alongside permission check:
import { requireRole } from '../middlewares/rbac.js';
router.get('/companies', authenticate, requireRole('superadmin'), authorize('companies:read'), getAllCompanies);

// controllers/companiesController.js — defensive in-controller assertion:
export async function getAllCompanies(req, res, next) {
  if (req.user?.role !== 'superadmin') {
    return next(new AppError('Forbidden — superadmin only', 403));
  }
  // ... rest of handler
}
```

---

## TASK-R9-003 — Companies: Soft Archive Instead of Hard Delete

```javascript
// BEFORE (hard delete — irreversible, destroys audit trail):
const deleteQuery = 'DELETE FROM organizations WHERE id = $1 RETURNING *';

// AFTER (soft archive — SaaS-safe):
const archiveQuery = `
  UPDATE organizations
  SET is_active = false, status = 'archived', archived_at = NOW(), archived_by = $2
  WHERE id = $1 AND is_active = true
  RETURNING *
`;
const { rows } = await pool.query(archiveQuery, [id, req.user.id]);
if (rows.length === 0) throw new AppError('Company not found or already archived', 404);
logInfo('Company archived', { companyId: id, archivedBy: req.user.id });
```

---

## TASK-R9-004 — Companies: createCompany Transactional

```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const { rows: existing } = await client.query(
    'SELECT id FROM organizations WHERE code = $1 FOR UPDATE',
    [code]
  );
  if (existing.length > 0) throw new AppError('Company code already exists', 400);
  const { rows } = await client.query(insertQuery, values);
  await client.query('COMMIT');
  res.status(201).json({ success: true, data: rows[0] });
} catch (err) {
  await client.query('ROLLBACK');
  next(err);
} finally {
  client.release();
}
```

---

## TASK-R9-010 — Dashboard: Org Filter + Promise.all

```javascript
// BEFORE (global + sequential):
const ordersResult = await pool.query(`SELECT ... FROM orders WHERE created_at >= NOW() - INTERVAL '30 days'`);
const shipmentsResult = await pool.query(`SELECT ... FROM shipments ...`);
// ...

// AFTER (tenant-scoped + parallel):
export const getDashboardStats = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  if (!organizationId) throw new AppError('Organization context required', 403);

  const [ordersRes, shipmentsRes, inventoryRes, returnsRes, exceptionsRes] = await Promise.all([
    pool.query(`SELECT COUNT(*) as total, ... FROM orders WHERE created_at >= NOW() - INTERVAL '30 days' AND organization_id = $1`, [organizationId]),
    pool.query(`SELECT COUNT(*) as total, ... FROM shipments s LEFT JOIN orders o ON o.id = s.order_id WHERE s.created_at >= NOW() - INTERVAL '30 days' AND s.organization_id = $1`, [organizationId]),
    pool.query(`SELECT COUNT(*) as low_stock FROM inventory WHERE available_quantity <= $1 AND organization_id = $2`, [LOW_STOCK_THRESHOLD, organizationId]),
    pool.query(`SELECT COUNT(*) as pending_returns FROM returns WHERE status IN ('pending','approved','processing') AND organization_id = $1`, [organizationId]),
    pool.query(`SELECT COUNT(*) as active_exceptions FROM exceptions WHERE status = 'open' AND organization_id = $1`, [organizationId]),
  ]);
  // ... rest unchanged
});
```

---

## TASK-R9-016 — Finance: getInvoiceById Org Ownership Check

```javascript
// BEFORE (any tenant reads any invoice):
const result = await db.query(`SELECT i.* FROM invoices i WHERE i.id = $1`, [id]);

// AFTER (org-scoped, or superadmin bypass):
const organizationId = req.orgContext?.organizationId;
const params = [id];
let orgClause = '';
if (organizationId) {
  orgClause = ' AND i.organization_id = $2';
  params.push(organizationId);
}
const result = await db.query(`SELECT i.* FROM invoices i WHERE i.id = $1${orgClause}`, params);
if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
```

---

## TASK-R9-017 — Finance: Parameterize orgFilter in getFinancialSummary

```javascript
// BEFORE (SQL injection — organizationId string-interpolated):
const orgFilter = organizationId ? ` AND organization_id = '${organizationId}'` : '';
db.query(`SELECT ... FROM invoices WHERE created_at >= ${dateFilter}${orgFilter}`);

// AFTER (fully parameterized):
const intervalMap = { day: '1 day', week: '7 days', month: '30 days', year: '1 year' };
const intervalStr = intervalMap[timeRange] || '30 days';
const params = [intervalStr];
let orgClause = '';
if (organizationId) {
  orgClause = ' AND organization_id = $2';
  params.push(organizationId);
}
db.query(`SELECT ... FROM invoices WHERE created_at >= NOW() - $1::interval${orgClause}`, params);
```

---

## TASK-R9-018 — Finance: Transactional processRefund with Audit Log

```javascript
export const processRefund = async (req, res, next) => {
  const { id } = req.params;
  const { refund_amount, restocking_fee } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Lock return row before reading
    const { rows: [returnRow] } = await client.query(
      `SELECT * FROM returns WHERE id = $1 AND status = 'inspected' FOR UPDATE`,
      [id]
    );
    if (!returnRow) throw new AppError('Return not found or not ready for refund', 404);

    const { rows } = await client.query(
      `UPDATE returns SET status = 'refunded', refund_amount = $1, restocking_fee = $2, resolved_at = NOW() WHERE id = $3 RETURNING *`,
      [refund_amount, restocking_fee || 0, id]
    );

    // Mandatory audit log entry
    await client.query(
      `INSERT INTO finance_audit_log (entity_type, entity_id, action, old_value, new_value, performed_by, created_at)
       VALUES ('return', $1, 'refund_processed', $2, $3, $4, NOW())`,
      [id, JSON.stringify({ status: 'inspected' }), JSON.stringify({ status: 'refunded', refund_amount }), req.user?.userId]
    );

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};
```

---

## TASK-R9-021 — Finance: Fix getDisputes Pagination Count

```javascript
// BEFORE (count ignores org filter — totalPages incorrect):
const countResult = await db.query(`SELECT COUNT(*) FROM invoices WHERE status = 'disputed'`);

// AFTER (count matches filtered list):
let countQuery = `SELECT COUNT(*) FROM invoices i WHERE i.status = 'disputed'`;
const countParams = [];
if (organizationId) {
  countQuery += ` AND i.organization_id = $1`;
  countParams.push(organizationId);
}
const countResult = await db.query(countQuery, countParams);
```

---

## TASK-R9-025 — Inventory: res.json() After Transaction Resolves

```javascript
// BEFORE (response inside callback, may fire before commit):
await withTransaction(async (tx) => {
  const updated = await ...; // do work
  res.json({ success: true, data: formatInventoryItem(updated) }); // ← WRONG location
});

// AFTER (return data from callback, respond after commit):
const updated = await withTransaction(async (tx) => {
  const result = await ...;
  await InventoryRepository.recordMovement({ ... }, tx);
  await refreshWarehouseUtilization(item.warehouse_id, tx);
  return result; // ← return, don't res.json() here
});
res.json({ success: true, data: formatInventoryItem(updated) }); // ← AFTER transaction
```

---

## TASK-R9-026 — Inventory: SELECT FOR UPDATE on Transfer Source

```javascript
// In transferInventory, lock the source row before availability check:
const { rows: [source] } = await tx.query(
  `SELECT * FROM inventory WHERE sku = $1 AND warehouse_id = $2 AND organization_id = $3 FOR UPDATE`,
  [sku, from_warehouse_id, organizationId]
);
if (!source) throw new NotFoundError(`SKU ${sku} in source warehouse`);
if (source.available_quantity < quantity) {
  throw new BusinessLogicError(`Insufficient stock — available: ${source.available_quantity}, requested: ${quantity}`);
}
// Only now safe to deduct — lock held until transaction commits
await InventoryRepository.addStock(sku, from_warehouse_id, -quantity, tx);
```

---

## TASK-R9-029 — Jobs: Org Scope on All Endpoints

```javascript
// In listJobs and every other handler, extract and filter by org:
export async function listJobs(req, res, next) {
  try {
    const organizationId = req.orgContext?.organizationId;
    const { status, job_type, priority, page = 1, limit = 20 } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (job_type) filters.job_type = job_type;
    if (priority) filters.priority = parseInt(priority);
    if (organizationId) filters.organization_id = organizationId; // ← added

    const result = await jobsService.getJobs(filters, parseInt(page), parseInt(limit));
    res.json({ success: true, data: result.jobs, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
}
```

---

## TASK-R9-031 — Jobs: Remove Dynamic Import in getJobStats

```javascript
// BEFORE (dynamic import on every HTTP request):
export async function getJobStats(req, res) {
  const pool = (await import('../configs/db.js')).default; // ← expensive per-request
  const result = await pool.query(statsQuery);
}

// AFTER (static import at file top):
import pool from '../configs/db.js'; // ← with existing imports

export async function getJobStats(req, res, next) {
  try {
    const result = await pool.query(statsQuery);
    // ... unchanged
  } catch (error) {
    next(error);
  }
}
```

---

## TASK-R9-032 — Jobs: Status Pre-Validation for retryJob / cancelJob

```javascript
export async function retryJob(req, res, next) {
  try {
    const { id } = req.params;
    const job = await jobsService.getJobById(id);

    const retryableStatuses = ['failed', 'dead_letter'];
    if (!retryableStatuses.includes(job.status)) {
      return res.status(400).json({
        error: `Cannot retry job with status '${job.status}'. Allowed: [${retryableStatuses.join(', ')}]`
      });
    }

    const retried = await jobsService.retryJob(id);
    res.json({ success: true, data: retried, message: 'Job queued for retry' });
  } catch (error) {
    next(error);
  }
}

export async function cancelJob(req, res, next) {
  try {
    const { id } = req.params;
    const job = await jobsService.getJobById(id);

    const cancellableStatuses = ['pending', 'scheduled'];
    if (!cancellableStatuses.includes(job.status)) {
      return res.status(400).json({
        error: `Cannot cancel job with status '${job.status}'. Allowed: [${cancellableStatuses.join(', ')}]`
      });
    }

    const cancelled = await jobsService.cancelJob(id);
    res.json({ success: true, data: cancelled, message: 'Job cancelled' });
  } catch (error) {
    next(error);
  }
}
```

---

## TASK-R11-003 — getQuotesForOrder: Add Org Filter

**File:** `controllers/shippingQuoteController.js`
**Bug:** `carrier_quotes` lookup uses only `order_id` — any tenant reads another tenant's carrier pricing.

```js
// BEFORE — no org scope, pricing data leaks cross-tenant
const { rows } = await db.query(
  `SELECT cq.*, c.name as carrier_name, c.code as carrier_code
   FROM carrier_quotes cq
   JOIN carriers c ON cq.carrier_id = c.id
   WHERE cq.order_id = $1
   ORDER BY cq.created_at DESC`,
  [orderId]
);

// AFTER — join orders to enforce org boundary
export const getQuotesForOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const organizationId = req.orgContext?.organizationId;

  const params = [orderId];
  let orgClause = '';
  if (organizationId) {
    params.push(organizationId);
    orgClause = `AND o.organization_id = $${params.length}`;
  }

  const { rows } = await db.query(
    `SELECT cq.*, c.name as carrier_name, c.code as carrier_code
     FROM carrier_quotes cq
     JOIN carriers c ON cq.carrier_id = c.id
     JOIN orders o ON cq.order_id = o.id
     WHERE cq.order_id = $1 ${orgClause}
     ORDER BY cq.created_at DESC`,
    params
  );

  const selectedQuote = rows.find(q => q.is_selected);
  res.json({ success: true, data: { quotes: rows, selected: selectedQuote, totalQuotes: rows.length } });
});
```

---

## TASK-R11-005 — selectQuote: Add State Guard

**File:** `controllers/shippingQuoteController.js`
**Bug:** `selectQuote` has no pre-flight — selecting an expired, wrong-order, or post-shipment quote causes silent corruption.

```js
// BEFORE — no state guards
export const selectQuote = async (req, res, next) => {
  try {
    const { quoteId } = req.params;
    const { orderId } = req.body;
    if (!orderId) throw new AppError('Order ID is required', 400);
    await carrierRateService.markQuoteAsSelected(quoteId, orderId);
    res.json({ success: true, message: 'Quote selected successfully', data: { quoteId, orderId } });
  } catch (error) { next(error); }
};

// AFTER — full state guard before selection
export const selectQuote = asyncHandler(async (req, res) => {
  const { quoteId } = req.params;
  const { orderId } = req.body;
  const organizationId = req.orgContext?.organizationId;

  if (!orderId) throw new AppError('Order ID is required', 400);

  // 1. Verify order belongs to org and is still open
  const { rows: [order] } = await db.query(
    `SELECT id, status, organization_id FROM orders WHERE id = $1`, [orderId]
  );
  if (!order) throw new AppError('Order not found', 404);
  if (organizationId && order.organization_id !== organizationId)
    throw new AppError('Order not found', 404);
  if (!['pending', 'confirmed'].includes(order.status))
    throw new AppError(`Cannot select quote — order status is '${order.status}'`, 409);

  // 2. Verify quote belongs to order and is not expired
  const { rows: [quote] } = await db.query(
    `SELECT id, order_id, expires_at FROM carrier_quotes WHERE id = $1`, [quoteId]
  );
  if (!quote) throw new AppError('Quote not found', 404);
  if (quote.order_id !== orderId)
    throw new AppError('Quote does not belong to this order', 400);
  if (quote.expires_at && new Date(quote.expires_at) < new Date())
    throw new AppError('Quote has expired', 410);

  // 3. Verify no shipment already exists for this order
  const { rows: existing } = await db.query(
    `SELECT id FROM shipments WHERE order_id = $1 LIMIT 1`, [orderId]
  );
  if (existing.length > 0)
    throw new AppError('A shipment already exists for this order', 409);

  await carrierRateService.markQuoteAsSelected(quoteId, orderId);
  res.json({ success: true, message: 'Quote selected successfully', data: { quoteId, orderId } });
});
```

---

## TASK-R11-009 / R11-010 / R11-011 — slaController: Missing Org Filters

**File:** `controllers/slaController.js`
**Bug:** `getEta`, `getSlaViolations`, and `getSlaDashboard` return cross-tenant data.

```js
// BEFORE — getEta: any shipment UUID works regardless of org
const result = await pool.query(
  `SELECT ep.*, s.tracking_number FROM eta_predictions ep
   JOIN shipments s ON ep.shipment_id = s.id
   WHERE ep.shipment_id = $1
   ORDER BY ep.predicted_at DESC LIMIT 1`,
  [shipmentId]
);

// AFTER — getEta: enforce org boundary via shipments join
export async function getEta(req, res, next) {
  try {
    const { shipmentId } = req.params;
    const organizationId = req.orgContext?.organizationId;
    const params = [shipmentId];
    let orgClause = '';
    if (organizationId) {
      params.push(organizationId);
      orgClause = `AND s.organization_id = $${params.length}`;
    }
    const result = await pool.query(
      `SELECT ep.*, s.tracking_number FROM eta_predictions ep
       JOIN shipments s ON ep.shipment_id = s.id
       WHERE ep.shipment_id = $1 ${orgClause}
       ORDER BY ep.predicted_at DESC LIMIT 1`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'ETA not found' });
    // ... map and return eta
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to get ETA' }); }
}

// AFTER — getSlaDashboard: scope all aggregations to org
export async function getSlaDashboard(req, res, next) {
  try {
    const organizationId = req.orgContext?.organizationId;
    const orgParam = organizationId ? [organizationId] : [];
    const orgShipClause = organizationId ? 'AND s.organization_id = $1' : '';
    const orgViolClause = organizationId ? 'AND sv.organization_id = $1' : '';

    const complianceResult = await pool.query(
      `SELECT COUNT(*) as total_shipments,
              COUNT(CASE WHEN s.delivery_actual <= s.delivery_scheduled THEN 1 END) as on_time
       FROM shipments s
       WHERE s.status = 'delivered'
         AND s.created_at >= NOW() - INTERVAL '30 days'
         ${orgShipClause}`,
      orgParam
    );

    const violationsResult = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM sla_violations sv
       WHERE sv.violated_at >= NOW() - INTERVAL '30 days'
         ${orgViolClause}
       GROUP BY status`,
      orgParam
    );
    // ... aggregate and return
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed' }); }
}
```

---

## TASK-R11-012 — resolveException: Add Org Ownership Check

**File:** `controllers/slaController.js`
**Bug:** `UPDATE exceptions ... WHERE id = $2` — any tenant resolves any tenant's exception.

```js
// BEFORE — org-blind mutation
const result = await pool.query(
  `UPDATE exceptions SET status = 'resolved', resolution = $1, resolved_at = NOW()
   WHERE id = $2 RETURNING *`,
  [resolution, id]
);

// AFTER — enforce org ownership on update
export async function resolveException(req, res, next) {
  try {
    const { id } = req.params;
    const { resolution } = req.body;
    const organizationId = req.orgContext?.organizationId;

    if (!resolution) throw new AppError('Resolution text is required', 400);

    const params = [resolution, id];
    let orgClause = '';
    if (organizationId) {
      params.push(organizationId);
      orgClause = `AND organization_id = $${params.length}`;
    }

    const result = await pool.query(
      `UPDATE exceptions SET status = 'resolved', resolution = $1, resolved_at = NOW()
       WHERE id = $2 ${orgClause}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Exception not found' });

    res.json({ success: true, data: result.rows[0] });
  } catch (error) { next(error); }
}
```

---

## TASK-R11-016 — trackingController: Org Filter Helper for All Handlers

**File:** `controllers/trackingController.js`
**Bug:** All 5 handlers use `WHERE tracking_number = $1` — org-blind reads and writes.

```js
// BEFORE — any user reads/writes any org's shipment by tracking number
const result = await pool.query(
  'SELECT id FROM shipments WHERE tracking_number = $1',
  [trackingNumber]
);

// AFTER — shared helper that enforces org boundary once
async function findShipmentByTracking(trackingNumber, organizationId) {
  const params = [trackingNumber];
  let orgClause = '';
  if (organizationId) {
    params.push(organizationId);
    orgClause = `AND organization_id = $${params.length}`;
  }
  const result = await pool.query(
    `SELECT id, carrier_id, origin_address, destination_address
     FROM shipments WHERE tracking_number = $1 ${orgClause}`,
    params
  );
  if (result.rows.length === 0) throw new AppError('Shipment not found', 404);
  return result.rows[0];
}

// All 5 handlers use the helper:
export async function getShipmentDetails(req, res, next) {
  try {
    const organizationId = req.orgContext?.organizationId;
    const shipment = await findShipmentByTracking(req.params.trackingNumber, organizationId);
    const details = await shipmentTrackingService.getShipmentDetails(shipment.id);
    res.json({ success: true, data: details });
  } catch (error) { next(error); }
}
```

---

## TASK-R11-017 — updateShipmentTracking: Carrier Webhook Authentication

**File:** `controllers/trackingController.js`
**Bug:** No carrier identity check — anyone who knows a tracking number injects fake events.

```js
// BEFORE — no auth on carrier webhook
export async function updateShipmentTracking(req, res) {
  try {
    const { eventType, location, description } = req.body;
    if (!eventType) return res.status(400).json({ error: 'eventType required' });
    const result = await pool.query(
      'SELECT id FROM shipments WHERE tracking_number = $1', [req.params.trackingNumber]
    );
    // proceeds with no carrier verification
  }
}

// AFTER — HMAC signature validation + assignment check

// utils/carrierWebhook.js
import crypto from 'crypto';
export function verifyCarrierSignature(signature, rawBody, secret) {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret)
    .update(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody))
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch { return false; }
}

// In updateShipmentTracking:
export async function updateShipmentTracking(req, res, next) {
  try {
    const { trackingNumber } = req.params;
    const { eventType, location, description, carrierId } = req.body;
    if (!eventType) throw new AppError('eventType required', 400);
    if (!carrierId) throw new AppError('carrierId required', 400);

    // 1. Find shipment + its assigned carrier
    const { rows: [shipment] } = await pool.query(
      'SELECT id, carrier_id FROM shipments WHERE tracking_number = $1', [trackingNumber]
    );
    if (!shipment) throw new AppError('Shipment not found', 404);

    // 2. Verify carrier exists and get webhook secret
    const { rows: [carrier] } = await pool.query(
      'SELECT id, webhook_secret FROM carriers WHERE id = $1 AND is_active = true', [carrierId]
    );
    if (!carrier) throw new AppError('Unknown carrier', 401);

    // 3. Verify HMAC signature
    const sig = req.headers['x-carrier-signature'];
    if (!verifyCarrierSignature(sig, req.body, carrier.webhook_secret))
      throw new AppError('Invalid carrier signature', 401);

    // 4. Verify carrier is assigned to this shipment
    if (shipment.carrier_id !== carrier.id)
      throw new AppError('Carrier not assigned to this shipment', 403);

    const updated = await shipmentTrackingService.updateShipmentTracking(
      shipment.id, { eventType, location: location || null, description: description || '' }
    );
    res.json({ success: true, data: { trackingNumber, status: updated.status } });
  } catch (error) { next(error); }
}
```

---

## TASK-R11-014 — slaController: Migrate to asyncHandler + AppError

**File:** `controllers/slaController.js`
**Bug:** All 7 handlers bypass global error middleware using `console.error` + direct `res.status(500)`.

```js
// BEFORE — bypasses structured logger and global middleware
export async function listSlaPolicies(req, res) {
  try {
    const result = await pool.query('SELECT * FROM sla_policies WHERE is_active = true ORDER BY name ASC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('List SLA policies error:', error);
    res.status(500).json({ error: 'Failed to list SLA policies' });
  }
}

// AFTER — asyncHandler + org filter + global error handling
import asyncHandler from 'express-async-handler';
import { AppError } from '../errors/index.js';

export const listSlaPolicies = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  const params = organizationId ? [organizationId] : [];
  const orgClause = organizationId
    ? 'AND (organization_id = $1 OR organization_id IS NULL)'
    : '';

  const result = await pool.query(
    `SELECT * FROM sla_policies WHERE is_active = true ${orgClause} ORDER BY name ASC`,
    params
  );
  // asyncHandler catches any thrown error and forwards to next(error) automatically
  res.json({ success: true, data: result.rows.map(mapPolicy) });
});
```

---

## TASK-R12-001 — Refresh Token: Add Server-Side Storage & Revocation

**File:** `controllers/usersController.js`, `utils/jwt.js`
**Bug:** Refresh tokens are stateless JWTs — stolen token is valid until expiry with no revocation path.

```sql
-- Migration: user_sessions table
CREATE TABLE user_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,   -- SHA-256 of the refresh token
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  is_revoked    BOOLEAN DEFAULT false
);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_hash ON user_sessions(token_hash);
```

```js
// utils/jwt.js — add session helpers
import crypto from 'crypto';
export const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

// login() — store session on issue
const refreshToken = generateRefreshToken(tokenPayload);
await pool.query(
  `INSERT INTO user_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
   VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')`,
  [user.id, hashToken(refreshToken), req.ip, req.headers['user-agent']]
);

// refreshToken() — verify against DB before issuing new access token
const decoded = verifyRefreshToken(token);
if (!decoded) return res.status(401).json({ error: 'Invalid refresh token' });

const { rows } = await pool.query(
  `SELECT id FROM user_sessions
   WHERE token_hash = $1 AND user_id = $2
     AND expires_at > NOW() AND is_revoked = false`,
  [hashToken(token), decoded.userId]
);
if (rows.length === 0) return res.status(401).json({ error: 'Session expired or revoked' });

// logout() — revoke session instead of just logging
await pool.query(
  `UPDATE user_sessions SET is_revoked = true
   WHERE user_id = $1 AND token_hash = $2`,
  [req.user.userId, hashToken(refreshTokenFromBody)]
);
```

---

## TASK-R12-002 — Login: Add Org Active Status Check

**File:** `controllers/usersController.js`
**Bug:** Login query checks `u.is_active` but not `o.is_active` — users from suspended orgs can log in.

```js
// BEFORE — no org status check
const result = await pool.query(
  `SELECT u.*, o.name as organization_name
   FROM users u 
   LEFT JOIN organizations o ON u.organization_id = o.id
   WHERE u.email = $1 AND u.is_active = true`,
  [email]
);

// AFTER — also verify org is active
const result = await pool.query(
  `SELECT u.*, o.name as organization_name
   FROM users u 
   LEFT JOIN organizations o ON u.organization_id = o.id
   WHERE u.email = $1
     AND u.is_active = true
     AND (u.organization_id IS NULL OR o.is_active = true)`,
  [email]
);
// Separate 401 message prevents org-status enumeration:
if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
```

---

## TASK-R12-003 — JWT Payload: Include organizationId

**File:** `controllers/usersController.js`
**Bug:** `tokenPayload = { userId, role, email }` — no `organizationId`; middleware does extra DB lookup on every request.

```js
// BEFORE — org context requires DB lookup in every middleware
const tokenPayload = { userId: user.id, role: user.role, email: user.email };

// AFTER — embed organizationId in both login and refreshToken
const tokenPayload = {
  userId: user.id,
  role: user.role,
  email: user.email,
  organizationId: user.organization_id   // <-- add this
};
const accessToken = generateAccessToken(tokenPayload);
const refreshToken = generateRefreshToken(tokenPayload);

// In auth middleware — read from token instead of DB query:
req.user = decoded;         // decoded.organizationId is now available
req.orgContext = {
  organizationId: decoded.organizationId
};
```

---

## TASK-R12-008 — updateOrgUser/deactivateOrgUser: Add Audit Logs

**File:** `controllers/usersController.js`
**Bug:** `createOrgUser` writes to `audit_logs`; `updateOrgUser` (role escalation) and `deactivateOrgUser` do not.

```js
// BEFORE — role changes untraceable
const result = await pool.query(
  `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING ...`,
  params
);
res.json({ success: true, data: result.rows[0] });

// AFTER — updateOrgUser: log changes after update
const result = await pool.query(/* ... UPDATE ... */);
await pool.query(
  `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata, created_at)
   VALUES ($1, 'update_user', 'user', $2, $3, NOW())`,
  [
    req.user.userId,
    id,
    JSON.stringify({ changes: { name, role, is_active }, actorRole: req.user.role })
  ]
);
res.json({ success: true, data: result.rows[0] });

// AFTER — deactivateOrgUser: log deactivation
const result = await pool.query(/* ... UPDATE is_active = false ... */);
await pool.query(
  `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata, created_at)
   VALUES ($1, 'deactivate_user', 'user', $2, $3, NOW())`,
  [req.user.userId, id, JSON.stringify({ actorRole: req.user.role, organizationId })]
);
res.json({ success: true, data: result.rows[0] });
```

---

## TASK-R12-010 — webhooksController: HMAC Signature Verification

**File:** `controllers/webhooksController.js`
**Bug:** All 5 webhook endpoints accept POST from anyone — no source authentication.

```js
// utils/webhookAuth.js
import crypto from 'crypto';

export function verifyWebhookSignature(payload, signature, secret) {
  if (!signature || !secret) return false;
  const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch { return false; }
}

// middlewares/webhookSignature.js
import { verifyWebhookSignature } from '../utils/webhookAuth.js';
import pool from '../configs/db.js';

export async function requireWebhookSignature(req, res, next) {
  const { source } = req.body;
  if (!source) return res.status(400).json({ error: 'source required' });

  // Look up registered webhook secret for this org + source
  const { rows } = await pool.query(
    `SELECT webhook_secret FROM integration_credentials
     WHERE organization_id = $1 AND platform = $2 AND is_active = true`,
    [req.webhookOrganizationId, source]
  );
  if (rows.length === 0) return res.status(401).json({ error: 'Unknown integration source' });

  const sig = req.headers['x-webhook-signature'] ||
              req.headers['x-shopify-hmac-sha256'] ||
              req.headers['x-hub-signature-256'];

  if (!verifyWebhookSignature(req.body, sig, rows[0].webhook_secret))
    return res.status(401).json({ error: 'Invalid webhook signature' });

  next();
}

// In routes/webhooks.js — apply before all handlers:
router.post('/orders',    requireWebhookSignature, handleOrderWebhook);
router.post('/tracking',  requireWebhookSignature, handleTrackingWebhook);
router.post('/inventory', requireWebhookSignature, handleInventoryWebhook);
```

---

## TASK-R12-011 — webhooksController: Webhook Event Idempotency

**File:** `controllers/webhooksController.js`
**Bug:** Duplicate webhook retries create duplicate orders and inventory mutations.

```sql
-- Migration: webhook_events dedup table
CREATE TABLE webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     TEXT NOT NULL,
  source       TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  received_at  TIMESTAMPTZ DEFAULT NOW(),
  job_id       UUID,
  UNIQUE (event_id, source)
);
CREATE INDEX idx_webhook_events_lookup ON webhook_events(event_id, source);
```

```js
// utils/webhookIdempotency.js
import pool from '../configs/db.js';

export async function checkAndRecord(eventId, source, eventType) {
  if (!eventId) return null; // no event_id = cannot deduplicate

  try {
    const result = await pool.query(
      `INSERT INTO webhook_events (event_id, source, event_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id, source) DO NOTHING
       RETURNING id`,
      [eventId, source, eventType]
    );
    // null = already exists (duplicate)
    return result.rows.length > 0 ? result.rows[0].id : null;
  } catch { return null; }
}

// In handleOrderWebhook — check before creating job:
const eventId = data.external_order_id || data.event_id || null;
const idempotencyResult = await checkAndRecord(eventId, source, event_type);
if (idempotencyResult === null && eventId) {
  logger.info(`Duplicate webhook event ${eventId} from ${source} — skipping`);
  return res.status(200).json({ success: true, message: 'Already processed', duplicate: true });
}

const job = await jobsService.createJob('process_order', { ... });
```

---

## TASK-R12-014 — carrierQuoteService: Decrypt API Key Before Use

**File:** `services/shipping/carrierQuoteService.js`
**Bug:** `carrier.api_key_encrypted` used directly as Bearer token — encrypted blob sent to carrier API.

```js
// utils/encryption.js
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.API_KEY_ENCRYPTION_KEY, 'hex'); // 32-byte hex key

export function decryptApiKey(encryptedValue) {
  const [ivHex, authTagHex, ciphertext] = encryptedValue.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext, 'hex', 'utf8') + decipher.final('utf8');
}

// In getDHLQuote (and all carrier functions):
// BEFORE
'Authorization': `Bearer ${carrier.api_key_encrypted}`

// AFTER
import { decryptApiKey } from '../../utils/encryption.js';
const apiKey = decryptApiKey(carrier.api_key_encrypted);
// ...
'Authorization': `Bearer ${apiKey}`
```

---

## TASK-R12-015 — carrierQuoteService: Add axios Request Timeouts

**File:** `services/shipping/carrierQuoteService.js`
**Bug:** No timeout on any carrier API call — one slow carrier blocks all `Promise.allSettled` indefinitely.

```js
// BEFORE — no timeout
const response = await axios.post(apiUrl, requestBody, {
  headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
});

// AFTER — add timeout + AbortController for each carrier
const CARRIER_API_TIMEOUT_MS = 5000; // 5 seconds

async function getDHLQuote(carrier, shipmentDetails) {
  const { origin, destination, items } = shipmentDetails;
  const apiKey = decryptApiKey(carrier.api_key_encrypted);

  try {
    const response = await axios.post(apiUrl, requestBody, {
      timeout: CARRIER_API_TIMEOUT_MS,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return parseResponse(response.data);
  } catch (error) {
    if (error.code === 'ECONNABORTED')
      throw new Error(`DHL API timeout after ${CARRIER_API_TIMEOUT_MS}ms`);
    throw new Error(`DHL API error: ${error.message}`);
  }
}
```

---

## TASK-R12-017 — carrierValidationService: Remove Random Rejection Simulation

**File:** `services/shipping/carrierValidationService.js`
**Bug:** `Math.random() > 0.85` and `Math.random() > 0.7` cause non-deterministic accept/reject in production.

```js
// BEFORE — random rejection produces inconsistent behavior
if (Math.random() > 0.85) {
  return { reason: 'at_capacity', message: 'Currently at maximum capacity' };
}
if (distance > 2000 && carrier.code === 'BLUEDART' && Math.random() > 0.7) {
  return { reason: 'route_not_serviceable', ... };
}

// AFTER — query real carrier availability from DB (or use simulation flag)

// Option A: Feature flag (safe for dev/demo, never for prod)
const IS_SIMULATION = process.env.CARRIER_SIMULATION_MODE === 'true';

// Option B: Query actual capacity table
export async function checkCarrierRejectionReasons(carrier, shipmentDetails) {
  const { totalWeight, hasFragileItems, requiresColdStorage, origin, destination } = shipmentDetails;

  // 1. Hard constraints (deterministic, from DB schema)
  if (carrier.max_weight_kg && totalWeight > carrier.max_weight_kg)
    return { reason: 'weight_exceeded', message: `Weight ${totalWeight}kg exceeds limit ${carrier.max_weight_kg}kg` };

  if (requiresColdStorage && !carrier.has_cold_storage)
    return { reason: 'no_cold_storage', message: 'Cold storage not available for this carrier' };

  // 2. Check live capacity (requires carrier_capacity table)
  const { rows } = await db.query(
    `SELECT available_slots, service_zones
     FROM carrier_capacity
     WHERE carrier_id = $1 AND date = CURRENT_DATE`,
    [carrier.id]
  );
  if (rows.length > 0 && rows[0].available_slots === 0)
    return { reason: 'at_capacity', message: 'No available slots today' };

  return null;  // accepted
}
```

---

## TASK-R12-019 — quoteDataService: Wrap markQuoteAsSelected in Transaction

**File:** `services/shipping/quoteDataService.js`
**Bug:** Two separate UPDATEs — if second fails, all quotes end up unselected.

```js
// BEFORE — two queries without transaction
await db.query('UPDATE carrier_quotes SET is_selected = false WHERE order_id = $1', [orderId]);
await db.query('UPDATE carrier_quotes SET is_selected = true WHERE id = $1', [quoteId]);

// AFTER — single transaction
export async function markQuoteAsSelected(quoteId, orderId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Unmark any previously selected quote
    await client.query(
      'UPDATE carrier_quotes SET is_selected = false WHERE order_id = $1',
      [orderId]
    );

    // Mark the new quote as selected — also verifies quote belongs to order
    const result = await client.query(
      'UPDATE carrier_quotes SET is_selected = true WHERE id = $1 AND order_id = $2 RETURNING id',
      [quoteId, orderId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error(`Quote ${quoteId} not found for order ${orderId}`);
    }

    await client.query('COMMIT');
    logger.info(`Marked quote ${quoteId} as selected for order ${orderId}`);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error marking quote as selected', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
}
```

---

## TASK-R13-001 — alertService: Add Alert Deduplication / Cooldown

**File:** `services/alertService.js`
**Bug:** `evaluateAlerts` creates a new alert row every cron cycle while a rule is true — same SLA breach generates 24 alerts per hour.

```js
// In triggerAlert() — check for existing open alert before inserting
async triggerAlert(rule) {
  // BEFORE — no dedup check
  // await client.query('INSERT INTO alerts ...')

  // AFTER — check for existing open alert with same rule
  const existing = await pool.query(
    `SELECT id FROM alerts
     WHERE rule_id = $1 AND status IN ('open', 'acknowledged')
     LIMIT 1`,
    [rule.id]
  );
  if (existing.rows.length > 0) {
    logger.info(`Alert already active for rule ${rule.id} — skipping duplicate`);
    return existing.rows[0];
  }

  // Also: add cooldown to the rule itself
  // In alert_rules table: add cooldown_minutes + last_triggered_at columns
  // ALTER TABLE alert_rules ADD COLUMN cooldown_minutes INT DEFAULT 60;
  // ALTER TABLE alert_rules ADD COLUMN last_triggered_at TIMESTAMPTZ;

  // Cooldown check in evaluateAlerts():
  if (rule.last_triggered_at && rule.cooldown_minutes) {
    const cooldownMs = rule.cooldown_minutes * 60 * 1000;
    if (Date.now() - new Date(rule.last_triggered_at).getTime() < cooldownMs) {
      return null; // still in cooldown
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const alertResult = await client.query(`INSERT INTO alerts ... RETURNING *`, [...]);
    await client.query(
      'UPDATE alert_rules SET last_triggered_at = NOW() WHERE id = $1',
      [rule.id]
    );
    await client.query('COMMIT');
    return alertResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
```

---

## TASK-R13-002 — alertService: Add Org Filter to getAlerts / acknowledgeAlert / resolveAlert

**File:** `services/alertService.js`
**Bug:** `getAlerts`, `acknowledgeAlert`, `resolveAlert` have no `organization_id` filter — any tenant reads or mutates any other org's alerts.

```js
// BEFORE
async getAlerts(filters = {}, page = 1, limit = 20) {
  const conditions = [];
  // ... status/severity/alert_type filters, NO org filter

// AFTER — always require organizationId
async getAlerts(organizationId, filters = {}, page = 1, limit = 20) {
  const conditions = ['a.organization_id = $1'];
  const params = [organizationId];
  let paramCount = 2;

  if (filters.status) { conditions.push(`a.status = $${paramCount++}`); params.push(filters.status); }
  // ...

// acknowledgeAlert — BEFORE
async acknowledgeAlert(alertId, userId) {
  const result = await pool.query(
    `UPDATE alerts SET status = 'acknowledged', acknowledged_by = $2, acknowledged_at = NOW()
     WHERE id = $1 RETURNING *`,
    [alertId, userId]
  );

// AFTER — add org ownership check
async acknowledgeAlert(alertId, userId, organizationId) {
  const result = await pool.query(
    `UPDATE alerts SET status = 'acknowledged', acknowledged_by = $2, acknowledged_at = NOW()
     WHERE id = $1 AND organization_id = $3 RETURNING *`,
    [alertId, userId, organizationId]
  );
  if (result.rows.length === 0) throw new Error('Alert not found or access denied');
  return result.rows[0];
}

// Same fix for resolveAlert — add AND organization_id = $4
```

---

## TASK-R13-003 — alertService: Filter Admin Recipients by organizationId

**File:** `services/alertService.js`
**Bug:** Fallback admin lookup `WHERE role = 'admin'` has no org filter — Tenant A alert notifies Tenant B admins.

```js
// BEFORE — global admin lookup
const result = await pool.query(
  `SELECT id FROM users WHERE role = 'admin' AND is_active = true`
);

// AFTER — scope to rule's organization
async getAlertRecipients(rule) {
  if (rule.assigned_users?.length > 0) return rule.assigned_users;

  if (rule.assigned_roles?.length > 0) {
    const result = await pool.query(
      `SELECT id FROM users
       WHERE role = ANY($1) AND is_active = true AND organization_id = $2`,
      [rule.assigned_roles, rule.organization_id]   // <-- add org scope
    );
    return result.rows.map(r => r.id);
  }

  // Default fallback — org-scoped admins only
  const result = await pool.query(
    `SELECT id FROM users
     WHERE role = 'admin' AND is_active = true AND organization_id = $1`,
    [rule.organization_id]                          // <-- add org scope
  );
  return result.rows.map(r => r.id);
}
```

---

## TASK-R13-004 — alertService: Move Side-Effects Outside Transaction

**File:** `services/alertService.js`
**Bug:** `notificationService.createNotification()` and `jobsService.createJob()` are called inside `BEGIN/COMMIT` block — notification failure rolls back the alert INSERT.

```js
// BEFORE — side effects inside transaction
const client = await pool.connect();
await client.query('BEGIN');
const alertResult = await client.query('INSERT INTO alerts ... RETURNING *', [...]);
const alert = alertResult.rows[0];
for (const userId of recipients) {
  await notificationService.createNotification(userId, ...);   // ← inside tx
}
if (rule.severity === 'critical' && rule.escalation_enabled) {
  await jobsService.createJob('alert_escalation', ...);        // ← inside tx
}
await client.query('COMMIT');

// AFTER — commit first, then dispatch
async triggerAlert(rule) {
  // 1. Persist alert in transaction (data only)
  const alert = await this._insertAlertRecord(rule);

  // 2. Dispatch side-effects AFTER successful commit
  const recipients = await this.getAlertRecipients(rule);
  await Promise.allSettled(
    recipients.map(userId =>
      notificationService.createNotification(userId, 'alert', rule.name, rule.message_template,
        null, { alertId: alert.id, ruleId: rule.id, severity: rule.severity })
    )
  );

  if (rule.severity === 'critical' && rule.escalation_enabled) {
    await jobsService.createJob('alert_escalation',
      { alertId: alert.id, ruleId: rule.id, escalationLevel: 1 },
      1,
      new Date(Date.now() + (rule.escalation_delay_minutes || 15) * 60000)
    ).catch(err => logger.error('Failed to schedule escalation', { err, alertId: alert.id }));
  }

  return alert;
}

async _insertAlertRecord(rule) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO alerts (rule_id, rule_name, alert_type, severity, message, data, organization_id, triggered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [rule.id, rule.name, rule.rule_type, rule.severity, rule.message_template,
       JSON.stringify({}), rule.organization_id]
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}
```

---

## TASK-R13-005 — alertService: Fix checkStuckShipments Duplicate Row Count

**File:** `services/alertService.js`
**Bug:** `LEFT JOIN shipment_events` causes multi-event shipments to be counted multiple times.

```sql
-- BEFORE — shipment with 4 events counted 4×
SELECT COUNT(*)
FROM shipments s
LEFT JOIN shipment_events se ON s.id = se.shipment_id
WHERE s.status NOT IN ('delivered', 'returned', 'cancelled')
  AND s.created_at < NOW() - INTERVAL '24 hours'
  AND (se.id IS NULL OR se.event_time < NOW() - INTERVAL '48 hours')

-- AFTER — use MAX(event_time) subquery; each shipment counted once
SELECT COUNT(*)
FROM shipments s
LEFT JOIN (
  SELECT shipment_id, MAX(event_time) AS last_event_time
  FROM shipment_events
  GROUP BY shipment_id
) latest_event ON s.id = latest_event.shipment_id
WHERE s.status NOT IN ('delivered', 'returned', 'cancelled')
  AND s.created_at < NOW() - INTERVAL '24 hours'
  AND (latest_event.shipment_id IS NULL
       OR latest_event.last_event_time < NOW() - INTERVAL '48 hours')
```

---

## TASK-R13-009 — allocationService: Add Transaction + SELECT FOR UPDATE

**File:** `services/allocationService.js`
**Bug:** Two concurrent orders for same SKU both read available stock and both allocate — overselling guaranteed.

```js
// BEFORE — no lock, no transaction
async allocateItem(item, shippingAddress, rules) {
  const warehousesResult = await pool.query(
    `SELECT w.*, i.available_quantity ...
     FROM warehouses w JOIN inventory i ON i.warehouse_id = w.id
     JOIN products p ON p.id = i.product_id
     WHERE p.sku = $1 AND i.available_quantity >= $2 AND w.is_active = true`,
    [item.sku, item.quantity]
  );
  // ... score and pick winner — no lock held

// AFTER — add FOR UPDATE to lock inventory rows before scoring
async allocateItem(item, shippingAddress, rules, client) {
  // client = pool client held by the calling transaction
  const warehousesResult = await client.query(
    `SELECT w.*, i.id as inv_id, i.available_quantity, i.reserved_quantity,
            w.address->>'city' as city, w.address->>'state' as state
     FROM warehouses w
     JOIN inventory i ON i.warehouse_id = w.id
     JOIN products p ON p.id = i.product_id
     WHERE p.sku = $1 AND i.available_quantity >= $2 AND w.is_active = true
     FOR UPDATE OF i SKIP LOCKED`,   // ← lock inventory rows
    [item.sku, item.quantity]
  );
  // ... score warehouses ...
  return { warehouseId: best.id, invId: best.inv_id, ... };
}

// allocateOrderItems — wrap in single transaction
async allocateOrderItems(orderId, items, shippingAddress) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const allocations = [];
    for (const item of items) {
      const allocation = await this.allocateItem(item, shippingAddress, rules, client);
      // Reserve stock within same transaction (see TASK-R13-010)
      await client.query(
        `UPDATE inventory
         SET available_quantity = available_quantity - $1,
             reserved_quantity  = reserved_quantity  + $1
         WHERE id = $2`,
        [item.quantity, allocation.invId]
      );
      allocations.push(allocation);
      await client.query(
        `INSERT INTO allocation_history ... VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [orderId, item.id, allocation.warehouseId, ...]
      );
    }
    await client.query('COMMIT');
    logEvent('InventoryAllocated', { orderId, allocationsCount: allocations.length });
    return allocations;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}
```

---

## TASK-R13-011 — allocationService: Batch Inventory Query (Fix N+1)

**File:** `services/allocationService.js`
**Bug:** One DB round-trip per item in `allocateOrderItems`; 50-item order = 50+ queries.

```js
// BEFORE — per-item query inside loop
for (const item of items) {
  const allocation = await this.allocateItem(item, ...);  // DB query inside
  allocations.push(allocation);
}

// AFTER — fetch all inventory upfront in one query, then allocate in memory
async allocateOrderItems(orderId, items, shippingAddress) {
  const skus = items.map(i => i.sku);
  const minQtys = items.reduce((acc, i) => ({ ...acc, [i.sku]: i.quantity }), {});

  // Single query: all warehouses × all required SKUs
  const inventoryResult = await pool.query(
    `SELECT w.id, w.name, w.is_active, w.address,
            i.available_quantity, i.reserved_quantity, i.id as inv_id,
            p.sku,
            w.address->>'city' as city, w.address->>'state' as state
     FROM warehouses w
     JOIN inventory i ON i.warehouse_id = w.id
     JOIN products p ON p.id = i.product_id
     WHERE p.sku = ANY($1) AND w.is_active = true`,
    [skus]
  );

  // Build in-memory map: { sku: [ ...warehouse rows ] }
  const inventoryMap = {};
  for (const row of inventoryResult.rows) {
    if (!inventoryMap[row.sku]) inventoryMap[row.sku] = [];
    if (row.available_quantity >= minQtys[row.sku]) inventoryMap[row.sku].push(row);
  }

  const rules = await this._getRules();
  const allocations = [];
  for (const item of items) {
    const candidates = inventoryMap[item.sku] || [];
    if (candidates.length === 0)
      throw new BusinessLogicError(`No stock for SKU: ${item.sku}`);
    const best = await this.selectBestWarehouse(candidates, item, shippingAddress, rules);
    allocations.push(best);
  }
  return allocations;
}
```

---

## TASK-R13-013 — allocationService: Replace Math.random() Round Robin

**File:** `services/allocationService.js`
**Bug:** `Math.random() * 100` for round_robin causes clustering; same warehouse receives most allocations statistically.

```js
// BEFORE — not round robin, just random
case 'round_robin':
  score = Math.random() * 100;
  break;

// AFTER — deterministic pointer using allocation_rules.last_selected_warehouse_index
// Add to allocation_rules table:
// ALTER TABLE allocation_rules ADD COLUMN last_rr_warehouse_index INT DEFAULT 0;

async getRoundRobinScore(warehouse, warehouses, ruleId) {
  // Get current pointer
  const { rows } = await pool.query(
    'SELECT last_rr_warehouse_index FROM allocation_rules WHERE id = $1',
    [ruleId]
  );
  const currentIndex = rows[0]?.last_rr_warehouse_index ?? 0;
  const warehouseIndex = warehouses.findIndex(w => w.id === warehouse.id);

  // Update pointer to next warehouse
  await pool.query(
    'UPDATE allocation_rules SET last_rr_warehouse_index = $1 WHERE id = $2',
    [(currentIndex + 1) % warehouses.length, ruleId]
  );

  // Selected warehouse gets 100, others get 0
  return warehouseIndex === currentIndex % warehouses.length ? 100 : 0;
}
```

---

## TASK-R13-014 — allocationService: Convert to Weighted Scoring

**File:** `services/allocationService.js`
**Bug:** `scoreWarehouse` takes the `maxScore` from all rules — winner-takes-all; a warehouse crushing one metric dominates even with poor performance on others.

```js
// BEFORE — winner-takes-all: only highest rule score wins
let maxScore = 0;
for (const rule of rules) {
  let score = 0;
  switch (rule.strategy) { ... }
  if (score > maxScore) { maxScore = score; selectedStrategy = rule.strategy; }
}
return { ...warehouse, score: maxScore, ... };

// AFTER — weighted sum using rule.priority as weight (higher priority = higher weight)
async scoreWarehouse(warehouse, item, shippingAddress, rules) {
  const TOTAL_WEIGHT = rules.reduce((sum, r) => sum + (r.weight ?? r.priority), 0);
  let weightedScore = 0;

  for (const rule of rules) {
    const ruleWeight = (rule.weight ?? rule.priority) / TOTAL_WEIGHT;
    let score = 0;

    switch (rule.strategy) {
      case 'proximity':   score = await this.calculateProximityScore(warehouse, shippingAddress); break;
      case 'cost':        score = await this.calculateCostScore(warehouse, item); break;
      case 'sla':         score = await this.calculateSLAScore(warehouse, shippingAddress); break;
      case 'stock_level': score = this.calculateStockScore(warehouse, item); break;
      case 'round_robin': score = await this.getRoundRobinScore(warehouse, rule); break;
    }

    weightedScore += score * ruleWeight;
  }

  return { ...warehouse, score: weightedScore, strategy: 'weighted' };
}
// Add weight FLOAT column to allocation_rules (default = priority value)
// ALTER TABLE allocation_rules ADD COLUMN weight FLOAT;
```

---

## TASK-R14-001 — Pass-Through Try/Catch at Service Facade Layer

**Pattern:** Every async method in a facade class wraps a single delegate call in `try/catch` that only logs and rethrows — adds noise, no value  
**File:** `services/carrierRateService.js`

```javascript
// BEFORE — log-and-rethrow at facade: errorHandler and asyncHandler already cover this
async getQuickEstimate(estimateData) {
  try {
    return await estimateService.getQuickEstimate(estimateData);
  } catch (error) {
    logger.error('Error in getQuickEstimate', { error: error.message });
    throw error; // rethrows — sub-service already logged it
  }
}

// AFTER — bare delegation; controller asyncHandler catches and formats the error
async getQuickEstimate(estimateData) {
  return estimateService.getQuickEstimate(estimateData);
}
// Sub-services own their error logging; facade owns routing only
// Applies to all 11 async methods in CarrierRateService
```

---

## TASK-R14-002 — SQL Query Ignores a Received Parameter (Zone Blind Spot)

**Pattern:** A business-logic parameter is computed, passed to a method, and accepted in the signature — but never bound in the SQL query  
**File:** `services/deliveryChargeService.js`

```javascript
// BUG — zone computed and passed but silently dropped from the query
async getBaseRate(carrierId, zone, serviceType) {
  const result = await pool.query(
    `SELECT rate_per_kg, fuel_surcharge_percent, min_charge_amount
     FROM rate_cards
     WHERE carrier_id = $1 AND service_type = $2   -- zone is NEVER bound
     LIMIT 1`,
    [carrierId, serviceType]
  );
  // Result: every zone gets the same rate regardless of local/regional/national
}

// FIX — bind zone, add ORDER BY for determinism
async getBaseRate(carrierId, zone, serviceType) {
  const result = await pool.query(
    `SELECT rate_per_kg, fuel_surcharge_percent, min_charge_amount
     FROM rate_cards
     WHERE carrier_id = $1 AND zone = $2 AND service_type = $3
     ORDER BY effective_from DESC
     LIMIT 1`,
    [carrierId, zone, serviceType]
  );
  // Schema: ALTER TABLE rate_cards ADD COLUMN zone TEXT NOT NULL DEFAULT 'national';
}
```

---

## TASK-R14-006 — Missing Org Filter on Service-Layer Aggregate/List Methods

**Pattern:** Statistics and priority-queue methods accept only date range or no filter — no `organization_id` tenant scope — every tenant reads all orgs' operational data  
**File:** `services/exceptionService.js`

```javascript
// BUG — all tenants' exceptions aggregated together
async getExceptionStatistics(startDate, endDate) {
  await pool.query(
    `SELECT COUNT(*) as total_exceptions, ...
     FROM exceptions
     WHERE created_at >= $1 AND created_at < $2`,  // no org filter
    [startDate, endDate]
  );
}

async getHighPriorityExceptions() {
  await pool.query(
    `SELECT e.* FROM exceptions e
     WHERE e.status IN ('open', 'investigating')
     AND (e.priority <= 3 OR e.severity = 'critical')
     ...`  // no org filter
  );
}

// FIX — require organizationId on every aggregate method
async getExceptionStatistics(organizationId, startDate, endDate) {
  await pool.query(
    `SELECT COUNT(*) as total_exceptions, ...
     FROM exceptions
     WHERE organization_id = $1 AND created_at >= $2 AND created_at < $3`,
    [organizationId, startDate, endDate]
  );
}

async getHighPriorityExceptions(organizationId) {
  await pool.query(
    `SELECT e.* FROM exceptions e
     WHERE e.organization_id = $1
       AND e.status IN ('open', 'investigating')
       AND (e.priority <= 3 OR e.severity = 'critical')`,
    [organizationId]
  );
}
// Pull organizationId from req.orgContext?.organizationId in calling controller
```

---

## TASK-R14-011 — Stub Resolution Branch (logEvent-Only Side Effect)

**Pattern:** A conditional branch on an important `resolution` value calls only `logEvent` with a comment "Logic would go here" — the operation appears to handle the case but silently does nothing  
**File:** `services/exceptionService.js`

```javascript
// BUG — reship and refund are silent no-ops
if (resolution === 'reship' && exception.order_id) {
  // Logic to create replacement shipment would go here
  logEvent('ExceptionResolved_Reship', { exceptionId, orderId: exception.order_id });
}
if (resolution === 'refund' && exception.order_id) {
  // Logic to initiate refund would go here
  logEvent('ExceptionResolved_Refund', { exceptionId, orderId: exception.order_id });
}

// FIX — wire real service calls inside the existing transaction
if (resolution === 'reship' && exception.order_id) {
  await shipmentService.createReplacementShipment(exception.order_id, exceptionId);
  logEvent('ExceptionResolved_Reship', { exceptionId, orderId: exception.order_id });
}
if (resolution === 'refund' && exception.order_id) {
  await financeService.initiateRefund(exception.order_id, resolutionNotes, resolvedBy);
  logEvent('ExceptionResolved_Refund', { exceptionId, orderId: exception.order_id });
}
// Both calls are inside the BEGIN/COMMIT transaction block — if either fails,
// the exception status update is rolled back (correct transactional behaviour)
```

---

## TASK-R15-002 — Duplicate Invoice Prevention via Pre-check + DB Constraint

**Pattern:** A generated entity (invoice per billing period) can be created twice by concurrent cron triggers or manual retries — no dedup check exists before INSERT  
**File:** `services/invoiceService.js`

```javascript
// BUG — no guard: two cron triggers in same minute produce two identical invoices
async generateInvoiceForCarrier(carrierId, billingPeriodStart, billingPeriodEnd) {
  await client.query('BEGIN');
  // immediately proceeds to INSERT — no existence check
  await client.query(`INSERT INTO invoices (invoice_number, carrier_id, ...) VALUES (...)`)
}

// FIX — pre-check inside the transaction before any other work
async generateInvoiceForCarrier(carrierId, billingPeriodStart, billingPeriodEnd) {
  await client.query('BEGIN');

  // Guard: check for existing invoice for this period
  const existing = await client.query(
    `SELECT id FROM invoices
     WHERE carrier_id = $1
       AND billing_period_start = $2
       AND billing_period_end = $3`,
    [carrierId, billingPeriodStart, billingPeriodEnd]
  );

  if (existing.rows.length > 0) {
    await client.query('ROLLBACK');
    logEvent('InvoiceGenerationSkipped', { carrierId, reason: 'Already exists for period' });
    return existing.rows[0]; // return the existing invoice
  }

  // proceed with INSERT ...
}

// DB constraint as hard safety net (pre-check handles the graceful path,
// constraint handles the concurrent race where both pass the check simultaneously)
// ALTER TABLE invoices ADD CONSTRAINT uq_invoice_carrier_period
//   UNIQUE (carrier_id, billing_period_start, billing_period_end);
```

---

## TASK-R15-009 — SELECT FOR UPDATE SKIP LOCKED for Database-Backed Job Queue

**Pattern:** `getPendingJobs` reads without locking — two concurrent workers take the same job batch, causing double execution of invoices, emails, and carrier calls  
**File:** `services/jobsService.js`

```javascript
// BUG — two workers calling simultaneously get the same rows
async getPendingJobs(limit = 10) {
  const result = await pool.query(
    `SELECT * FROM background_jobs
     WHERE status IN ('pending', 'retrying')
       AND scheduled_for <= NOW()
     ORDER BY priority ASC, scheduled_for ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

// FIX — claim rows atomically using FOR UPDATE SKIP LOCKED
// Called inside a worker that holds the transaction open during processing
async claimPendingJobs(client, limit = 10) {
  // client is a pool.connect() connection; caller holds 'BEGIN' before calling
  const result = await client.query(
    `SELECT * FROM background_jobs
     WHERE status IN ('pending', 'retrying')
       AND scheduled_for <= NOW()
     ORDER BY priority ASC, scheduled_for ASC
     LIMIT $1
     FOR UPDATE SKIP LOCKED`,  // SKIP LOCKED: second worker skips rows already locked
    [limit]
  );

  if (result.rows.length > 0) {
    // Mark claimed rows as running before releasing the lock
    const ids = result.rows.map(r => r.id);
    await client.query(
      `UPDATE background_jobs
       SET status = 'running', started_at = NOW(), worker_id = $1
       WHERE id = ANY($2)`,
      [process.pid.toString(), ids]
    );
  }

  return result.rows;
}
// Worker pattern:
// const client = await pool.connect();
// await client.query('BEGIN');
// const jobs = await jobsService.claimPendingJobs(client, 10);
// await client.query('COMMIT'); // releases locks after marking running
// for (const job of jobs) { await processJob(job); }
```

---

## TASK-R15-001 — Invoice Number via DB Sequence (Not Timestamp)

**Pattern:** `Date.now()` suffixes collide under concurrency and produce unreadable invoice numbers for finance teams; DB sequences are atomic, gapless within a transaction  
**File:** `services/invoiceService.js`

```javascript
// BUG — timestamp-based: INV-DEL-1740384612345 (collides under concurrency)
const invoiceNumber = `INV-${carrier.code}-${Date.now()}`;

// FIX — DB sequence: INV-DEL-2026-000145 (human-readable, atomic, no collision)
// One-time migration:
// CREATE SEQUENCE invoice_number_seq START 1;

const seqResult = await client.query(`SELECT nextval('invoice_number_seq') AS seq`);
const seq = seqResult.rows[0].seq.toString().padStart(6, '0');
const year = new Date(billingPeriodEnd).getFullYear();
const invoiceNumber = `INV-${carrier.code}-${year}-${seq}`;
// Result: INV-DEL-2026-000145 — sortable, readable, fiscal-year namespaced
```

---

## R16 — orderService, osrmService, returnsService

### TASK-R16-006 · Always verify utility imports before using higher-order transaction helpers

**What happened:** `returnsService.js` calls `withTransaction(async (tx) => { ... })` inside `inspectReturn` but the import block only pulls in `pool`, error classes, and `logEvent`. Every call throws `ReferenceError: withTransaction is not defined` at runtime.

**Why it's silent until runtime:** ESM and CJS do not validate that a referenced identifier is imported at parse time unless a bundler with strict tree-shaking is in place. The function signature of `inspectReturn` looks fine in isolation.

```js
// BAD — withTransaction used without import
import pool from '../configs/db.js';
import { NotFoundError, BusinessLogicError } from '../errors/index.js';
import { logEvent } from '../utils/logger.js';

async function inspectReturn(returnId, inspectionData) {
  return withTransaction(async (tx) => {   // ReferenceError: withTransaction is not defined
    // ...
  });
}

// FIX — add the missing import
import pool from '../configs/db.js';
import { NotFoundError, BusinessLogicError } from '../errors/index.js';
import { logEvent } from '../utils/logger.js';
import { withTransaction } from '../utils/dbTransaction.js';   // ← add this

async function inspectReturn(returnId, inspectionData) {
  return withTransaction(async (tx) => {   // now works
    // ...
  });
}
```

**Rule:** After writing any async function that uses `withTransaction`, `pool.query`, `pool.connect`, or any shared utility, immediately scan the import block and confirm the symbol is listed. A quick `grep 'withTransaction' services/X.js` at the top of a code review catches this before it reaches production.

---

### TASK-R16-007 · Distance-to-duration conversion: km ÷ speed gives hours, then multiply by 60 for minutes

**What happened:** The Haversine fallback in `osrmService.js` computes:

```js
durationMinutes: Math.round(roadAdjustedKm / 60)
```

At 60 km/h the formula `km / speed` gives hours, not minutes. A 500 km route returns `8` minutes instead of `500`.

```js
// BAD — returns hours disguised as minutes
const durationMinutes = Math.round(roadAdjustedKm / 60);
// 500 km → Math.round(500/60) = 8  (should be ~500 minutes)

// FIX — explicit conversion, named constant
const AVG_SPEED_KMH = 60;
const durationMinutes = Math.round((roadAdjustedKm / AVG_SPEED_KMH) * 60);
// 500 km → Math.round((500/60)*60) = Math.round(500) = 500 ✓

// Simplified form (at exactly 60 km/h the multiply and divide cancel):
const durationMinutes = Math.round(roadAdjustedKm);   // only valid when AVG_SPEED_KMH === 60
// Prefer the explicit form so future speed changes don't silently reintroduce the bug
```

**Rule:** Conversion chains involving `/ speed` (→ hours) must always be followed by `* 60` (→ minutes) before being stored in a field named `*Minutes`. Write the unit in the variable name and add a comment: `// km / (km/h) = h; h * 60 = min`.

---

### TASK-R16-003 · Never accept tenant-scoping fields from client-supplied payloads

**What happened:** `orderService.createOrder` trusts the caller-supplied `orderData.organization_id`:

```js
const orderRecord = {
  // ...
  organization_id: orderData.organization_id || null,   // ← client controls this
};
```

Any authenticated user (regardless of their own tenant) can pass `organization_id: <rival_tenant_id>` in the POST body and create orders attributed to that rival tenant.

```js
// BAD — organization_id comes from req.body via orderData
router.post('/', auth, async (req, res) => {
  const order = await orderService.createOrder(req.body);  // req.body.organization_id injected
});

async function createOrder(orderData) {
  const orderRecord = {
    organization_id: orderData.organization_id || null,   // attacker-controlled
  };
}

// FIX — extract org from JWT at controller level, pass explicitly; service ignores payload org
router.post('/', auth, async (req, res) => {
  const order = await orderService.createOrder(req.body, req.user.organizationId);
});

async function createOrder(orderData, organizationId) {
  if (!organizationId) throw new BusinessLogicError('Organization context required');
  const orderRecord = {
    organization_id: organizationId,          // from verified JWT, not payload
    // ... rest from orderData (organization_id key in orderData is ignored)
  };
}
```

**Rule:** Tenant-scoping fields (`organization_id`, `tenant_id`, `account_id`) must always originate from the verified JWT / session context — never from `req.body`, `req.query`, or `req.params`. The service signature should accept `organizationId` as a distinct parameter, not buried inside the data object where it can be silently overridden by a malicious payload.

---

## R17 — settingsService, shipmentTrackingService, slaService, warehouseOpsService

### TASK-R17-001 / TASK-R17-002 · withTransaction return value must be the callback's return; manual client rollback is a double-fault

**What happened:** `updateShipmentTracking` stores `const result = await withTransaction(async (tx) => { ... return { shipmentId, newStatus, eventType }; })`. The internal `tx.query()` that returns `updateResult` is scoped to the callback and never returned. Then after the transaction, the function does `return updateResult.rows[0]` — a variable that does not exist in the outer scope. In the `catch` block, `await client.query('ROLLBACK')` references a `client` that was never declared.

```js
// BAD — updateResult is scoped inside callback; client is never defined
async updateShipmentTracking(shipmentId, trackingEvent) {
  try {
    const result = await withTransaction(async (tx) => {
      const updateResult = await tx.query(`UPDATE shipments SET ... WHERE id = $4 RETURNING *`, [...]);
      // ... more queries
      return { shipmentId, newStatus, eventType: trackingEvent.eventType };
    });
    logger.info('Shipment tracking updated', result);
    return updateResult.rows[0];  // ❌ ReferenceError: updateResult is not defined
  } catch (error) {
    await client.query('ROLLBACK');   // ❌ ReferenceError: client is not defined
    throw error;
  } finally {
    client.release();               // ❌ ReferenceError: client is not defined
  }
}

// FIX — return the row from inside the callback; let withTransaction handle rollback
async updateShipmentTracking(shipmentId, trackingEvent) {
  try {
    const updatedShipment = await withTransaction(async (tx) => {
      const updateResult = await tx.query(`UPDATE shipments SET ... WHERE id = $4 RETURNING *`, [...]);
      // ... more queries
      return updateResult.rows[0];   // ← return the row you need
    });
    logger.info('Shipment tracking updated', { shipmentId, status: updatedShipment.status });
    return updatedShipment;          // ← use the callback's return value
  } catch (error) {
    // withTransaction already rolled back — just log and rethrow
    logger.error('Failed to update shipment tracking', { shipmentId, error: error.message });
    throw error;
  }
  // no finally needed — withTransaction handles client release
}
```

**Rule:** `withTransaction(async (tx) => { ... })` returns exactly what the callback returns. Design the callback to return all data you need from it. Remove any manual `client.query('ROLLBACK')` / `client.release()` from functions that delegate to `withTransaction` — they handle cleanup internally, and attempting to reuse `client` there causes a second crash at error time.

---

### TASK-R17-003 · Credential mutations and their audit records must be atomic

**What happened:** `changePassword` in `settingsService.js` issues two independent `pool.query()` calls: first the `UPDATE users SET password_hash = ...`, then `INSERT INTO audit_logs ...`. If the DB experiences a transient error between the two, the password is changed with zero audit record — exactly the scenario that makes breach investigation impossible.

```js
// BAD — two independent queries; audit can be lost
async changePassword(userId, currentPassword, newPassword) {
  // ... bcrypt compare ...
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
  await pool.query(`INSERT INTO audit_logs ...`, [userId]);  // can fail independently
  return { success: true };
}

// FIX — wrap in withTransaction so both succeed or both roll back
async changePassword(userId, currentPassword, newPassword) {
  const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (!userResult.rows[0]) throw new NotFoundError('User not found');

  const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
  if (!isValid) throw new UnauthorizedError('Current password is incorrect');

  const hash = await bcrypt.hash(newPassword, 10);

  await withTransaction(async (tx) => {
    await tx.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, userId]);
    await tx.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
       VALUES ($1, 'password_changed', 'user', $1, $2)`,
      [userId, JSON.stringify({ event: 'password_changed', timestamp: new Date() })]
    );
  });

  return { success: true };
}
```

**Rule:** Any mutation that has an audit record must run both writes inside the same transaction. "Fire-and-forget" audit logs defeat the purpose of audit logs.

---

### TASK-R17-004 · Email address changes require a pending + verify flow, not instant updates

**What happened:** `updateUserProfile` accepts `email` in the whitelist and immediately writes it to `users.email`. Any session holder (including a session stolen from a lock screen) permanently changes the recovery address, blocking the real owner from password reset.

```js
// BAD — email updated immediately
async updateUserProfile(userId, updates) {
  const allowedFields = ['name', 'email', 'phone', 'company', 'avatar'];
  // ... builds UPDATE query including email ...
  await pool.query(query, values);   // email column overwritten instantly
}

// FIX — separate email change into a pending + confirm flow
// Step 1: controller POST /settings/email — call requestEmailChange(userId, newEmail)
async requestEmailChange(userId, newEmail) {
  const conflict = await pool.query('SELECT id FROM users WHERE email=$1 AND id!=$2', [newEmail, userId]);
  if (conflict.rows.length > 0) throw new ConflictError('Email already in use');

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await pool.query(
    `UPDATE users SET pending_email=$1, email_change_token=$2, email_change_expires_at=$3 WHERE id=$4`,
    [newEmail, token, expiresAt, userId]
  );
  // send email to newEmail with link: /settings/confirm-email?token={token}
}

// Step 2: controller GET /settings/confirm-email — call confirmEmailChange(token)
async confirmEmailChange(token) {
  const result = await pool.query(
    `UPDATE users SET email=pending_email, pending_email=NULL, email_change_token=NULL
     WHERE email_change_token=$1 AND email_change_expires_at > NOW() RETURNING id`,
    [token]
  );
  if (!result.rows[0]) throw new NotFoundError('Invalid or expired token');
}

// updateUserProfile allowedFields must exclude 'email':
const allowedFields = ['name', 'phone', 'company', 'avatar'];  // email removed
```

**Rule:** Email is a recovery and identity credential. Changes must be gated behind re-verification at the new address. Add `pending_email`, `email_change_token`, and `email_change_expires_at` columns to the users table.
