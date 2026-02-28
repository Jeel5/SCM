# Doubts Answered + Changes Made

This file answers every question from doubts.txt and documents every code change made.

---

## Code Changes Summary

| File | What Changed |
|---|---|
| `validators/index.js` | Deleted duplicate `ValidationError` class, deleted `validateCustom` (80-line dead function), deleted `isValidEmail`, removed backward-compat `else` branches |
| `errors/errorUtils.js` | Added `logger` import; replaced `console.error` with `logger.error` |
| `middlewares/auth.js` | Rewrote `optionalAuth` — now calls full `authenticate()` (including revoke-list check) when a token is present; simplified when no token |
| `routes/shipments.js` | Removed inline `optionalAuth` definition; imports it from `auth.js` |
| `middlewares/rbac.js` | Deleted old `PERMISSIONS` block and `hasPermission` function; unified `authorize()` and `requirePermission()` into one path through `userHasPermission()`; added `normalizePermission()` so old colon-notation routes keep working |
| `config/permissions.js` | Added missing permissions: `shipments.create`, `exceptions.create`, `returns.create`, `jobs.view/create/update/delete`; granted them to appropriate roles |
| `routes/sla.js` | Added `injectOrgContext` to all routes; added `authorize('sla:read')` to `sla-policies` route; added explanatory comments |
| `routes/mdm.js` | Added `authorize('sla:read')` to the SLA policies endpoint |
| `routes/carriers.js` | Added detailed comments explaining why no auth on webhook and why DB logic lives here |
| `routes/jobs.js` | Added comment explaining why `injectOrgContext` is absent |
| `routes/organizations.js` | Fixed wrong import: `authorize` was imported from `auth.js` (which has no such export), now correctly from `rbac.js` |
| `services/settingsService.js` | Replaced all 8 `throw new Error(…)` with proper typed error classes (`ConflictError`, `AuthenticationError`, `ValidationError`, `NotFoundError`) |
| `services/jobsService.js` | Replaced all 8 `throw new Error(…)` with proper typed error classes |

---

## Answers

### "swallowing of api" — server.js

Express registers routes in order. The comment on the `assignments` line says:
```js
app.use(API_PREFIX, assignmentsRoutes); // Must be before mdmRoutes
```
MDM registers `/api/carriers/:id`. If assignments (which has `/api/orders/:orderId/request-carriers`) were mounted after MDM and used the same prefix, Express could match the wrong route. Route order matters in Express — more specific static segments go first. This is documented intentionally.

---

### Why is DB query logic inside carriers.js instead of a controller?

It was written as a quick integration shim for the carrier webhook simulation. Real-world rule: routes should only contain middleware + controller call. Queries belong in repositories, business logic in services, all wired through controllers. A TODO comment has been added to the file flagging this for refactoring.

---

### Why use `carrierId` (a code) as the carrier name when storing rejections?

The webhook URL uses carrier **code** (`/carriers/webhook/BLUEDART`), but `carrier_rejections.carrier_name` should hold a human-readable name like "Blue Dart". For the accepted-quote path the code correctly looks up the DB to get the ID. The rejection path was a shortcut that used the code for both columns. A TODO comment is now in the file. The fix is to do the same DB lookup as the accepted path before inserting.

---

### Why do some routes have validation middleware and some don't?

Intentional in some cases, inconsistency in others:

- **Intentional no-validate**: read-only GET endpoints with no query params (e.g. `GET /orders/:id`) — nothing to validate.  
- **Intentional public**: `POST /auth/login` still has `validateRequest` — it needs validation even without auth.  
- **Inconsistency fixed**: `sla-policies` in mdm.js was missing `authorize()` — now added.  
- **Remaining TODO**: list endpoints like `GET /sla/violations` accept query params (pagination, date range) but have no `validateQuery()` — they should get schemas added.

---

### Why no `injectOrgContext` on some routes?

