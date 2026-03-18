# Codebase Audit

Freshness note (2026-03-18): This audit remains useful but some status rows can lag behind active refactor work. Cross-check with `DEEP_AUDIT_PROGRESS.md` for latest execution state.

Organized by problem type. Each section lists locations found and the status of the fix.
**Status key:** ✅ Fixed | ⚠️ Documented / stub in place | ❌ Not yet fixed

---

## A. Architectural Inconsistency — Logic Overflow Across Layers ❌ (Ongoing)

This is the core structural problem in the codebase: **the route → controller → service → repository boundary is not enforced.** Logic bleeds across layers in every direction.

### A1. Business logic and DB queries embedded in route files ✅

Routes should only wire middleware + controller. These route files currently embed DB queries or full business logic directly in the handler, which is untestable and violates separation of concerns.

| File | Violation | Status |
|------|-----------|--------|
| `routes/carriers.js` | Webhook handler (`POST /carriers/webhook/:carrierId`) ran multiple `db.query()` calls directly in the route file. | ✅ Extracted to `controllers/carriersController.js` (`handleCarrierWebhook`) |
| `routes/carriers.js` | Quote-status handler (`GET /carriers/orders/:orderId/quote-status`) was an inline `async (req, res) =>` in the route file. | ✅ Extracted to `controllers/carriersController.js` (`getCarrierQuoteStatus`) |

### A2. Controllers bypassing the repository layer

The repository classes (`OrderRepository`, `ShipmentRepository`, `ReturnRepository`, `UserRepository`, `InventoryRepository`, `WarehouseRepository`, `CarrierRepository`, `OrganizationRepository`) exist but **most controllers do not use them**. Instead they call `pool.query()` / `db.query()` directly, duplicating query logic and making it impossible to swap the DB layer.

| Controller | Repositories that exist for it | Status |
|------------|-------------------------------|--------|
| `controllers/shipmentsController.js` | `ShipmentRepository` | ✅ All handlers clean. Read handlers use `ShipmentRepository`. `updateShipmentStatus` and `confirmPickup` converted from manual `pool.connect()/BEGIN/COMMIT/ROLLBACK` to `withTransaction`. Early-return 404/409/403/400 responses replaced with typed error throws (`NotFoundError`, `ConflictError`, `AuthorizationError`, `AppError`). `import pool` removed entirely. |
| `controllers/returnsController.js` | `ReturnRepository` | ✅ All 5 handlers fully rewritten — 0 direct pool calls. All reads via `ReturnRepository.findReturnsWithDetails()` / `findReturnDetails()`. Creates via `createReturnWithItems()` + `withTransaction`. Updates via `updateStatus()`. Stats via `returnRepo.query()`. ReturnRepository bug fixed (`inspection_notes` → `notes` column). |
| `controllers/financeController.js` | `FinanceRepository` (new) | ✅ Read handlers (`getInvoices`, `getInvoiceById`, `getRefunds`, `getDisputes`, `getFinancialSummary`) use `FinanceRepository`. `withTransaction` handlers (`createInvoice`, `updateInvoice`, `processRefund`, `resolveDispute`) use `tx.query` directly — correct pattern, kept as-is. **Bug fixed**: `getFinancialSummary` was interpolating `dateFilter` string into SQL (`NOW() - INTERVAL '30 days'`) — replaced with `$1::INTERVAL` parameterized binding. |
| `controllers/analyticsController.js` | `AnalyticsRepository` (new, thin) | ✅ All `pool.query` calls replaced with `analyticsRepo.query()`. Queries unchanged — complex analytics SQL stays in controller, routed through BaseRepository layer. |
| `controllers/dashboardController.js` | `DashboardRepository` (new, thin) | ✅ All `pool.query` calls replaced with `dashboardRepo.query()`. |
| `controllers/slaController.js` | `SlaRepository` (new, thin) | ✅ All 11 `pool.query` calls replaced with `slaRepo.query()`. Joi validation already added (prev session). |
| `controllers/usersController.js` | `UserRepository` | ✅ All 17 handlers rewritten — 0 direct pool calls. Auth handlers (`login`, `refreshToken`, `getProfile`) use `userRepo.query()` for org-join SELECTs + `userRepo.updateLastLogin()`. `listUsers` → `userRepo.findUsers()`. `createOrgUser` → `userRepo.findByEmail()` + `userRepo.query()`. `getOrgUser`/`updateOrgUser` → `userRepo.findById()` + `userRepo.query()`. `deactivateOrgUser` → `userRepo.query()` for token_version bump, session revocation, JTI blocklist, and audit log. Session management (`user_sessions`, `revoked_tokens`, `audit_logs`) all go through `userRepo.query()`. |
| `controllers/trackingController.js` | `ShipmentRepository` | ✅ All 7 `pool.query` calls replaced with `shipmentRepo.query()`. |
| `controllers/jobsController.js` | `JobsRepository` (new, thin) | ✅ Single `pool.query` in `getJobStats` replaced with `jobsRepo.query()`. All other handlers use `jobsService` (already correct). |
| `controllers/companiesController.js` | `CompaniesRepository` (new, thin) | ✅ All 7 `pool.query` calls replaced with `companiesRepo.query()`. `withTransaction` handler (`createCompany`) already used `tx.query` correctly — unchanged. |
| `controllers/mdmController.js` | `CarrierRepository`, `WarehouseRepository`, `SlaRepository`, `ProductRepository` (new, thin) | ✅ All `pool.query` calls replaced. Warehouse inventory-stats queries → `WarehouseRepository.query()`. Product CRUD (list, create, update, delete) → `ProductRepository.query()`. `listSlaPolicies` → `SlaRepository.query()`. Carriers already fully used `CarrierRepository`. |
| `controllers/inventoryController.js` | `InventoryRepository` | ✅ All `pool.query` calls removed. `generateUniqueSKU` + `createInventoryItem` product lookups/inserts → `InventoryRepository.query()`. `refreshWarehouseUtilization` helper → `InventoryRepository.query(sql, params, client)` (BaseRepository handles `client \|\| this.pool`). |
| `controllers/organizationController.js` | `OrganizationRepository` | ✅ Fully clean. `createOrganization` converted from `pool.connect()/BEGIN/COMMIT/ROLLBACK` to `withTransaction`. `updateOrganization` email-uniqueness check uses `OrganizationRepository.query()`. `import pool` removed. |
| `controllers/assignmentController.js` | `CarrierAssignmentRepository` | ✅ Uses repo |
| `controllers/carriersController.js` | `CarrierRepository` | ✅ All 5 `db.query` calls replaced with `CarrierRepository.query()`. Handles carrier webhook callbacks (accept/reject) and quote-status queries. |
| `controllers/shippingQuoteController.js` | `WarehouseRepository`, `CarrierRepository`, `OrderRepository` | ✅ All 4 `db.query` calls replaced: warehouse lookup → `WarehouseRepository.query()`, carrier lookup → `CarrierRepository.query()`, order auth check + carrier quotes → `CarrierRepository.query()` + `OrderRepository.query()`. |

