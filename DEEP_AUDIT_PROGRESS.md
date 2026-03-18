# Deep Audit Progress

Last updated: 2026-03-18

## Fixed in this pass

- Documentation drift cleanup (core docs):
  - Updated documentation index and stack notes to reflect current runtime reality (BullMQ workers, React 19, hybrid architecture state).
  - Replaced architecture structure doc that described an ideal-only layout with a current-state + migration-path document.
  - Added a concrete refactor roadmap file for phased cleanup.
  - Files: `docs/README.md`, `docs/architecture/STRUCTURE.md`, `docs/guides/REFACTOR_ROADMAP_2026_03.md`.

- Monolith reduction in import pipeline:
  - Extracted CSV/import normalization helpers from `jobHandlers.js` into `backend/jobs/importUtils.js`.
  - `jobHandlers.js` now focuses more on orchestration and domain flow, reducing local cognitive load and making further per-import splitting easier.
  - Files: `backend/jobs/importUtils.js`, `backend/jobs/jobHandlers.js`.

- Import pipeline decomposition (phase 2):
  - Extracted shared import runner into `backend/jobs/importRunner.js` (progress emits, error summarization, cache invalidation, cleanup).
  - Split domain import handlers into:
    - `backend/jobs/importHandlers/masterDataImportHandlers.js` (warehouses, carriers, suppliers, channels, team, products)
    - `backend/jobs/importHandlers/commerceImportHandlers.js` (inventory, orders, shipments)
  - `backend/jobs/jobHandlers.js` now acts as job registry/orchestration glue instead of carrying import internals.
  - Size impact: `jobHandlers.js` reduced from ~1490 lines to ~738 lines.

- Job handler decomposition (phase 3):
  - Extracted report generation orchestration and report-specific builders into `backend/jobs/reportHandlers.js`.
  - Removed report data access dependencies from `jobHandlers.js` and kept registry wiring only.
  - Size impact: `jobHandlers.js` reduced from ~738 lines to ~618 lines in this slice.
  - Files: `backend/jobs/reportHandlers.js`, `backend/jobs/jobHandlers.js`.

- Job handler decomposition (phase 4):
  - Extracted webhook-oriented handlers (`process_order`, `update_tracking`, `sync_inventory`, `process_return`, `process_rates`) into `backend/jobs/webhookHandlers.js`.
  - Removed webhook service/repository dependencies from `jobHandlers.js`; it now focuses on scheduled job handlers and registry mapping.
  - Size impact: `jobHandlers.js` reduced from ~618 lines to ~337 lines in this slice.
  - Files: `backend/jobs/webhookHandlers.js`, `backend/jobs/jobHandlers.js`.

- Job handler decomposition (phase 5):
  - Extracted remaining scheduled/maintenance handlers (`sla_monitoring`, `exception_escalation`, `invoice_generation`, `return_pickup_reminder`, `data_cleanup`, `notification_dispatch`, `inventory_sync`, `carrier_assignment_retry`) into `backend/jobs/scheduledHandlers.js`.
  - `backend/jobs/jobHandlers.js` is now a thin registry that only wires handler maps and import namespaces.
  - Size impact: `jobHandlers.js` reduced from ~337 lines to ~62 lines in this slice.
  - Files: `backend/jobs/scheduledHandlers.js`, `backend/jobs/jobHandlers.js`.

- Critical contract test coverage (finance summary):
  - Added deterministic route test for `GET /api/finance/summary` with repository mocking, including auth guard and canonical response-shape assertions.
  - File: `backend/tests/routes/finance.test.js`.

- Critical contract test coverage (returns list):
  - Added deterministic route test for `GET /api/returns` with repository mocking, including auth guard, pagination/stats assertions, and canonical list mapping checks.
  - File: `backend/tests/routes/returns.test.js`.

- Notification realtime smoke coverage:
  - Added service-level test for `notificationService.createNotification` to verify persistence + `emitToUser(..., 'notification:new', ...)` dispatch contract.
  - File: `backend/tests/services/notificationService.test.js`.