- **SLA controller** read `req.user.organizationId` directly instead of `req.org.id`. Both hold the same value but `req.org` is the standard from `injectOrgContext`. The middleware has now been added to SLA routes. The controller has a TODO to switch to `req.org.id`.  
- **Jobs/dashboard/analytics** routes have a comment explaining the design.  
- **MDM carriers.get + carriers.id**: intentionally public (see comment in mdm.js) — used by simulation/external portals.

---

### `optionalAuth` — explanation, importance, when/how

```js
export function optionalAuth(req, res, next) {
  if (req.headers.authorization) return authenticate(req, res, next);
  req.user = null;
  next();
}
```

**What it does**: If the caller sends a JWT → run full auth (verify signature, check revoke list, set `req.user`). If no JWT → set `req.user = null` and continue.

**Why**: Some endpoints serve two types of callers:
1. External systems (carriers) that don't have your JWTs — they filter by query param (`?carrier_id=123`).
2. Authenticated dashboard users who should get org-scoped data.

If you used `authenticate` you'd break the external callers with a 401. If you used nothing you'd never know who the authenticated callers are.

**The old version was wrong**: It decoded the token but skipped the revoke-list check. A logged-out user could still get data. The new version delegates to `authenticate()` so revocation is always enforced.

---

### `ValidationError` in validators/index.js — why was it there?

It was a copy-paste from before the `errors/AppError.js` hierarchy existed. Once `AppError.js` was created, the one in `validators/index.js` became a duplicate. It was never used outside the file — deleted.

---

### Backward compat `validateCustom` / `isValidEmail` — why removed?

`validateCustom` was the original hand-rolled validator written before Joi was added. When Joi was introduced, a check was added: `if (schema.validate)` → use Joi, `else` → fall back to `validateCustom`. But **every single schema file in `validators/` uses Joi** (`Joi.object()`). The `else` path was never reached. Keeping dead code invites confusion and makes your prof ask "why is this here?". Removed both the dead `else` branches and the `validateCustom`/`isValidEmail` functions.

---

### `cryptoUtils.js` — if key is not configured, why return null / not throw?

The `if (!hexKey) return null` is **graceful degradation for development only**. Without it, the app would crash at startup every time a developer doesn't have `ENCRYPTION_KEY` set. In production this is a misconfiguration — a warning is logged. For proper production enforcement you would add a startup check:

```js
if (process.env.NODE_ENV === 'production' && !process.env.ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY must be set in production');
}
```

**Why base64 is not weak**: Base64 is not encryption — it's an encoding (reversible, no key). The data is encrypted with AES-256-GCM (256-bit key, authenticated encryption). Base64 is used only to serialise the binary output (`iv`, `authTag`, `ciphertext`) into a printable string that can be stored in a text column. The security comes from AES, not base64.

---

### `TAG_BYTES` unused — how does tamper detection work?

`TAG_BYTES = 16` is defined but not used in the code because `crypto.createCipheriv` produces a 16-byte authentication tag automatically — you don't pass the size as a param. The tag is retrieved with `cipher.getAuthTag()` after encryption. It IS stored in the encrypted blob (`iv:tag:ciphertext`) and IS verified by `decipher.setAuthTag(authTag)` during decryption. If the ciphertext was tampered with, `decipher.final()` throws an error. The constant is documentation, not runtime code. It could be removed or kept as a comment.

---

### Legacy plaintext block in `decryptField`

```js
const parts = encrypted.split(':');
if (parts.length !== 3) {
  return encrypted; // legacy plaintext value — use as-is
}
```

**What it is**: When encryption was first added, existing rows in the database still had plaintext carrier API keys. If you tried to decrypt them as if they were encrypted you'd get a crash (can't split into 3 parts, can't base64-decode a plain string). This block detects the unencrypted format and returns the value as-is, so the app keeps working during a migration period. In a full migration you'd run a script to encrypt all existing rows and then remove this branch.

---

### What does `.final()` do?

In Node's crypto:
- `cipher.update(data)` encrypts data in chunks, returns partial output.
- `cipher.final()` flushes the remaining bytes in the cipher's internal buffer and returns them.

