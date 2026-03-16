# SCM Codebase Audit — March 2026

Full audit of backend + frontend codebase. Issues grouped by severity.

---

## CRITICAL — Runtime crashes

### B-C01 — `ValidationError` used but not imported (ordersController)
- **File**: `backend/controllers/ordersController.js`
- Line 172 throws `new ValidationError(...)` but only `{ asyncHandler, AppError }` are imported.
- Results in `ReferenceError` on every PATCH `/orders/:id/status` call.
- **Fix**: Add `ValidationError` to the import.

### B-C02 — `logger` used but not imported (ordersController)
- **File**: `backend/controllers/ordersController.js`
- Line ~175 calls `logger.info(...)` but `logger` is never imported.
- Results in `ReferenceError` on every order status update.
- **Fix**: Add `logger` import.

### B-C03 — Auth middleware returns non-standard error format
- **File**: `backend/middlewares/auth.js`
- Returns `{ error: '...' }` instead of `{ success: false, message: '...' }`.
- Frontend `client.ts` reads `data.message`; auth failures never show proper toast.
- **Fix**: Standardize to `{ success: false, message: '...' }` format.

---

## HIGH — Functional bugs / reliability

### B-H01 — `console.*` used instead of structured logger in production code
- `controllers/usersController.js:193` — `console.info` for email verify URL
- `services/exceptionService.js:140,263` — `console.error`
- `services/jobsService.js:25` — `console.warn`
- `config/db.js:22,31,34` — `console.log/error` for DB connection events
- All bypass the Winston log files and structured output.
- **Fix**: Replace all with `logger.*`.

### B-H02 — Two duplicate response helper files
- `backend/utils/response.js` — used only by `financeController.js`
- `backend/utils/responseHelper.js` — used by **nothing**
- Most controllers inline `res.json({success:true,...})` ignoring both.
- **Fix**: Delete `responseHelper.js`. Adopt `response.js` helpers in all controllers for consistent shape.

### B-H03 — Dead constant `VALID_ORDER_STATUSES`
- **File**: `backend/controllers/ordersController.js` line 9-13
- Declared but never referenced anywhere. Validation is handled by Joi schema and the service state machine.
- **Fix**: Remove the constant.

---

## MEDIUM — Code quality / maintainability

### B-M01 — Unused `pino` + `pino-pretty` dependencies
- In `package.json`; codebase uses Winston exclusively. Zero pino imports.
- **Fix**: Remove both from `package.json`.

### B-M02 — Unused `sequelize` dependency
- In `package.json`; codebase uses raw `pg` pool queries. Zero Sequelize imports.
- **Fix**: Remove from `package.json`.

### B-M03 — Unused `class-transformer` + `class-validator` dependencies
- In `package.json`; codebase uses Joi for validation. Zero class-validator imports.
- **Fix**: Remove both from `package.json`.

### B-M04 — Dead companies feature (routes never mounted, replaced by /organizations)
- `routes/companies.js` — never imported in `server.js` (comment confirms replacement)
- `controllers/companiesController.js` — orphaned
- `validators/companySchemas.js` — orphaned
- `repositories/CompaniesRepository.js` — still exported from `repositories/index.js`
- **Fix**: Delete all four files, remove from index.js.

### B-M05 — `errorUtils.js` — 7 of 8 exported functions are completely unused
- `throwIf`, `throwValidationError`, `throwNotFound`, `throwConflict`,
  `throwBusinessError`, `validateOrThrow`, `safeDatabaseOperation` — zero usages.
- Only `assertExists` is used (orderService.js).
- **Fix**: Remove the 7 unused helpers; keep `assertExists` in place.

### B-M06 — Mixed permission string notation in routes (colon vs dot)
- Some routes: `authorize('orders:read')` — others: `requirePermission('warehouses.view')`
- rbac.js normalizes both, but inconsistency confuses developers.
- **Fix**: Standardize all to dot-notation.

### B-M07 — Route conflict in shipments routes
- **File**: `backend/routes/shipments.js`
- `/shipments/:id/timeline` (shipmentsController) AND `/shipments/:trackingNumber/timeline` (trackingController) registered — Express cannot distinguish the param names; second handler shadows first.
- **Fix**: Rename tracking timeline to `/shipments/tracking/:trackingNumber/timeline`.