- Batch 1 security triage + low-risk hardening:
  - Added disposition log for report security findings with explicit statuses (`FIX_NOW`, `ACCEPT_WITH_NOTE`, `REVIEW_POLICY`).
  - Replaced hardcoded demo token literal in `demo/customer.js` with placeholder `REPLACE_WITH_DEMO_WEBHOOK_TOKEN`.
  - Added SRI integrity attributes for external MapLibre CSS/JS in `demo/customer.html`.
  - Hardened backend container with non-root runtime user and `/health`-based Docker `HEALTHCHECK`.
  - Hardened `backend/utils/cryptoUtils.js` decryption by explicitly setting GCM `authTagLength`.
  - Added frontend container `HEALTHCHECK`; frontend non-root runtime remains policy-coordinated follow-up.
  - Files: `docs/guides/SECURITY_DISPOSITION_2026-03-18.md`, `docs/guides/KEEP_OR_CHANGE_REVIEW_LIST_2026-03-18.md`, `demo/customer.js`, `demo/customer.html`, `backend/Dockerfile`, `frontend/Dockerfile`.
  - User policy decision: `demo/` is simulation/testing scope and excluded from strict remediation gating.

- MDM controller micro-refactor (safe cleanup slice):
  - Reduced response-mapping duplication by extracting shared warehouse mappers in `mdmController`.
  - Added explicit radix (`10`) to all `parseInt` calls in `mdmController` to clear anti-pattern noise without behavior change.
  - File: `backend/controllers/mdmController.js`.

- Warehouse repository micro-refactor (safe cleanup slice):
  - Added small shared total-count parser to reduce pagination duplication.
  - Added explicit radix (`10`) for warehouse inventory stats parsing.
  - File: `backend/repositories/WarehouseRepository.js`.

- Shipment repository micro-refactor (safe cleanup slice):
  - Added small shared total-count parser for shipment pagination result mapping.
  - Added explicit radix (`10`) in on-time rate numeric parsing.
  - File: `backend/repositories/ShipmentRepository.js`.

- Analytics controller micro-refactor (safe cleanup slice):
  - Normalized analytics numeric parsing to explicit `parseInt(..., 10)` usage across response mapping.
  - File: `backend/controllers/analyticsController.js`.

- Order service micro-refactor (safe cleanup slice):
  - Normalized order status stats parsing to explicit `parseInt(..., 10)` usage.
  - File: `backend/services/orderService.js`.

- Returns controller micro-refactor (safe cleanup slice):
  - Normalized pagination and stats integer parsing to explicit `parseInt(..., 10)` usage.
  - File: `backend/controllers/returnsController.js`.

- Organization repository micro-refactor (safe cleanup slice):
  - Added shared pagination total-count parser and routed list/global-user queries through it.
  - File: `backend/repositories/OrganizationRepository.js`.

- User repository micro-refactor (safe cleanup slice):
  - Added shared pagination total-count parser for user list response mapping.
  - File: `backend/repositories/UserRepository.js`.

- Fast batch cleanup (multi-file radix normalization):
  - Normalized remaining `parseInt` radix usage in:
    - `backend/repositories/ProductRepository.js`
    - `backend/repositories/CarrierAssignmentRepository.js`
    - `backend/repositories/NotificationRepository.js`
    - `backend/repositories/BaseRepository.js`
    - `backend/queues/index.js`
  - Batch validated with one consolidated backend test run.

- Fast batch cleanup (cross-layer radix sweep):
  - Applied explicit radix normalization across remaining backend and frontend callsites touched in this pass (controllers, repositories, services, import handlers, and selected UI/API mappers).
  - Fixed one codemod edge case in `frontend/src/pages/orders/components/CreateOrderModal.tsx` where nested `String(...)` parsing needed manual correction to `parseInt(String(...), 10)`.
  - Consolidated validation run completed after this wider batch.

- Fast batch cleanup (low-risk style anti-patterns):
  - Replaced simple string concatenations with template literals in targeted hotspots (`WarehouseUtilizationChart`, `api/client`, `api/mockData`, `lib/utils`).
  - Replaced one non-reassigned `let` with `const` in `backend/repositories/ProductRepository.js`.
  - Per-file diagnostics check completed; no new file-specific issues introduced by this slice.