### A3. Service layer bypassed — business logic in controllers ✅ RESOLVED

State machine constants and associated validation logic extracted from controllers to the service layer. All four items below are resolved.

| Controller | Logic moved to | Status |
|------------|---------------|--------|
| `controllers/financeController.js` | `export const INVOICE_VALID_TRANSITIONS` in `services/invoiceService.js` — `financeController` now imports it | ✅ |
| `controllers/shipmentsController.js` | `export const SHIPMENT_VALID_TRANSITIONS` + `updateStatus()` + `confirmPickup()` in `services/shipmentService.js` — controller delegates both handlers | ✅ |
| `controllers/returnsController.js` | `export const RETURN_VALID_TRANSITIONS` + `validateTransition()` method in `services/returnsService.js` — controller calls `returnsService.validateTransition()` | ✅ |
| `controllers/usersController.js` | `export const ORG_ASSIGNABLE_ROLES` in `config/roles.js` — `usersController` imports from there | ✅ |

### A4. Inconsistent response shape ✅ RESOLVED

Created `utils/response.js` — three thin helpers that enforce a single envelope across all controller responses.

```
{ success: true, [message], data }              // ok() / created()
{ success: true, data, pagination: {...} }       // paginated()
```

`financeController.js` was the worst offender — all 8 handlers returned bare objects (`row`, `{ data: [], pagination: {} }`) and wrapped every handler in a redundant inner `try/catch` that duplicated `asyncHandler`'s job. The controller has been fully rewritten:

| Change | Detail |
|--------|--------|
| Inner `try/catch` removed | All 9 handler-level `try { ... } catch` blocks deleted — errors propagate to `asyncHandler` |
| Typed error throws | `res.status(404/403/409).json(...)` and `const err = new Error(); err.statusCode = x` replaced with `NotFoundError`, `AuthorizationError`, `ConflictError`, `AppError` |
| Response helper applied | `ok()`, `created()`, `paginated()` used throughout — consistent `{ success, data, pagination? }` shape |