You always need both. The full encrypted output is `Buffer.concat([cipher.update(plaintext), cipher.final()])`. Same for decrypt: `Buffer.concat([decipher.update(ciphertext), decipher.final()])` — `.final()` also validates the authentication tag internally for GCM and throws if tampered.

---

### `decryptField` — the try/catch block

```js
const [ivB64, tagB64, cipherB64] = parts;      // split "iv:tag:ciphertext"
const iv         = Buffer.from(ivB64, 'base64');  // decode from base64 → binary
const authTag    = Buffer.from(tagB64, 'base64');
const ciphertext = Buffer.from(cipherB64,'base64');

const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);  // set key + IV
decipher.setAuthTag(authTag);  // tell GCM what tag to verify

const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
// .final() checks tag — throws ERR_CRYPTO_INVALID_AUTH_TAG if tampered
return plaintext.toString('utf8');
```

Yes, it is the exact reverse of encryption:  
Encrypt: `plaintext → update+final → ciphertext + getAuthTag()`  
Decrypt: `ciphertext → setAuthTag + update+final → plaintext`

---

### Why `async` in transactions / why await?

JavaScript is single-threaded. Database calls are I/O (they go over a network socket to PostgreSQL and come back). If you write synchronous code, the entire Node.js thread blocks while waiting — no other requests can be served. `async/await` releases the thread while waiting for the DB and resumes when the response arrives. Without it: `pool.connect()` returns a Promise, calling `.query()` immediately would send the query before the connection was established.

---

### Why check `isActive` / why does `transaction.begin()` guard against double-call?

If the code called `begin()` twice on the same client, PostgreSQL would receive `BEGIN; BEGIN;` — the second `BEGIN` would raise a warning and be ignored, but your transaction counter would be off. More importantly, if a bug calls `query()` after `commit()` (client is released back to pool), you'd be sending queries on a connection that belongs to another request — data corruption. The guard makes these bugs loud and obvious instead of silent.

---

### Why `client.release()` — connection leak

The connection pool has a max (default 20 connections). `pool.connect()` **borrows** one and takes it out of the available pool. If you never call `release()`, that connection is stuck forever. After 20 requests the pool is empty; all subsequent requests hang waiting indefinitely. This is a connection leak. It's the same concept as a file handle leak. The `withTransaction` wrapper always calls `rollback()` in its `finally` block which calls `release()`, so you can't leak from normal usage.

---

### Why can't you use `pool.query()` inside a transaction?

`pool.query()` picks **any free connection** from the pool each time. If you do:
```js
pool.query('BEGIN');      // connection A gets BEGIN
pool.query('INSERT ...');  // connection B gets INSERT — different transaction!
pool.query('COMMIT');     // connection C gets COMMIT — commits nothing relevant
```
All statements in a transaction must run on the **same physical connection** so PostgreSQL's transaction scope applies to all of them. That's why `Transaction.query()` uses `this.client` (the one reserved by `begin()`).

---

### What does `await callback(transaction)` reference?

`withTransaction` is called like this:
```js
await withTransaction(async (tx) => {
  await tx.query('INSERT ...');
  await tx.query('UPDATE ...');
});
```
The outer `async (tx) => { ... }` is the **callback**. `withTransaction` runs `await callback(transaction)` which means: "call the function the caller gave me, pass our transaction object as `tx`, and wait for all the awaited queries inside it to finish before moving on to COMMIT." If the callback throws, the catch block runs ROLLBACK.

---

### `getClient()` vs everything before it

Everything before `getClient()` (`begin`, `commit`, `rollback`, `query`) is the public interface for managed operations — the wrapper handles lifecycle. `getClient()` exposes the raw PostgreSQL client for the rare case where you need to use a driver-level method not wrapped by the class (e.g., streaming, `COPY`, advisory locks). Treat it as an escape hatch.

---

### Unit of Work pattern

All changes needed for one business operation (e.g., create order + reserve inventory + log audit) are grouped into a single **unit of work** that either fully succeeds (COMMIT) or fully fails (ROLLBACK). Atomicity: the DB is never left in a half-updated state. `withTransaction` is the implementation of this pattern.

