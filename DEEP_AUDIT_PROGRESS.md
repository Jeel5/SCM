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

- Backend tests: pass (`6 passed`, `1 skipped`).
- Frontend build: pass (`vite build` successful).

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