Other controllers that already used `{ success: true, data }` inline (orders, returns, SLA, tracking, jobs) are consistent with the new envelope and require no change.

### A5. Inconsistent `orgContext` source ✅ RESOLVED

`req.user?.organizationId` — the old per-handler pattern — has been removed from all controllers.

| Controller | Fix |
|------------|-----|
| `controllers/ordersController.js` | 3 occurrences of `req.user?.organizationId \|\| req.orgContext?.organizationId` simplified to `req.orgContext?.organizationId` — all orders routes have `injectOrgContext` |
| `controllers/jobsController.js` | 9 occurrences of `req.user?.organizationId \|\| req.orgContext?.organizationId` simplified to `req.user?.organizationId` — jobs/cron/DLQ routes are deliberately system-scoped and do **not** use `injectOrgContext`; superadmin users have `organizationId = null` in their JWT and see all records |

---

## B. Inline `TODO` / `FIXME` Inventory

All items below exist as comments in source files. They are tracked here so they are not lost.

| File | Line | Item |
|------|------|------|
| `controllers/usersController.js` | 288 | ✅ Email verification now sent through `services/emailService.js` (nodemailer with SMTP or JSON transport fallback) |
| `routes/carriers.js` | 11–17 | ✅ `TODO: move webhook handler body into a dedicated CarrierWebhookController` — done; see `controllers/carriersController.js` |
| `routes/jobs.js` | 10 | ✅ `TODO: add injectOrgContext to dashboard and analytics routes` — done; both routes now use `injectOrgContext` |
| `routes/sla.js` | 10 | ✅ Joi query-validation schemas added for `getSlaViolations` (`page`, `limit`, `status`), `listExceptions` (`page`, `limit`, `severity`, `status`), `createException` body, and `resolveException` body — see `validators/slaSchemas.js` |
| `jobs/jobHandlers.js` | 101 | ✅ Return pickup reminders now dispatch real emails via `emailService.sendSimpleNotification(...)` and only mark as sent on success |
| `jobs/jobHandlers.js` | 218 | ✅ Notification dispatch now integrates concrete email delivery for `notificationType = 'email'` via `emailService` |
| `jobs/jobHandlers.js` | 261 | ✅ `TODO: Implement actual inventory sync logic` — `handleInventorySync` now reconciles `available_quantity = MAX(0, quantity - reserved_quantity)` for all rows in the target warehouse, returning drift-fixed count + stock stats |
| `jobs/jobHandlers.js` | 284 | ✅ `TODO: Implement actual report generation` — all 4 report generator helpers (`generateCarrierPerformanceReport`, `generateSLAComplianceReport`, `generateFinancialSummaryReport`, `generateInventorySnapshotReport`) now run real SQL queries against the DB |
| `services/assignmentRetryService.js` | 64 | ✅ `TODO: Send alert to operations team` — replaced with a direct `INSERT INTO alerts` creating a `critical` severity system alert visible in the dashboard |
| `services/shipping/carrierQuoteService.js` | 390 | *(TASK-R12-014)* `api_key_encrypted` field is present in SELECT but decryption is a no-op stub — tracked in C section |

---

## C. Production-Incomplete Features

| Feature | File(s) | Status |
|---------|---------|--------|
| Carrier API calls | `services/shipping/carrierQuoteService.js` — `getDHLQuote`, `getFedExQuote`, `getBlueDartQuote`, `getDelhiveryQuote` | *(deferred)* All return hard-coded simulated pricing. The real `axios.post()` calls are commented out. `api_key_encrypted` is never decrypted (TASK-R12-014). |
| Carrier reliability scores | `services/shipping/carrierSelectionService.js` | ✅ `selectBestQuote` and `getCarrierReliabilityScore` are now async and query `carriers.reliability_score` from the DB. Hard-coded industry fallbacks are retained for carriers not yet in the DB. Three call-sites in `shippingQuoteController.js` and the `carrierRateService.js` delegate are updated to `await`. |
| Email delivery | `controllers/usersController.js` + `services/emailService.js` | ✅ Verification emails are sent using nodemailer; SMTP is used when configured, with JSON transport fallback for local/dev |
| Notification jobs | `jobs/jobHandlers.js` | ✅ `notification_dispatch` and `return_pickup_reminder` now perform concrete email dispatch via `emailService` |
| Simulate-update route in production | `routes/shipments.js:41` | ✅ Now wrapped in `if (process.env.NODE_ENV !== 'production')` — endpoint absent in production builds |
| Zone / distance calculation | `utils/shippingHelpers.js:227`, `services/shipping/shippingUtils.js:72` | ✅ Both functions are now `async` and query `postal_zones` + `zone_distances` tables. Precise Haversine distance is used when lat/lon are populated; zone-pair distance table is used when only zone codes are available. Falls back to the first-3-digit approximation when the table is empty (tables remain seeded-empty until real pincode data is populated). |
| Per-carrier API timeout | `carriers` table | Migration `023` adds `api_timeout_ms` column. Column must be populated; currently defaults to 15 000 ms for all carriers. |