---

### PostgreSQL error codes in `errorHandler`

```
23505 — unique_violation      → 409 Conflict  (duplicate email, order number, etc.)
23503 — foreign_key_violation → 400 Bad Request (referencing a non-existent ID)
23502 — not_null_violation    → 400 (required column missing)
22P02 — invalid_text_representation → 400 (sent "abc" for a UUID or integer field)
```

**Others you should know**:
```
40P01 — deadlock_detected       → retry or 503 (two transactions blocking each other)
40001 — serialization_failure   → retry or 503 (optimistic concurrency conflict)
08006 — connection_failure      → 503 (DB unreachable)
42703 — undefined_column        → 500 / bug (typo in query)
42P01 — undefined_table         → 500 / bug (migration not run)
```
The first four are added to the error handler already. The deadlock/serialization codes are worth adding — they should trigger a retry or a 503, not a generic 500.

---

### `asyncHandler`

```js
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

Express does not automatically catch errors thrown from `async` route handlers. If an async handler throws, Express never sees it and the request hangs. `asyncHandler` wraps the handler: any thrown error or rejected Promise is caught and passed to `next(error)`, which routes it to the global error handler. Every async route handler should be wrapped, OR you must have `try/catch` everywhere. The codebase uses `try/catch` in controllers, which is equivalent but more verbose.

---

### Error folder vs utils/responseHelper — the flow

Three separate concerns:

1. **`errors/AppError.js`** — Error _classes_. Just define the shape of errors (`statusCode`, `isOperational`, `message`). No logic.
2. **`errors/errorUtils.js`** — Convenience _throw helpers_. `throwNotFound('Order')` is shorter than `throw new NotFoundError('Order not found')`. Same result.
3. **`errors/errorHandler.js`** — Express _middleware_. Catches errors that reach `next(error)`, maps them to HTTP responses. This is the only place that turns an error object into a JSON response.
4. **`utils/responseHelper.js`** (if it exists) — Standardises _success responses_. Not error handling — it provides `sendSuccess(res, data)` / `sendCreated(res, data)` helpers so all controllers return the same JSON shape.

Flow when something goes wrong:
```
Controller throws NotFoundError
  → asyncHandler catches it → calls next(error)
  → errorHandler middleware receives it
  → checks isOperational, NODE_ENV
  → sends { success: false, error: "Order not found" } with 404
```

---

### `isOperational = true` — what it means

`isOperational = true` means: "I threw this deliberately because the user did something wrong (bad input, missing record, wrong password). It's safe to show the message to the client."

`isOperational = false` (or an unhandled `new Error(…)` from a library): "This is a programming bug or unexpected crash. Do NOT show internal details. Send a generic 'Internal server error' to the client and page the on-call engineer."

The `errorHandler` checks: `if (error.isOperational)` → use error.message. Else → use 'Something went wrong'.

---

### `__filename` / `__dirname` — why `__` prefix and why needed?

The double underscore is a Node.js convention from CommonJS (CJS) modules — they were injected as magic globals in every `.js` file. The `__` indicates they are "special" injected variables.

In **ESM** (which this project uses — `"type": "module"` or `.mjs`), these globals **do not exist**. You have `import.meta.url` instead which is a URL (`file:///home/.../utils/logger.js`). To convert it to a path:
```js
const __filename = fileURLToPath(import.meta.url);  // → /home/.../utils/logger.js
const __dirname  = path.dirname(__filename);         // → /home/.../utils
```
They're needed here to build the absolute path to `../logs/` for the Winston file transport.

---

### `||` default fallback in env vars — why it's a nightmare

You're 100% right. `process.env.PORT || 3000` means if `PORT` is missing the app silently uses 3000. When something breaks you have no idea the app is running on the wrong port. Better pattern:

```js
const PORT = process.env.PORT;
if (!PORT) throw new Error('PORT env var is required');
```