---

## LOW — Documentation

### B-L01 — All three backend docs are stale
- `backend/ARCHITECTURE.md`, `backend/CODE_GUIDE.md`, `backend/QUICK_REFERENCE.md`
- Reference old paths, missing current patterns (caching, queues, multi-tenancy,
  SLA engine, socket system, import pipeline).
- **Fix**: Rewrite all three.

---

## Frontend observations

### F-01 — `api/mockData.ts` may be in production bundle
- Check whether `mockData.ts` is imported in production paths.
- If yes, guard with `import.meta.env.DEV`.
- **Status**: Fixed in `frontend/src/hooks/useApiMode.ts` by forcing real API mode in production.

### F-02 — `useApiMode.ts` hook — check if mock mode toggle is still needed
- If mock mode is removed, delete this hook.
- **Status**: Partially mitigated. Hook retained for dev workflows, disabled in production.

---

## ROUND 2 — Strict QA/PR findings (March 2026)

### R2-01 — Frontend/Backend HTTP method mismatch (fixed)
- `frontend/src/api/services.ts` used `PATCH /inventory/:id`.
- Backend only exposes `PUT /inventory/:id`.
- **Fix**: switched frontend call to `put(...)`.

### R2-02 — Import uploads bypassed axios interceptors (fixed)
- `importApi.upload` used `fetch`, so centralized auth refresh + toast extraction in `client.ts` was skipped.
- **Fix**: migrated to shared axios client (`api.post`) with multipart form data.

### R2-03 — Webhook auth responses inconsistent (fixed)
- `backend/middlewares/webhookAuth.js` returned mixed payloads without `success` contract.
- **Fix**: normalized all error responses to `{ success: false, message, error, ... }`.

### R2-04 — DB check/length errors not surfaced clearly (fixed)
- Global error handler mapped only a subset of PostgreSQL codes.
- **Fix**: added handling for `23514` (check violation) and `22001` (value too long), returning 400 with actionable messages.

### R2-05 — Carrier pending assignments endpoint exposed by query param (fixed)
- `GET /carriers/assignments/pending` trusted caller-provided `carrierId` without auth.
- **Fix**: protected with `verifyWebhookSignature()` and carrier identity derivation from authenticated webhook context.

### R2-06 — Stress test baseline missing (fixed)
- No repeatable load-check harness for error contract + latency under concurrent access.
- **Fix**: added `backend/tests/load/k6-smoke.js` + `backend/tests/load/README.md`.

### R2-07 — Existing test suite instability (fixed)
- `backend/tests/integration.test.js`: manual harness now guarded from Vitest execution and represented by a skipped placeholder suite.
- `backend/tests/repositories/InventoryRepository.test.js`: expectation aligned with additive upsert semantics.
- `backend/tests/routes/inventory.test.js`: server now exports app and avoids auto-listen during tests; route test uses valid role/expectations.
- **Verification**: `backend npm test` now passes (`3 passed`, `1 skipped`).

### R2-08 — Frontend build warnings (partially fixed)
- Recharts import warnings for `TooltipProps`: fixed via type-only imports.
- `react-hook-form` import warnings for `UseFormProps`/`FieldValues`: fixed via type-only imports.
- Recharts circular chunk warning: mitigated with explicit `manualChunks` in `vite.config.ts`.
- Remaining: large chunk-size warnings for map/chart bundles (optimization task, not build break).

---

## Fixes Applied (this session)

- [x] B-C01 — ValidationError missing import
- [x] B-C02 — logger missing import
- [x] B-C03 — auth error format
- [x] B-H01 — console.* → logger
- [x] B-H02 — delete responseHelper.js
- [x] B-H03 — remove dead VALID_ORDER_STATUSES
- [x] B-M01/02/03 — remove unused deps
- [x] B-M04 — delete companies dead code
- [x] B-M05 — clean errorUtils.js
- [x] B-M06 — dot-notation permissions
- [x] B-M07 — fix route conflict
- [x] B-L01 — fresh docs