---



**Problem** — Express only forwards errors to the global error handler when `next(err)` is called.  Handlers declared as plain `async (req, res) =>` silently swallow unhandled promise rejections; the client hangs or receives no structured error.

**Fix** — Wrap every handler in `asyncHandler` (from `errors/index.js`), which calls `next(err)` automatically.

| File | Handlers fixed |
|------|---------------|
| `controllers/financeController.js` | `getInvoices`, `getInvoiceById`, `createInvoice`, `updateInvoice`, `getRefunds`, `processRefund`, `getDisputes`, `resolveDispute`, `getFinancialSummary` |
| `controllers/analyticsController.js` | `getAnalytics`, `getAnalyticsExport` |
| `controllers/returnsController.js` | `listReturns`, `getReturn`, `createReturn`, `updateReturn`, `getReturnStats` |
| `controllers/slaController.js` | All 7 handlers |
| `controllers/shipmentsController.js` | All handlers |

---

## 2. `console.error` Instead of `logger.error`

**Problem** — `console.error` bypasses the structured Winston logger; errors are never written to log files, never tagged with `requestId`/`organizationId`, and are invisible to any log aggregator.

**Fix** — Replace every `console.error(msg, err)` with `logger.error(msg, { error })`.

| File | Occurrences fixed |
|------|------------------|
| `controllers/financeController.js` | 8 |
| `controllers/slaController.js` | 6 |
| `controllers/shipmentsController.js` | 5 |
| `controllers/returnsController.js` | 5 |
| `controllers/analyticsController.js` | 2 |
| `controllers/jobsController.js` | residual via asyncHandler |

---

## 3. Direct Database Access Outside the Service / Repository Layer

**Problem** — Several controllers and route files issued `pool.query()` / `db.query()` calls directly, mixing data access with HTTP concerns and making the code untestable in isolation.

**Fix** — Consolidated query logic into `withTransaction` blocks inside the controllers as an intermediate step; full migration to repository classes is tracked separately.

Notable cases:
- `controllers/returnsController.js` — all 5 handlers used `pool` directly with no service layer
- `controllers/financeController.js` — 9 handlers used `db` directly
- `controllers/analyticsController.js` — `pool` imported directly; both handlers issue raw SQL

---

## 4. Missing Organization Scope on Mutations and Reads

**Problem** — Several write paths did not include `organization_id` in their `INSERT` or `WHERE` clauses, allowing cross-tenant data leakage or orphaned rows.

**Fixes applied:**

| Location | Issue | Fix |
|----------|-------|-----|
| `controllers/shipmentsController.js` — `createShipment` | `organization_id` not in INSERT | Added to VALUES list |
| `controllers/shipmentsController.js` — `updateShipmentStatus` | UPDATE had no `AND organization_id = $N` | Added org scope clause |
| `controllers/shipmentsController.js` — `getShipmentTimeline` | Used `req.user?.organizationId` (stale) | Switched to `req.orgContext?.organizationId` |
| `controllers/slaController.js` — all handlers | Used `req.user?.organizationId` (stale) | Switched to `req.orgContext?.organizationId` |
| `controllers/returnsController.js` — `updateReturn` / `getReturnStats` | Used `req.user?.organizationId` | Switched to `req.orgContext?.organizationId` |
| `controllers/analyticsController.js` | Used `req.user?.organizationId` | Switched to `req.orgContext?.organizationId` |
| `controllers/financeController.js` — `getInvoiceById`, `updateInvoice` | Mixed `req.user` and `req.orgContext` | Unified to `req.orgContext?.organizationId` |
| `services/jobsService.js` — cron schedule functions | No org filter on SELECT/INSERT/UPDATE/DELETE | All four functions now accept and apply `organizationId` |
| `services/jobsService.js` — `retryFromDeadLetterQueue` | New job had no `organization_id` | Looks up org from original job via JOIN before INSERT |

