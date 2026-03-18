# Refactor Roadmap (2026-03)

## Why this exists

The platform has reached a point where feature delivery outpaced structural consistency. This roadmap is focused on reducing hidden risk, not cosmetic cleanup.

## Refactor goals

- Make behavior predictable across modules.
- Remove duplicate business rules and status mappings.
- Shrink large files into testable units.
- Align docs with actual runtime architecture.
- Move toward domain ownership instead of cross-layer leakage.

## Current high-risk hotspots

1. `backend/jobs/jobHandlers.js`
- Symptom: very large file, mixed responsibilities (parsing, normalization, import orchestration, business side-effects).
- Action: split helpers into `backend/jobs/importUtils.js` (started), then split per-import-type handlers.

2. Return status semantics across layers
- Symptom: legacy and canonical statuses mixed in queries/UI.
- Action: centralize status groups and enforce one transition model in service + repository + UI mapping.

3. Finance/returns aggregation contracts
- Symptom: frontend/backend key mismatches caused near-zero summaries.
- Action: formalize API response contracts and add integration tests for summary endpoints.

4. Notification pipeline consistency
- Symptom: events persisted but not delivered in real-time in previous state.
- Action: keep `notification:new` as single contract and ensure all notification creators use `notificationService`.

## Guardrails for all new changes

- No new business logic in route files.
- Repository layer handles SQL only; service layer owns workflow decisions.
- Every status transition must be validated by a state machine.
- New import logic should be added in dedicated files, not appended to a monolithic handler.
- Every cross-domain change must update docs in the same PR.

## Next implementation slices

1. Split import handlers by domain
- Target files:
  - `backend/jobs/importHandlers/ordersImportHandler.js`
  - `backend/jobs/importHandlers/shipmentsImportHandler.js`
  - `backend/jobs/importHandlers/inventoryImportHandler.js`
- Keep `jobHandlers.js` as dispatcher only.

2. Add integration tests for critical contracts
- `GET /api/finance/summary`
- `GET /api/returns`
- Notification create + socket delivery smoke test

3. Introduce a domain migration path document
- Define phased move from `controllers/services/repositories` to bounded modules without breaking active delivery.

## Done in this cycle

- Extracted import parsing/normalization helpers into `backend/jobs/importUtils.js`.
- Updated docs index and architecture structure notes to reflect current hybrid architecture truthfully.
- Extracted shared import execution path to `backend/jobs/importRunner.js`.
- Split import handlers into `backend/jobs/importHandlers/masterDataImportHandlers.js` and `backend/jobs/importHandlers/commerceImportHandlers.js`.
- Introduced shared return status contract in `backend/config/returnStatuses.js` and wired returns/finance/order service and validator usage to it.
- Extracted report-generation job logic from `backend/jobs/jobHandlers.js` into `backend/jobs/reportHandlers.js`.
- Extracted webhook-processing job logic from `backend/jobs/jobHandlers.js` into `backend/jobs/webhookHandlers.js`.
- Extracted scheduled/maintenance job logic from `backend/jobs/jobHandlers.js` into `backend/jobs/scheduledHandlers.js`, leaving `jobHandlers.js` as registry wiring.
- Added route contract tests for `GET /api/finance/summary` (auth guard + response-shape checks).
- Added route contract tests for `GET /api/returns` (auth guard + stats/list mapping checks).
- Added notification realtime smoke test for `notificationService.createNotification` emit contract.
- Completed Batch 1 security disposition and first hardening patches (`demo` token placeholder, SRI attributes, backend non-root + healthcheck, frontend healthcheck).
- Completed first `backend/controllers/mdmController.js` maintainability slice by extracting shared warehouse mappers and normalizing `parseInt(..., 10)` usage.
- Logged policy decision to treat `demo/` as out-of-scope simulation/testing for strict remediation gates.
- Completed first `backend/repositories/WarehouseRepository.js` maintainability slice (shared pagination total parser + radix normalization in stats parsing).
- Completed first `backend/repositories/ShipmentRepository.js` maintainability slice (shared pagination total parser + radix normalization in on-time stats parsing).
- Completed first `backend/controllers/analyticsController.js` maintainability slice (explicit radix normalization for analytics response parsing).
- Completed first `backend/services/orderService.js` maintainability slice (explicit radix normalization for order status stats parsing).
- Completed first `backend/controllers/returnsController.js` maintainability slice (explicit radix normalization for pagination/stats parsing).
- Completed first `backend/repositories/OrganizationRepository.js` maintainability slice (shared pagination total-count parser reuse).
- Completed first `backend/repositories/UserRepository.js` maintainability slice (shared pagination total-count parser reuse).
- Completed fast multi-file radix normalization batch in `ProductRepository`, `CarrierAssignmentRepository`, `NotificationRepository`, `BaseRepository`, and `queues/index.js` with one consolidated test run.