- Fast batch cleanup (frontend coercion + import hygiene):
  - Normalized double-negation coercions to `Boolean(...)` across frontend state and modal/open-state paths (stores, warehouses, partners, team, super-admin pages, metric cards).
  - Removed duplicate `@/components/ui` import usage pattern in `OrdersPage` and `ShipmentsPage` by consolidating `useToast` into grouped imports.
  - Reworked settings page bootstrap effects (`SecuritySettings`, `ProfileSettings`, `NotificationSettings`) from promise chains into async IIFEs to clear promise-flow anti-pattern noise.
  - Diagnostics check on all touched files: clean.

- Fast batch cleanup (destructuring + syntax):
  - Applied `prefer-destructuring` fixes in `OrderStatusChart`, `useFormValidation`, `routing`, and `LocationPicker`.
  - Removed unnecessary trailing semicolon from public not-found page component.
  - Diagnostics check on this slice: clean.

- Fast batch cleanup (arrow clarity):
  - Removed `no-confusing-arrow` style patterns by wrapping conditional arrow returns explicitly in:
    - `frontend/src/pages/orders/components/CreateOrderModal.tsx`
    - `frontend/src/pages/products/ProductsPage.tsx`
  - Diagnostics check on this slice: clean.

- Return status contract centralization:
  - Added shared status contract in `backend/config/returnStatuses.js` with transitions and grouped status arrays.
  - Rewired service, repository, and validator layers to consume shared constants instead of duplicating status literals.
  - This includes return transition validation, return stats aggregation filters, finance refund eligibility filters, and order return-open checks.
  - Files: `backend/config/returnStatuses.js`, `backend/services/returnsService.js`, `backend/repositories/ReturnRepository.js`, `backend/repositories/FinanceRepository.js`, `backend/validators/returnSchemas.js`, `backend/validators/financeSchemas.js`, `backend/services/orderService.js`.

- Notifications not appearing in real-time:
  - Root cause: frontend listens for `notification:new`, but backend notification creation did not emit socket events.
  - Fix: sockets now join per-user rooms (`user:{userId}`), added `emitToUser`, and `notificationService.createNotification` now emits `notification:new` payloads.
  - Files: `backend/sockets/index.js`, `backend/sockets/emitter.js`, `backend/services/notificationService.js`.

- Notification clear-all not persisted:
  - Root cause: Notifications page cleared local store only.
  - Fix: added `DELETE /notifications` client call and wired page action to backend with recovery refresh on failure.
  - Files: `frontend/src/api/services.ts`, `frontend/src/pages/notifications/NotificationsPage.tsx`.

- Finance summary/refund mismatches:
  - Root causes:
    - Frontend mapped summary keys to fields not returned by backend (`outstanding_amount`, `total_amount`, `open`).
    - Refund summary excluded rows with null `resolved_at`.
  - Fixes:
    - Frontend now maps both canonical backend keys (`pending_amount`, `total_refund_amount`, `total_disputes`) and legacy fallbacks.
    - Refund processed date now uses `resolved_at`.
    - Backend summary now filters refunded rows using `COALESCE(resolved_at, updated_at, created_at)`.
  - Files: `frontend/src/pages/finance/hooks/useFinance.ts`, `frontend/src/api/services.ts`, `backend/repositories/FinanceRepository.js`.

- Returns status consistency:
  - Root cause: repository stats still counted legacy statuses (`pending`, `processing`, `completed`) while active workflows use `requested`, `inspecting`, `refunded/restocked`.
  - Fix: return stats aggregation now includes canonical + legacy states; controller exposes both `pending` and `requested` compatibility keys.
  - Files: `backend/repositories/ReturnRepository.js`, `backend/controllers/returnsController.js`.

- Finance filter validator mismatch:
  - Root cause: finance query schemas accepted statuses unrelated to stored return/invoice dispute values.
  - Fix: aligned refund/dispute query allowed values with backend domain statuses.
  - File: `backend/validators/financeSchemas.js`.

- Import live refresh stale after completion:
  - Root cause: list/dash caches (30s/60s) were not invalidated by import jobs.
  - Fix: import job handlers now invalidate relevant cache patterns per import type after successful non-dry-run writes.
  - Files: `backend/jobs/jobHandlers.js`.