Canonical source for organization context is `req.orgContext.organizationId` set by the `injectOrgContext` middleware.  All use of the deprecated `req.user?.organizationId` path has been removed.

---

## 5. Missing or Insufficient Authorization on Routes

**Problem** — Several routes were publicly reachable by any authenticated user regardless of their role or permissions, or completely unauthenticated.

**Fixes applied:**

| Route | Fix |
|-------|-----|
| `POST /carriers/webhook/:carrierId` | Added `verifyWebhookSignature()` HMAC middleware |
| `GET /carriers/orders/:orderId/quote-status` | Added `authorize('orders:read')` |
| `GET /mdm/warehouses` and sub-routes | Added `requirePermission('warehouses.view')` |
| `GET /mdm/products` | Added `requirePermission('inventory.view')` |
| `GET /mdm/carriers/:carrierId/rates` | Added `requirePermission('carriers.view')` |
| `GET /mdm/sla-policies` | Restored accidentally removed `authorize('sla:read')` |
| All org mutation endpoints (`POST/PATCH/DELETE /organizations`) | Added `assertSuperadmin()` guard — only `role === 'superadmin'` may proceed |

Additionally, `routes/mdm.js` had a missing `authorize` import which caused a runtime crash on any request hitting those routes.  The import was added as a T0 (blocking) fix.

---

## 6. Logic Boundary Violations

**Problem** — Business rules, state machine logic, and complex SQL were embedded in route files or duplicated across controllers instead of living in service / helper layers.

**Fixes applied:**

| Violation | Fix |
|-----------|-----|
| `routes/carriers.js` webhook handler: carrier name taken from URL param (`req.params.carrierId`) and used as display name | Replaced with a single `SELECT id, name FROM carriers WHERE code = $1` lookup; DB name used throughout |
| `routes/carriers.js` DLQ retry: `DELETE FROM dead_letter_queue` on retry — deleted audit evidence | Changed to `UPDATE … SET reprocessed = true` |
| State machine not enforced on `updateShipmentStatus` | Added `SHIPMENT_VALID_TRANSITIONS` constant + `FOR UPDATE` lock check before any UPDATE |
| State machine not enforced on `updateReturn` | `RETURN_VALID_TRANSITIONS` was already present but transition check used `req.user?.organizationId`; fixed to `req.orgContext` |
| Admin password creation had no strength policy | Added `PASSWORD_STRENGTH_RE` validation (≥8 chars, uppercase, digit, symbol) in `organizationController.js` |
| Org mutations had no audit trail | Added `logger.info` structured audit log on `createOrganization`, `updateOrganization`, `deleteOrganization` |
| `PATCH /orders/:id/status` route was missing | Added route in `routes/orders.js` wired to existing `updateOrderStatus` handler |

---

## 7. N+1 Query Pattern

**Problem** — `listShipments` issued one `SELECT * FROM shipment_events WHERE shipment_id = $1` per shipment row returned, producing O(n) round trips to the database.

**Fix** — Replaced the per-shipment loop with a single `SELECT * FROM shipment_events WHERE shipment_id = ANY($1)` batched query, then grouped results in JavaScript before building the response.

---

## 8. SQL Injection via String Interpolation

**Problem** — `LIMIT` and `OFFSET` values in `listShipments` were concatenated directly into the query string (`LIMIT ${limit} OFFSET ${offset}`).  If an upstream middleware failed to coerce them to integers, raw user input reached the query.

**Fix** — Both values are now passed as positional parameters (`$N`, `$N+1`) with `parseInt()` guards before the query executes.

A second instance existed in `getFinancialSummary` (`dateFilter` string was interpolated into queries).  That handler's date filter is built from a closed whitelist (`day/week/month/year → fixed INTERVAL string`) so the injection surface is limited, but the pattern was left with a code comment for review.

---

## 9. Production-Incomplete Features

### Zone Calculation (pincode prefix approximation)

**Problem** — Shipping zone and distance estimation in two files used `pincode.substring(0, 3)` as a zone proxy with hard-coded 50 / 300 / 800 km buckets.  This produces inaccurate freight costs in production.

Files affected:
- `utils/shippingHelpers.js` — `ConfidenceCalculator.calculate`
- `services/shipping/shippingUtils.js` — `estimateDistanceFromPincode`

