# TwinChain SCM — System Overview

> Last updated: 2026-03-18
> Partial live reference. For current architecture boundaries, see `docs/architecture/STRUCTURE.md`.

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Tech Stack](#2-tech-stack)
3. [Running the System](#3-running-the-system)
4. [Multi-Tenancy Model](#4-multi-tenancy-model)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [All API Routes](#6-all-api-routes)
7. [Database Schema Summary](#7-database-schema-summary)
8. [Background Job System](#8-background-job-system)
9. [Services Reference](#9-services-reference)
10. [Order → Shipment Pipeline](#10-order--shipment-pipeline)
11. [Demo Portals](#11-demo-portals)
12. [Environment Variables](#12-environment-variables)

---

## 1. High-Level Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                        Clients                                │
│                                                               │
│  React App (localhost:5173)    Demo HTML Pages (/demo/*.html) │
│  Carrier Webhooks              E-commerce Webhooks            │
└──────────────┬──────────────────────────┬─────────────────────┘
               │  REST API                │  Webhook POST
               ▼                          ▼
┌──────────────────────────────────────────────────────────────┐
│                   Express 5 Backend (port 3000)              │
│                                                              │
│  Middlewares: helmet, cors, requestId, requestLogger         │
│  Auth: JWT (authenticate) + HMAC (verifyWebhookSignature)    │
│  RBAC: requirePermission() — role-based route guards         │
│                                                              │
│  Routes:                                                     │
│   /api/users          /api/orders       /api/shipments       │
│   /api/inventory      /api/returns      /api/sla             │
│   /api/carriers       /api/warehouses   /api/products        │
│   /api/assignments    /api/webhooks     /api/finance         │
│   /api/jobs           /api/analytics    /api/organizations   │
│   /api/companies      /api/shipping     /api/demo            │
└──────────────┬───────────────────────────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌─────────────┐  ┌──────────────────────────────────────────┐
│ PostgreSQL  │  │         Background Job System            │
│  (port 5432)│  │                                          │
│             │  │  BullMQ workers (ops/imports/notifs)     │
│  scm_db     │  │  DB-backed cron scheduler + repeatables  │
│  20+ tables │  │  jobHandlers — process_order,            │
└─────────────┘  │    sla_monitoring, assignment_retry, ... │
                 └──────────────────────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Runtime | Node.js 20, ES Modules (`"type":"module"`) | No CommonJS `require()` |
| Web Framework | Express 5 | Async error propagation built-in |
| Database | PostgreSQL 16, `pg` driver | Connection pool (max 20) |
| Auth | `jsonwebtoken` (JWT), `bcrypt` | Access + refresh token pattern |
| Logging | `pino` + `pino-pretty`, `winston` | Structured JSON logs to file |
| Validation | Joi + request validation middleware | schemas in `backend/validators/` |
| HTTP Client | `axios` | Used by carrier notification service |
| Frontend | React 19, TypeScript, Vite, TanStack Query | |
| Containerization | Docker Compose | backend, frontend, postgres, redis |

---

## 3. Running the System

### Development (no Docker)

```bash
# 1. Start PostgreSQL (must be running on 5432)
# 2. Create DB and run schema
psql -U postgres -c "CREATE DATABASE scm_db;"
psql -U postgres -d scm_db -f init.sql

# 3. Create .env from example
cd backend && cp .env.example .env  # fill in DB credentials

# 4. Install and run
npm install
npm run dev       # nodemon — auto-restarts on file change

# Backend available at http://localhost:3000
# Health check: GET http://localhost:3000/health
```

### Docker Compose

```bash
# From project root
docker compose up --build

# Services:
#   backend  → localhost:3001
#   frontend → localhost:5173
#   postgres → localhost:5433
#   redis    → (internal only)
```

---

## 4. Multi-Tenancy Model

Each retailer/org is a row in the `organizations` table with a unique `webhook_token` (64-char hex).

- Every order, warehouse, user, and inventory record has `organization_id`
- The `injectOrgContext` middleware sets `req.organizationId` from the JWT payload
- Superadmin has no `organization_id` — they see everything
- Webhooks identify the org via the token in the URL: `POST /api/webhooks/:orgToken/orders`

```sql
-- Current seeded orgs
SELECT name, code, webhook_token FROM organizations WHERE is_active = true;
-- Result: Croma / CROMA / 7d0aa9fe...
```

---

## 5. Authentication & Authorization

### JWT Authentication

```
POST /api/auth/login → { accessToken, refreshToken, user }
POST /api/auth/refresh → new accessToken using refreshToken
POST /api/auth/logout → invalidate session
```

All protected routes need: `Authorization: Bearer <accessToken>`

The `authenticate` middleware:
1. Extracts token from `Authorization` header
2. Verifies with `verifyAccessToken()` (`jsonwebtoken.verify`)
3. Attaches `{ userId, role, email }` to `req.user`

### RBAC — Role Permission Matrix

| Role | Key Permissions |
|---|---|
| `superadmin` | `*:*` — full platform access, company management |
| `admin` | `*:*` — full org access |
| `operations` | orders, shipments, exceptions, analytics, jobs, SLA |
| `warehouse` | inventory, orders (read/update), returns, warehouses |
| `carrier` | shipments (read/update), carriers |
| `finance` | orders/shipments/returns (read), analytics, invoices, costs |

Permission format: `module:action` (e.g., `orders:read`, `shipments:update`, `inventory:*`).  
`requirePermission('orders:read')` is the RBAC middleware — used on all protected routes.

### HMAC Authentication (Carrier Webhooks)

Carrier accept/reject endpoints use HMAC-SHA256:

```
X-Carrier-Signature: sha256=<hmac(body, carrier.webhook_secret)>
X-Carrier-Timestamp: <unix_ms>
```

Implemented in `middlewares/webhookAuth.js` via `verifyWebhookSignature()` factory.

---

## 6. All API Routes

All routes are registered under `/api` prefix in `server.js`.

### Users & Auth — `routes/users.js`
```
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
GET    /users
GET    /users/:id
POST   /users
PATCH  /users/:id
DELETE /users/:id
```

### Orders — `routes/orders.js`
```
GET    /orders           → list orders (with filters)         [authenticate + orders:read]
GET    /orders/:id       → get order detail                   [authenticate + orders:read]
POST   /orders           → create order                       [optionalAuth — demo open]
POST   /orders/transfer  → warehouse-to-warehouse transfer    [authenticate + orders:create]
PATCH  /orders/:id/status → update status                    [authenticate + orders:update]
```

### Carrier Assignments — `routes/assignments.js`
```
POST   /orders/:orderId/request-carriers           [authenticate + shipments:update]
GET    /orders/:orderId/assignments                [authenticate + shipments:read]
GET    /assignments/:assignmentId                  [authenticate + shipments:read]
GET    /carriers/assignments/pending?carrierId=X   [open — carrier portal polling]
POST   /assignments/:id/accept                     [HMAC]
POST   /assignments/:id/reject                     [HMAC]
POST   /assignments/:id/busy                       [HMAC]
POST   /carriers/:code/availability                [HMAC]
```

### MDM (Master Data) — `routes/mdm.js`
```
GET/POST/PUT/DELETE  /warehouses, /warehouses/:id/stats, /warehouses/:id/inventory
GET/POST             /carriers, /carriers/:id              [GET is open — no auth]
GET/POST             /products
GET                  /sla-policies
GET                  /carriers/:carrierId/rates
```

### Shipments — `routes/shipments.js`
```
GET    /shipments
GET    /shipments/:id
PATCH  /shipments/:id/status
POST   /shipments/:id/tracking-event
```

### Inventory — `routes/inventory.js`
```
GET    /inventory
POST   /inventory/adjust
GET    /inventory/:productId/history
```

### Returns — `routes/returns.js`
```
GET    /returns
GET    /returns/:id
POST   /returns
PATCH  /returns/:id/status
```

### SLA — `routes/sla.js`
```
GET    /sla/violations
GET    /sla/metrics
GET    /sla/exceptions
PATCH  /sla/exceptions/:id
```

### Finance — `routes/finance.js`
```
GET    /finance/summary
GET    /finance/invoices
POST   /finance/invoices/:carrierId/generate
```

### Jobs — `routes/jobs.js`
```
GET    /jobs                      → list background jobs
GET    /jobs/:id                  → get job detail
POST   /jobs/:id/retry            → retry a failed job
GET    /jobs/cron                 → list cron schedules
POST   /jobs/cron                 → create cron schedule
PATCH  /jobs/cron/:id             → update schedule
```

### Webhooks — `routes/webhooks.js`
```
POST   /webhooks/:orgToken/orders     [resolveWebhookOrg middleware]
POST   /webhooks/:orgToken/inventory
POST   /webhooks/:orgToken/returns
POST   /webhooks/:orgToken/tracking
POST   /webhooks/:orgToken/rates
POST   /webhooks/orders              [legacy — no token, org_id=null]
POST   /webhooks/tracking
POST   /webhooks/inventory
POST   /webhooks/returns
POST   /webhooks/rates
POST   /webhooks/generic
GET    /webhooks/status/:jobId        [authenticate]
GET    /webhooks/sample/:type         [authenticate]
```

### Carriers (webhook-receiving) — `routes/carriers.js`
```
POST   /carriers/:code/tracking       [HMAC — carrier sends tracking event]
POST   /carriers/:code/availability   [HMAC — carrier updates their status]
```

### Shipping Quotes — `routes/shipping.js`
```
POST   /shipping/quote/estimate       → fast zone-based estimate (<50ms)
POST   /shipping/quote/real           → full carrier-API quote
```

### Organizations & Companies — `routes/organizations.js`, `routes/companies.js`
```
GET/POST/PATCH/DELETE  /organizations/:id   [superadmin]
GET/POST               /companies           [superadmin]
```

### Demo (dev only — 404 in production) — `routes/demo.js`
```
GET    /demo/organizations           → active orgs with webhook tokens
GET    /demo/carriers                → active carriers
GET    /demo/carrier-shipments/:code → shipments for carrier
GET    /demo/carrier-secret/:code    → HMAC secret for demo signing
```

---

## 7. Database Schema Summary

Database name: `scm_db`.  Full DDL: see `init.sql`.

### Core Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `organizations` | Tenants / retailers | `id, name, code, webhook_token, is_active` |
| `users` | All platform users | `id, email, password_hash, role, organization_id` |
| `user_permissions` | Granular per-user perms | `user_id, permission` |
| `user_sessions` | Active login sessions | `user_id, session_token, expires_at` |
| `audit_logs` | Immutable event log | `user_id, action, entity_type, entity_id, changes` |

### MDM Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `warehouses` | Physical warehouses | `id, organization_id, code, name, address (JSONB)` |
| `carriers` | Carrier partners | `id, name, code, is_active, availability_status, service_type, reliability_score` |
| `rate_cards` | Carrier pricing | `carrier_id, origin_zone, destination_zone, rate` |
| `products` | Product catalogue | `id, sku, name, weight, dimensions (JSONB)` |
| `sla_policies` | SLA rules | `id, name, max_delivery_days, conditions` |

### Order & Fulfilment Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `orders` | Customer orders | `id, organization_id, external_order_id, platform, customer_name, status, total_amount` |
| `order_items` | Line items | `id, order_id, sku, product_name, quantity, unit_price` |
| `order_splits` | Split shipments | `id, order_id, warehouse_id` |
| `inventory` | Stock levels | `id, product_id, warehouse_id, quantity_on_hand, quantity_reserved` |
| `stock_movements` | Inventory history | `id, inventory_id, type, quantity_delta` |

### Carrier Assignment & Shipment Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `carrier_assignments` | Assignment requests to carriers | `id, order_id, carrier_id, status, expires_at, request_payload, acceptance_payload` |
| `shipments` | Active  shipments | `id, order_id, carrier_id, tracking_number, status, origin_address, destination_address` |
| `shipment_events` | Tracking history | `id, shipment_id, status, location, description, occurred_at` |
| `shipping_estimates` | Zone-based estimates | `id, origin_zone, destination_zone, estimated_days, base_rate` |

### Other Tables

| Table | Purpose |
|---|---|
| `returns, return_items` | Return/refund management |
| `exceptions` | Shipment exception alerts |
| `sla_violations` | SLA breach records |
| `invoices, invoice_line_items` | Carrier billing |
| `background_jobs` | Job queue |
| `cron_schedules` | Scheduled recurring jobs |
| `dead_letter_queue` | Failed jobs after max retries |
| `alert_rules, alerts` | Rule-based alert engine |
| `notifications` | User notification inbox |
| `carrier_quotes` | Carrier-submitted quotes |
| `carrier_rejections` | Carrier rejection records |
| `carrier_performance_metrics` | Aggregated carrier stats |

### `carrier_assignments.status` values

`pending` → `accepted` | `rejected` | `busy` | `expired` | `cancelled`

### `orders.status` values

`created` → `pending_carrier_assignment` → `shipped` → `delivered` | `on_hold` | `cancelled`

---

## 8. Background Job System

### Queue Workers (`backend/jobs/jobWorker.js`)

- Uses BullMQ workers on separate queues (operations, imports, notifications).
- Workers pick jobs from Redis-backed queues and mirror execution state to DB via `jobsService`/`jobsRepo`.
- Retries use BullMQ backoff settings; exhausted retries can move jobs to DLQ.

### Cron Scheduler (`backend/jobs/cronScheduler.js`)

- Reads DB cron schedule definitions and enqueues repeatable BullMQ jobs.
- Maintains schedule metadata while execution happens in queue workers.

### Job Handlers (`backend/jobs/jobHandlers.js`)

| Handler | Job Type | Description |
|---|---|---|
| `handleProcessOrder` | `process_order` | Inserts orders + items, triggers `requestCarrierAssignment()` |
| `handleUpdateTracking` | `update_tracking` | Updates shipment status from carrier tracking webhook |
| `handleInventorySync` | `sync_inventory` | Syncs warehouse inventory |
| `handleProcessReturn` | `process_return` | Processes return request, triggers refund |
| `handleSLAMonitoring` | `sla_monitoring` | Scans shipments for SLA violations |
| `handleExceptionEscalation` | `exception_escalation` | Auto-escalates overdue exceptions |
| `handleInvoiceGeneration` | `invoice_generation` | Generates carrier invoice for period |
| `handleDataCleanup` | `data_cleanup` | Deletes old logs/notifications/completed jobs |
| `handleNotificationDispatch` | `notification_dispatch` | Sends email/SMS/push notifications |
| `handleReportGeneration` | `report_generation` | Generates analytics reports |
| `handleReturnPickupReminder` | `return_pickup_reminder` | Sends pickup reminder for scheduled returns |

---

## 9. Services Reference

| File | Purpose |
|---|---|
| `carrierAssignmentService.js` | Core assignment logic — find carriers, create assignments, accept/reject/busy, retry |
| `assignmentRetryService.js` | Handles expired/rejected assignments — triggers next batch |
| `carrierPayloadBuilder.js` | Builds the structured JSON payload sent to carrier API |
| `carrierRateService.js` | Fetches or calculates carrier rates |
| `deliveryChargeService.js` | Zone-based delivery charge calculation |
| `orderService.js` | Order creation, validation, inventory reservation, status changes |
| `jobsService.js` | CRUD for `background_jobs` and `cron_schedules` |
| `slaService.js` | SLA monitoring and violation creation |
| `exceptionService.js` | Exception lifecycle, auto-escalation |
| `invoiceService.js` | Invoice generation and line items |
| `returnsService.js` | Return request processing |
| `notificationService.js` | Email/SMS/push notification dispatch |
| `alertService.js` | Rule-based alert evaluation |
| `allocationService.js` | Inventory allocation to orders |
| `shipmentTrackingService.js` | Tracking event ingestion and status sync |
| `osrmService.js` | OSRM routing for distance-based estimates |
| `settingsService.js` | User/org settings R/W |
| `webhookSimulator.js` | CLI tool for generating mock webhook traffic |
| `shipping/` | Shipping quote services (estimate + real quote) |

---

## 10. Order → Shipment Pipeline

```
1. E-commerce platform POSTs to:
   POST /api/webhooks/<orgToken>/orders
   Body: { event_type, source, data: { external_order_id, customer_*, shipping_address, items } }

2. webhooksController.handleOrderWebhook()
   - Accepts both envelope format and bare payload (auto-wraps bare)
   - Normalizes per source (amazon/shopify/ebay/generic)
   - jobsService.createJob('process_order', payload)
   - Returns 200 { job_id } immediately

3. BullMQ worker picks up the queued job

4. jobHandlers.handleProcessOrder(payload)
   a. INSERT INTO orders (with organization_id, external_order_id, platform, customer_*, status='created')
   b. INSERT INTO order_items (order_id, sku, product_name, quantity, unit_price)
   c. carrierAssignmentService.requestCarrierAssignment(orderId)
      - SELECT TOP 3 carriers (is_active=true, availability_status='available', service_type matches)
      - For each: INSERT carrier_assignments (status='pending', expires_at=NOW()+10min)
      - (non-fatal: if assignment fails, job still completes successfully)

5. Carrier sees request via:
   GET /api/carriers/assignments/pending?carrierId=DELHIVERY
   (carrier portal polls this every 5s)

6. Carrier accepts via:
   POST /api/assignments/:id/accept
   Headers: X-Carrier-Signature, X-Carrier-Timestamp
   Body: { driverName, driverPhone, vehicleNumber, estimatedPickup }

7. assignmentController.acceptAssignment()
   - INSERT INTO shipments (order_id, carrier_id, tracking_number, status='assigned')
   - UPDATE carrier_assignments SET status='accepted' WHERE id=$1
   - UPDATE carrier_assignments SET status='cancelled' WHERE order_id=$2 AND id!=$1
   - UPDATE orders SET status='shipped'

8. Carrier posts tracking updates:
   POST /api/carriers/:code/tracking
   → INSERT INTO shipment_events
   → UPDATE shipments.status
```

---

## 11. Demo Portals

Three standalone HTML pages in `/demo/`. No build step — open directly in browser or serve with `python3 -m http.server`.

| File | Purpose |
|---|---|
| `demo/customer.html` | Retailer checkout simulation — places orders via webhook |
| `demo/carrier-portal.html` | Carrier dispatch simulation — accept/reject assignments |
| `demo/order-tracking.html` | Track an order/shipment by ID or tracking number |

API calls go to `http://localhost:3000` (hardcoded in `API_BASE` constant in each HTML file).

All demo pages work with `file://` protocol — CORS is configured to allow `null` origin.

Demo API routes (`/api/demo/*`) return `404` in production (`NODE_ENV=production`).

**See:** [demo/README.md](../demo/README.md) for full setup and walkthrough.

---

## 12. Environment Variables

From `.env` (see `.env.example`):

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=scm_db
DB_USER=postgres
DB_PASSWORD=<your_password>

# JWT
JWT_SECRET=<random_256bit_string>
JWT_REFRESH_SECRET=<different_random_256bit_string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Google OAuth (optional)
GOOGLE_CLIENT_ID=<from_google_console>

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<email>
SMTP_PASSWORD=<app_password>

# Redis (used by Bull if BullMQ queues enabled)
REDIS_URL=redis://localhost:6379

# OSRM routing (optional)
OSRM_BASE_URL=http://router.project-osrm.org
```

---

## Appendix: Route Registration Order Matters

`assignments.js` is registered **before** `mdm.js` in `server.js`:

```javascript
app.use(API_PREFIX, assignmentsRoutes); // Must be BEFORE mdmRoutes
app.use(API_PREFIX, mdmRoutes);
```

This ensures `GET /api/carriers/assignments/pending` is not swallowed by MDM's `GET /api/carriers/:id` route (Express matches routes in registration order).