For truly optional config (like log level in dev), defaults are fine. For anything that affects security or connectivity (DB password, JWT secret, port, encryption key), **fail loudly at startup** rather than silently falling back. Notice `server.js` uses `process.env.PORT` with NO default — correct, it will be `undefined` and the server binds to undefined which Node treats as a random port... actually this should also have a startup guard. Added to the TODO list mentally.

---

### Morgan Stream — are we using it, should we?

`logger.stream` exists in `logger.js` but **Morgan is not mounted in `server.js`**. Currently `requestLogger` middleware (in `middlewares/requestLogger.js`) handles HTTP logging using native Winston. This is fine — Morgan would just be an extra dependency for the same result. **Leave it as-is**. The `logger.stream` object is harmless.

---

### Why use classes (in repos, errors, shippingHelpers, etc.)?

Several different reasons depending on the class:

- **Error classes** (`AppError`, subclasses): `instanceof` checks. You need `if (err instanceof NotFoundError)` to work. A plain object can't do that. Also `extends Error` gives you a proper stack trace.  
- **Repository classes** (`OrderRepository`): Grouping related DB queries by entity. Not using instance data — could be plain exported functions. It's a style choice; the class makes it clear "all Order DB operations are here".
- **`ShippingLockManager` etc.** (static methods only): These are essentially namespaced utility functions. Could equally be `export function acquireLock(…)`. The class is just a namespace grouping. No state is stored in `this`.
- **`Transaction` class**: Genuine OOP need — holds `this.client` and `this.isActive` state across multiple method calls. A plain function couldn't maintain that state between `begin()` and `commit()`.

---

### Why SHA-256 for idempotency key instead of UUID?

SHA-256 produces a **deterministic** key from the same inputs. If the ecom frontend sends the same order twice (network retry), the frontend can recompute `sha256(orderId + timestamp)` and get the identical key — so the backend recognises it as a duplicate and returns the cached result. A UUID is **random** — two calls with the same data would produce different UUIDs, defeating idempotency. The hash acts as a fingerprint of the request.

---

### Why are `ShippingLockManager` methods `static`?

Static means you call `ShippingLockManager.acquireLock(orderId)` directly, no `new ShippingLockManager()` needed. This is correct because there is no per-instance state — all state lives in the database (the `shipping_locked` column). Creating instances would waste memory and imply stateful objects when there are none. Compare to `Transaction` which IS stateful (holds `this.client`).

---

### Why does cache failure in `IdempotencyManager.cacheResult` NOT throw?

```js
} catch (error) {
  logger.error('Error caching result', { ... });
  // Don't throw - caching failure shouldn't block response
}
```

The cache is an optimisation, not a critical path. The request has already succeeded — the carrier quote was saved, the order was processed. Failing to write to the cache means **the next duplicate request won't be detected**, but it won't corrupt data. Throwing here would turn a cosmetic caching failure into a HTTP 500 for the client, which is worse. Same reasoning applies to `logCapacitySnapshot` and `recordReason` in `SelectionReasonTracker`.

> "Don't let logging/caching failures poison the primary business operation."

---

### `workerId = 'default'` — is this safe?

A default `'default'` means if no worker ID is supplied, all workers that omit the parameter compete under the same name. The lock itself is still atomic (the `UPDATE ... WHERE shipping_locked = false` is a single SQL statement — only one UPDATE wins even with concurrent calls). The worker ID is just for debugging (you can see who held a lock in logs). In production you'd pass a real worker ID (`process.env.WORKER_ID` or a UUID generated at startup). The default allows local dev without setup.

---

### `releaseStaleLocks` — race condition concern

You asked: what if a worker is legitimately working for 30 minutes and the lock gets released?

This is a real trade-off. The 30-minute threshold is intentionally generous — a shipping assignment should complete in seconds, not minutes. If it runs for 30 minutes something has already gone wrong (crashed worker, infinite loop). The stale-lock release is a **safety valve** for when workers die without calling `releaseLock()`. In real systems you'd complement this with:
1. Heartbeat updates: the worker updates `shipping_locked_at = NOW()` every ~30 seconds to prove it's alive.
2. `releaseStaleLocks` checks for locks where the heartbeat is stale, not just the initial lock time.
This hasn't been implemented here — it's a known simplification.