**Fix** — Added `// ⚠️ NOT_PRODUCTION_READY` comments at both call-sites, and created migration `024_postal_zones_stub.sql` which defines the target `postal_zones` and `zone_distances` tables.  The tables are seeded empty; once populated with real pincode data the two call-sites can be updated to use a lookup query instead of the substring approximation.

### Per-Carrier API Timeout

**Problem** — All carrier HTTP calls shared a single `CARRIER_API_TIMEOUT_MS` environment variable (defaulting to 10 seconds).  Carriers with slow or unreliable APIs could not be configured independently.

**Fix:**
1. Migration `023_carrier_api_timeout.sql` — adds `api_timeout_ms INTEGER CHECK (… BETWEEN 1000 AND 45000)` column to `carriers` table with default 15 000 ms.
2. Both `SELECT` queries in `carrierQuoteService.js` now include `api_timeout_ms`.
3. A `resolveCarrierTimeout(carrier)` helper resolves the effective timeout per carrier (DB value → env default → hard cap of 45 000 ms).
4. Timeout is threaded through `getCarrierQuoteWithAcceptance` → `getQuoteFromCarrier` → each carrier-specific function (`getDHLQuote`, `getFedExQuote`, etc.) and applied as the `timeout:` option in the commented-out axios config.
5. Global constant renamed `DEFAULT_CARRIER_API_TIMEOUT_MS = 15000`.

---

## 10. Dead Code

**Problem** — `CapacityManager` class (≈90 lines) in `utils/shippingHelpers.js` was exported but had zero callers in the codebase.  It mutated `carriers.current_load` — a field not present in any active migration — making it silently fail at runtime if ever called.

**Fix** — Class removed entirely.  Removed from the module's default export object as well.  `carrier_capacity_log` table still exists (created by migration `022_carrier_capacity.sql`) for future use; the logic can be re-introduced as a proper service method when the feature is needed.

---

## 11. fragile `COUNT(*)` Pattern

**Problem** — Several list endpoints derived the total-count query by applying a `.replace()` regex on the SELECT string to swap in `COUNT(*)`.  This breaks silently on CTEs, multi-line SELECTs, or any query with a sub-SELECT.

**Fix** — All affected endpoints now use subquery-based counting:
```sql
SELECT COUNT(*) FROM (...original query...) AS _cnt
```
Affected: `listShipments`, `listExceptions`, `getSlaViolations`, `listReturns` (already fixed in prior session), `getInvoices`, `getRefunds`, `getDisputes`.

---

## D. Service Layer Cleanup

### D1. `BaseService` class ✅ NEW

Created `services/BaseService.js` — mirrors `BaseRepository` for the service layer.

| Member | Description |
|--------|-------------|
| `this.pool` | Shared pg pool, exposed for helpers that need it |
| `async query(text, params, client?)` | Thin wrapper — uses `client` when provided (for in-transaction callers), otherwise falls back to `this.pool` |
| `async withTransaction(fn)` | Delegates to `withTransaction` from `utils/dbTransaction.js` — auto BEGIN/COMMIT/ROLLBACK/release |
| `async withTransactionRetry(fn, opts)` | Delegates to `withTransactionRetry` — retries on serialisation failures (code 40001) |

All new service classes should `extend BaseService` and call `this.query()` / `this.withTransaction()` instead of importing `pool` directly.

### D2. `pool.connect()` anti-pattern eliminated ✅

**Problem** — Seven service files managed transactions by calling `pool.connect()` and manually issuing `BEGIN` / `COMMIT` / `ROLLBACK` with `client.release()` in a `finally` block. This pattern is fragile: a missed `ROLLBACK` before an early `return` or any `throw` before the `finally` can exhaust the connection pool.

**Fix** — All 7 services now use `withTransaction(async (tx) => { ... })` which handles `BEGIN`, `COMMIT`, `ROLLBACK`, and `release` automatically.

| Service | Method(s) migrated | Notes |
|---------|--------------------|-------|
| `services/invoiceService.js` | `generateInvoiceForCarrier` | Early-exit for empty-shipments case now just `return null` (withTransaction commits a no-op) |
| `services/returnsService.js` | `processRefund` | Standard migration |
| `services/exceptionService.js` | `resolveException` | Added `withTransaction` import |
| `services/warehouseOpsService.js` | `pickItem`, `shipOrder` | Two separate pool.connect blocks, both migrated |
| `services/notificationService.js` | `createBulkNotifications` | Added `withTransaction` import |
| `services/jobsService.js` | `startJobExecution`, `completeJobExecution`, `failJobExecution`, `moveToDeadLetterQueue`, `retryFromDeadLetterQueue` | 5 blocks; early-exit race guard in `startJobExecution` now just `return null` |
| `services/alertService.js` | `triggerAlert` | Special rewrite: callback returns `{ suppressed, alert }` marker so dedup early-exit and new-alert path share one `withTransaction` call; COMMIT-before-side-effects guarantee is preserved because `withTransaction` commits synchronously before returning (TASK-R13-004) |

