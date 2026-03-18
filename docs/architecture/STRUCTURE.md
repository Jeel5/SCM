# Codebase Structure: Current State and Target State

> Last updated: 2026-03-18

## Current runtime structure (what exists today)

Backend currently runs with a layered layout:

- `backend/controllers/`
- `backend/services/`
- `backend/repositories/`
- `backend/routes/`
- `backend/jobs/`
- `backend/queues/`
- `backend/sockets/`
- `backend/utils/`, `backend/validators/`, `backend/middlewares/`

Frontend is route/page oriented with shared UI and hooks:

- `frontend/src/pages/`
- `frontend/src/components/`
- `frontend/src/hooks/`
- `frontend/src/api/`
- `frontend/src/stores/`

This is the source of truth for production behavior today.

## Target architecture direction (incremental)

We are moving toward stronger domain ownership, but we are not doing a risky big-bang rewrite.

Target shape:

- Domain-owned modules for business areas (orders, shipments, inventory, returns, finance, SLA, notifications, etc.)
- Thin HTTP adapter layer
- Service layer as workflow/state owner
- Repository layer as SQL-only boundary
- Shared platform services for auth, jobs, logging, caching, sockets

## Refactor policy

1. Do not add new business logic to route files.
2. Prefer extracting complexity into domain-focused files rather than expanding existing monolith files.
3. Keep status/state transitions centralized in service state machines.
4. Keep API contracts stable; add compatibility mapping at boundaries when necessary.
5. Update docs whenever behavior changes.

## Current known structural debt

- Some large files still mix orchestration and transformation logic.
- Status enums are not fully centralized across backend + frontend.
- Some historical docs describe idealized layout instead of current runtime layout.

## Active cleanup examples

- Import helpers extracted from `backend/jobs/jobHandlers.js` to `backend/jobs/importUtils.js`.
- Real-time notifications standardized with per-user socket rooms and `notification:new` event emission from `notificationService`.
- Returns/finance status aggregations aligned to canonical workflow statuses with legacy compatibility.

## What "good" looks like for new code

- A single domain rule should have one owner.
- SQL should be testable and isolated.
- Socket events and API responses should have documented contracts.
- No duplicate fallback logic spread across multiple layers unless explicitly compatibility-related.
