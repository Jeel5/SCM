# Backend Architecture

## Overview
The backend is an Express 5 API using PostgreSQL (`pg`), Redis, and BullMQ.
It is multi-tenant: every business query is scoped by organization context resolved in auth middleware.

Core runtime flow:
1. HTTP request enters `server.js`
2. Security and request middleware run (`helmet`, `cors`, parsers, request IDs, logging, rate limits)
3. Route-level auth + permission checks run
4. Controller validates input and delegates to service/repository logic
5. Errors bubble to centralized error handler with consistent JSON responses

## Layers
- `routes/`: endpoint wiring, middleware chain, request validation hooks.
- `controllers/`: HTTP concerns only (`req/res` mapping).
- `services/`: business rules, transactions, cross-repository orchestration.
- `repositories/`: SQL access via `pg` pool and base repository helpers.
- `middlewares/`: cross-cutting concerns (auth, RBAC, rate limiting, request logging).
- `errors/`: typed app errors + global handler.
- `jobs/`, `queues/`: async job execution with BullMQ workers and cron sync.
- `sockets/`: Socket.IO setup and event emission.
- `utils/`: reusable infra helpers (`logger`, JWT helpers, transactions, cache).

## Security Model
- Auth: JWT access/refresh cookies (httpOnly).
- Session revocation: token JTI checks against storage.
- RBAC: canonical dot-notation permissions (for example `orders.view`, `shipments.update`).
- Rate limiting:
  - Global IP limiter
  - Auth endpoint limiter
  - Per-user API limiter
- Webhook integrity: HMAC signature verification middleware on webhook endpoints.

## Data + Async
- Primary DB: PostgreSQL, accessed through raw SQL repositories.
- Cache/Queue backend: Redis.
- Jobs: persistent job metadata in DB + enqueue to BullMQ.
- Cron schedules: synced from DB into BullMQ repeatable jobs at startup.

## Error Contract
All API error responses should follow this shape:

```json
{
  "success": false,
  "message": "Human-readable message",
  "error": "Machine-friendly category (optional)",
  "details": []
}
```

This format is required so frontend toast handling can reliably display backend failures.

## Request Lifecycle Notes
- Request IDs are attached early and included in logs.
- Slow requests are logged by middleware.
- Controllers should avoid direct SQL; use repositories/services.
- Services should throw typed errors from `errors/AppError.js` rather than returning ad-hoc error objects.

## Startup Sequence
`server.js` boot process:
1. Load env + create Express/HTTP server.
2. Initialize middleware and routes.
3. Start HTTP listener.
4. Start BullMQ worker.
5. Sync and start cron scheduler.

If worker/scheduler startup fails, errors are logged and surfaced early.