**Coverage** — `grep -rn 'pool\.connect()' services/` now returns zero results (only a JSDoc comment in `BaseService.js` mentioning the pattern).

---

## E. Input Validation Gap — Route-Level Schemas ✅ RESOLVED

**Problem** — Of the 15 route files, only 8 had Joi schemas wired to their mutation endpoints (`routes/inventory.js`, `routes/mdm.js`, `routes/orders.js`, `routes/returns.js`, `routes/shipments.js`, `routes/sla.js`, `routes/users.js`, `routes/organizations.js`).  The remaining 7 accepted arbitrary request bodies, allowing missing required fields, wrong types, and unexpected values to reach service and DB layers without rejection.

**Fix** — Created 4 new schema files and wired them into all 4 affected route files.  The `validateRequest(schema)` middleware strips unknown fields and coerces types via Joi; `validateQuery(schema)` does the same for query strings.

### New schema files

| File | Schemas exported |
|------|-----------------|
| `validators/financeSchemas.js` | `listInvoicesQuerySchema`, `listRefundsQuerySchema`, `listDisputesQuerySchema`, `financialSummaryQuerySchema`, `createInvoiceSchema`, `updateInvoiceSchema` (`.min(1)`), `processRefundSchema`, `resolveDisputeSchema` |
| `validators/jobSchemas.js` | `listJobsQuerySchema`, `listDLQQuerySchema`, `purgeDLQQuerySchema`, `createJobSchema`, `createCronScheduleSchema`, `updateCronScheduleSchema` (`.min(1)`) |
| `validators/companySchemas.js` | `createCompanySchema`, `updateCompanySchema` (`.min(1)`), `listCompaniesQuerySchema` |
| `validators/shippingSchemas.js` | `quickEstimateSchema` (`Joi.alternatives` — coordinate OR legacy pincode format), `getShippingQuotesSchema`, `getShippingQuotesWithCriteriaSchema`, `getQuoteFromCarrierSchema`, `selectQuoteSchema` |

### Routes updated

| Route file | Endpoints now validated |
|------------|------------------------|
| `routes/finance.js` | `GET /invoices`, `GET /refunds`, `GET /disputes`, `GET /financial-summary` (query); `POST /invoices`, `PATCH /invoices/:id`, `POST /refunds`, `POST /disputes/:id/resolve` (body) |
| `routes/jobs.js` | `GET /jobs`, `GET /dead-letter-queue` (query); `POST /jobs`, `POST /cron`, `PATCH /cron/:id` (body) |
| `routes/companies.js` | `GET /companies` (query); `POST /companies`, `PUT /companies/:id` (body) |
| `routes/shipping.js` | `POST /quick-estimate`, `POST /estimate`, `POST /quotes`, `POST /quotes/custom`, `POST /quotes/carrier`, `POST /quotes/select` (body) |

### `controllers/jobsController.js` — redundant inner try/catch removed ✅

All 12 handlers previously wrapped their body in a `try { … } catch (error) { res.status(500).json(…) }` block that was entirely redundant with `asyncHandler`.  Error-case responses that had been returned inline are now expressed as typed throws so the global error handler emits a consistent envelope:

| Old pattern | New pattern |
|-------------|-------------|
| `if (!retryableStatuses.includes(…)) return res.status(409).json({ error: … })` | `throw new ConflictError(…)` |
| `if (error.message === 'Job not found') return res.status(404).json(…)` | Deleted — service already throws `NotFoundError('Job')` which propagates via `asyncHandler` |
| `if (error.message.includes('Invalid cron expression')) return res.status(400).json(…)` | Deleted — service throws `ValidationError(…)` which propagates via `asyncHandler` |
| Manual `if (!job_type) return res.status(400).json(…)` | Deleted — `createJobSchema` enforces required fields at route level |
| `import logger from '../utils/logger.js'` (used only in catch blocks) | Import removed — error logging handled by global error handler |

---