- Filters showing empty data on paginated pages:
  - Root cause: status tabs filtered current page slice in frontend instead of querying backend with status filter + page reset.
  - Fix: migrated orders/shipments/returns/exceptions/inventory tabs to server-side filtering, and reset page to 1 on tab change.
  - Files: 
    - `frontend/src/pages/orders/OrdersPage.tsx`, `frontend/src/pages/orders/hooks/useOrders.ts`
    - `frontend/src/pages/shipments/ShipmentsPage.tsx`, `frontend/src/pages/shipments/hooks/useShipments.ts`
    - `frontend/src/pages/returns/ReturnsPage.tsx`, `frontend/src/pages/returns/hooks/useReturns.ts`
    - `frontend/src/pages/exceptions/ExceptionsPage.tsx`, `frontend/src/pages/exceptions/hooks/useExceptions.ts`
    - `frontend/src/pages/inventory/InventoryPage.tsx`, `frontend/src/pages/inventory/hooks/useInventory.ts`
    - `backend/controllers/inventoryController.js`, `backend/repositories/InventoryRepository.js`, `backend/validators/inventorySchemas.js`

- Import failure visibility:
  - Fix: import-complete toasts for orders/shipments/inventory now include preview of failed rows and reasons when available.
  - Files: `frontend/src/pages/orders/OrdersPage.tsx`, `frontend/src/pages/shipments/ShipmentsPage.tsx`, `frontend/src/pages/inventory/InventoryPage.tsx`.

- Transfer order FK failure (`order_items_product_id_fkey`):
  - Root cause: transfer item `product_id` could be stale/missing while SKU existed.
  - Fix: resolve product by `product_id` or `sku` before creating order items; use resolved product IDs in transfer order path.
  - Files: `backend/services/orderService.js`.

- SLA/dashboard metric inconsistencies and invalid defaults:
  - Fixes:
    - SLA dashboard compliance now excludes shipments with no matched policy/schedule.
    - Compliance defaults to `0` when no eligible shipments (instead of `100`).
    - Dashboard on-time defaults to `0` when no deliveries.
    - Dashboard average delivery days is clamped non-negative.
  - Files: `backend/repositories/SlaRepository.js`, `backend/controllers/slaController.js`, `backend/controllers/dashboardController.js`.

- Warehouse markers outside India due likely lat/lng swaps:
  - Fix: auto-correct common swapped coordinate imports when swapped values map inside India bounds.
  - File: `frontend/src/pages/warehouses/WarehousesPage.tsx`.

## Verified after fixes

- Backend tests: pass (`11 passed`, `1 skipped`).
- Frontend build: pass (`vite build` successful).
- Backend tests re-run after latest MDM/security slices: pass (`11 passed`, `1 skipped`).
- Backend tests re-run after shipment repository slice: pass (`11 passed`, `1 skipped`).
- Backend tests re-run after analytics controller slice: pass (`11 passed`, `1 skipped`).
- Backend tests re-run after order service slice: pass (`11 passed`, `1 skipped`).
- Backend tests re-run after returns controller slice: pass (`11 passed`, `1 skipped`).
- Backend tests re-run after organization repository slice: pass (`11 passed`, `1 skipped`).
- Backend tests re-run after user repository slice: pass (`11 passed`, `1 skipped`).
- Backend tests re-run after fast multi-file radix batch: pass (`11 passed`, `1 skipped`).
- Backend tests re-run after cross-layer radix sweep: pass (`11 passed`, `1 skipped`).
- Frontend build re-run after cross-layer radix sweep: pass (`vite build` successful).

## Open items from user report (pending next pass)

- Notification reliability end-to-end (creation, storage, dispatch, frontend rendering) deep trace.
- Returns-vs-orders reconciliation for imported historical statuses (`orders.status = returned` but no return rows).
- Finance data pipeline/import validation and page stats mismatch (currently reporting near-zero).
- Skeleton stuck loading for some users: needs reproducible trace (network timeout, abort handling, cache/session variance).
- Supplier confirmation workflow for stock adjustment and supplier-side acceptance simulation (requires backend domain design + UI/API implementation).
- Full end-to-end QA sweep requested across all pages/APIs/DB consistency (in progress).

## Suggested next execution block

1. Instrument and verify notification pipeline (job -> DB -> socket/UI).
2. Reconcile orders/returns/finance imported-history semantics and create data-repair scripts where needed.
3. Build supplier-confirmation workflow (new tables, APIs, and production-ready supplier acceptance UI).
4. Run API-by-API request/response + DB consistency checks and append findings here.