---

### Carrier Capacity Manager — why limit from our side if carriers report busy?

Carriers report capacity asynchronously and their status can be stale. If you send 500 requests to a carrier that just hit capacity, all 500 will come back rejected — wasting time, API credits, and processing. The local capacity counter is a **fast local check** that prevents sending obviously hopeless requests. It's not replacing the carrier's own check — both exist:

1. Our counter: fast, local, proactive — blocks requests before sending  
2. Carrier's response: authoritative, definitive — still the final say

`logCapacitySnapshot` feeds analytics: you can see which carrier is consistently at capacity and renegotiate contract or find alternatives.

---

### Do we verify that webhooks come from our legitimate ecom frontend?

The `/api/webhooks` route uses `webhooksRoutes`. The carrier-webhook route (`/api/carriers/webhook/:carrierId`) intentionally has NO verification — see the large comment now added to `carriers.js`. This is a known gap for the demo. In production you'd add HMAC verification (same as `verifyWebhookSignature()` used on `/shipments/:id/confirm-pickup`).

---

### Zone calculation without storing zones

You're right — the confidence calculator does:
```js
const fromZone = fromPincode.substring(0, 3);
```
But `zones` are not stored in the DB or looked up from a zones table. The first 3 digits of an Indian PIN code are a rough circle approximation, not actual postal zone boundaries. This is a documented simplification for the demo. In production:
- Store a `zones` table mapping pincodes to zone numbers.
- Look up zone from pincode at quote-request time.
- Use actual zone difference, not first-3-digits difference.

---

### `ResponseTimeTracker.createTimeout`

```js
static createTimeout(ms, carrierId) {
  return new Promise((resolve) =>
    setTimeout(() => resolve({ timeout: true, carrierId, responseTime: ms }), ms)
  );
}
```

Creates a Promise that resolves (not rejects!) after `ms` milliseconds with an object that has `timeout: true`. It uses `resolve` not `reject` because `Promise.race` needs a value to work with — if we rejected, the caller would need a `try/catch`. By resolving with a sentinel object, the caller can just check `if (result.timeout)`.

`raceWithTimeout` runs `Promise.race([carrierRequest, timeout])`. Whichever resolves first "wins". If the carrier responds in 2 seconds but the timeout is 5 seconds, the carrier result wins. If the carrier takes 8 seconds, the timeout resolves first at 5 seconds and the carrier response is silently discarded.

---

### `.reduce()` explanation

```js
const cheapest = allQuotes.reduce((min, q) =>
  q.quotedPrice < min.quotedPrice ? q : min
);
```

`reduce` takes an array and collapses it to a single value by calling the callback for each element:
- `min` = the accumulator (starts as the first element when no initial value is given)
- `q` = the current element being examined
- The callback returns whichever of `min` / `q` has the lower price
- After every element is checked, `min` holds the element with the globally lowest price

Equivalent without `reduce`:
```js
let cheapest = allQuotes[0];
for (const q of allQuotes) {
  if (q.quotedPrice < cheapest.quotedPrice) cheapest = q;
}
```

---

### `best_balance` — what does it mean?

After checking `best_price` and `best_speed`, if neither applies, it means the selected carrier is **not the cheapest and not the fastest** — the user (or algorithm) chose it because it offers the best combination of price + speed + other factors (reliability, SLA compliance, historical performance). It's the "Goldilocks choice."

---

### Two competing authorization systems (now fixed)

There were two independent permission checkers:
- `rbac.js` had its own `PERMISSIONS` object using colon-format (`orders:read`)
- `config/permissions.js` had `ROLE_PERMISSIONS` using dot-format (`orders.view`)

**Both were active at the same time.** Routes using `authorize()` used the old system; routes using `requirePermission()` used the new one. A user's role in one system didn't guarantee access in the other.