| File | Changes |
|------|---------|
| `routes/mdm.js` | Import crash fix; `requirePermission` on read routes; sla-policies route restored |
| `routes/carriers.js` | HMAC webhook; `authorize` on quote-status; webhook carrier name from DB; DLQ `reprocessed` flag |
| `routes/orders.js` | Added `PATCH /orders/:id/status` |
| `controllers/shipmentsController.js` | `asyncHandler`; org scope; state machine; N+1 fix; parameterized pagination |
| `controllers/slaController.js` | `asyncHandler`; `req.orgContext`; `Promise.all` dashboard; logger |
| `controllers/organizationController.js` | Superadmin guard; password strength; audit logging |
| `controllers/financeController.js` | `asyncHandler`; `logger`; `req.orgContext` |
| `controllers/analyticsController.js` | `asyncHandler`; `logger`; `req.orgContext` |
| `controllers/returnsController.js` | `asyncHandler`; `logger`; `req.orgContext` |
| `controllers/usersController.js` | `asyncHandler`; `logger`; all 17 handlers wrapped |
| `controllers/dashboardController.js` | `asyncHandler`; `logger`; `req.orgContext` |
| `controllers/trackingController.js` | `asyncHandler` wrapping for all 5 handlers |
| `services/jobsService.js` | Org scope on all cron functions; DLQ retry preserves org; `reprocessed` flag |
| `services/shipping/carrierQuoteService.js` | Per-carrier timeout from DB; `resolveCarrierTimeout` helper; thread timeout through call chain |
| `services/shipping/shippingUtils.js` | `estimateDistanceFromPincode` now async; DB lookup via `postal_zones` + `zone_distances` with Haversine fallback |
| `utils/shippingHelpers.js` | `ConfidenceCalculator.calculate` now `static async`; DB-backed zone lookup with same fallback chain |
| `services/carrierRateService.js` | `estimateDistanceFromPincode` delegate now `async` |
| `services/BaseService.js` | **New**: `query()`, `withTransaction()`, `withTransactionRetry()` helpers for service layer |
| `services/invoiceService.js` | `generateInvoiceForCarrier` migrated from `pool.connect()` to `withTransaction` |
| `services/returnsService.js` | `processRefund` migrated from `pool.connect()` to `withTransaction` |
| `services/exceptionService.js` | `resolveException` migrated from `pool.connect()` to `withTransaction` |
| `services/warehouseOpsService.js` | `pickItem`, `shipOrder` migrated from `pool.connect()` to `withTransaction` |
| `services/notificationService.js` | `createBulkNotifications` migrated from `pool.connect()` to `withTransaction` |
| `services/jobsService.js` | 5 methods (`startJobExecution`, `completeJobExecution`, `failJobExecution`, `moveToDeadLetterQueue`, `retryFromDeadLetterQueue`) migrated; race-guard early-exit fixed |
| `services/alertService.js` | `triggerAlert` rewritten with `withTransaction`; dedup path + COMMIT-before-side-effects guarantee preserved |
| `migrations/023_carrier_api_timeout.sql` | New: `api_timeout_ms` column on `carriers` |
| `migrations/024_postal_zones_stub.sql` | New: `postal_zones` + `zone_distances` table stubs |
| `validators/financeSchemas.js` | **New**: 8 Joi schemas for finance endpoints (4 query + 4 mutation) |
| `validators/jobSchemas.js` | **New**: 6 Joi schemas for jobs/cron/DLQ endpoints (3 query + 3 mutation) |
| `validators/companySchemas.js` | **New**: 3 Joi schemas for company CRUD (1 query + 2 mutation) |
| `validators/shippingSchemas.js` | **New**: 5 Joi schemas for shipping quote endpoints; `quickEstimateSchema` uses `Joi.alternatives` to accept coordinate or legacy pincode format |
| `routes/finance.js` | Added `validateRequest`/`validateQuery` on all 9 routes |
| `routes/jobs.js` | Added `validateRequest`/`validateQuery` on POST /jobs, POST /cron, PATCH /cron/:id, GET /jobs, GET /dead-letter-queue |
| `routes/companies.js` | Added `validateRequest`/`validateQuery` on POST /companies, PUT /companies/:id, GET /companies |
| `routes/shipping.js` | Added `validateRequest` on all 6 POST quote/estimate routes |
| `controllers/jobsController.js` | `asyncHandler` wrapping; org scope on cron + DLQ; **all 12 redundant inner try/catch blocks removed** — `ConflictError` throws replace inline 409 returns; typed service errors propagate via asyncHandler; manual required-field guards deleted; `logger` import removed |
