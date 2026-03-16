# Backend Code Guide

## Goals
- Keep controllers thin.
- Keep business logic in services.
- Keep SQL in repositories.
- Return consistent success/error response shapes.
- Prefer explicit, observable behavior over hidden magic.

## File Ownership Rules
- Route file: auth, permission, validation middleware chain + handler wiring.
- Controller file: parse request, call service/repo, map to response.
- Service file: enforce business invariants, transactions, orchestration.
- Repository file: query construction and DB mapping only.

Do not mix these concerns.

## Response Standards
Success:

```json
{ "success": true, "data": {} }
```

Failure:

```json
{ "success": false, "message": "...", "error": "...", "details": [] }
```

Auth middleware and validation middleware must also follow this contract.

## Validation Rules
- Use Joi schemas from `validators/*Schemas.js`.
- Use `validateRequest` for body validation and `validateQuery` for query validation.
- Do not rely on implicit frontend validation.

## Error Handling Rules
- Throw typed errors (`ValidationError`, `NotFoundError`, `ConflictError`, `ForbiddenError`, etc.).
- Avoid returning ad-hoc `{ error: ... }` responses from deep layers.
- Let the global error handler format final API output.

## Logging Rules
- Use `utils/logger.js` only.
- Do not use `console.log/info/warn/error` in production code.
- Include metadata objects for useful diagnostics (`userId`, `organizationId`, IDs, operation names).

## RBAC + Permissions
- Use dot notation permissions only in routes and checks:
  - `orders.view`
  - `orders.create`
  - `orders.update`
- Keep permission definitions centralized in `config/permissions.js`.

## Multi-tenancy Rules
- Always scope data access by organization when required.
- Never trust organization IDs from request payload if user context already provides org scope.
- Preserve `req.orgContext` semantics from auth middleware.

## Transaction Rules
- Use `withTransaction` for multi-step writes that must be atomic.
- Repositories should accept transaction clients when needed.

## Background Job Rules
- Record jobs in DB before enqueueing.
- Queue enqueue failures should be logged as non-fatal when DB record exists.
- Retrying/canceling should be idempotent.

## Testing Expectations
- Add or update integration tests when changing:
  - auth behavior
  - route contracts
  - status transitions
  - job flow and retries
- Verify both happy-path and rejection-path behavior.

## PR Checklist
- No dead code left behind.
- No console logging.
- No unused imports/exports.
- Permission strings use dot notation.
- New endpoints documented in quick reference.
- Test suite passes (`npm test`).
