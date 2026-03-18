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