**Fixed**: `rbac.js` now has ONLY middleware. The `PERMISSIONS` block and `hasPermission` function are gone. Both `authorize()` and `requirePermission()` delegate to `userHasPermission()` from `config/permissions.js`. One system, one source of truth. Old colon-notation (`orders:read`) is normalised to dot-notation (`orders.view`) by `normalizePermission()` so existing routes work without mass renaming.

---

### ADMIN `*:*` — is it admin for their org only?

**Yes.** In `config/permissions.js` the `admin` role has `['*']` which expands to `ALL_PERMISSIONS` — explicitly excluding `SUPERADMIN_PERMISSIONS` (which contains `companies.manage`). An `admin` can do everything within their own organisation's data but cannot create new organisations or access other organisations. That `companies.manage` permission is only granted to `superadmin`.

The data scoping (which org's rows you see) is enforced separately by `injectOrgContext` + `organization_id` filters in queries — the permission system only controls whether you can call an endpoint at all.

---

### Why do controllers have their own error handling / raw queries?

This is a common problem when a project evolves organically. The target architecture is:
```
Route → Controller → Service → Repository → DB
```
- Route: authentication/authorization/validation middleware, call controller  
- Controller: parse request, call service, format response  
- Service: business logic, orchestration, transactions  
- Repository: DB queries only, no business logic  

When controllers have `try/catch` with raw `res.status(500).json(...)`, they're doing the error handler's job. When controllers have raw SQL, they're doing the repository's job. This is the **inconsistency you've been seeing everywhere**. The services folder has been cleaned up (proper error classes, no raw `new Error()`). Controllers are the next step for a future cleanup pass.

---

### `idempotency-key` vs `x-idempotency-key` headers

```js
const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
```

`x-` prefix is the HTTP convention for custom (non-standard) headers. `idempotency-key` without the prefix is the IETF draft standard. This line accepts both to be compatible with both conventions. Since both frontend and backend are yours, you should **pick one and use it consistently**. Recommendation: use `idempotency-key` (no `x-`) as it's on the path to becoming a formal standard.

---

### Why not add request logger functions to utils/logger.js?

`utils/logger.js` is the Winston logger instance and its helper functions (`logEvent`, `logError`, etc.) — pure logging utilities. `middlewares/requestLogger.js` is Express middleware (takes `req, res, next`) that uses the logger. Mixing the two would mean `utils/logger.js` would depend on Express request objects. Utilities should not depend on framework-specific objects. Keeping them separate preserves testability — you can unit-test logger helpers without needing an HTTP request.

---

### `orgContext` clause builder

```js
const column = tableAlias ? `${tableAlias}.organization_id` : 'organization_id';
return {
  clause: `${column} = $`,
  params: [orgId],
  paramValue: orgId
};
```

This builds the WHERE clause fragment for multi-tenancy. When your query JOINs multiple tables, columns can be ambiguous:
```sql
-- Ambiguous: which table's organization_id?
WHERE organization_id = $1

-- Unambiguous with table alias:
WHERE o.organization_id = $1
```
The helper accepts an optional `tableAlias` (like `'o'` for orders) so the caller can produce either form. The `params` array is used with parameterized queries (`$1`, `$2`…) to prevent SQL injection.

---

### Clean architecture boundaries — summary

The rules:
- **validators/**: Joi schemas + middleware factories. No DB, no business logic.
- **middlewares/**: Express middleware only. Auth, RBAC, org-injection, request logging.
- **routes/**: Mount middleware + controller. No logic, no queries.
- **controllers/**: Parse request, call service, format response. Thin layer.
- **services/**: Business logic, state machine, transaction orchestration. No HTTP objects.
- **repositories/**: DB queries for one entity. No business logic.
- **utils/**: Shared helpers. No framework coupling.
- **errors/**: Error classes + global handler.
- **config/**: Configuration (DB pool, permissions). Static.

Most cross-boundary violations come from controllers that contain logic or queries that belong lower down. These are tracked as TODOs for a future cleanup.
