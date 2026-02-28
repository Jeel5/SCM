════════════════════════════════════════════════════════════════════
SCM PROJECT — REMAINING WORK TRACKER
Last updated: 2026-02-27 | Rounds reviewed: R1–R17 + Session fixes + Session 2 fixes + Session 3 fixes + Session 4 fixes
Full task details → ARCHITECTURE_TASKS.md
Full fix patterns  → PATTERNS.md
════════════════════════════════════════════════════════════════════

LEGEND: ❌ Not Started | 🟡 Partial | ✅ Complete | 🔴 Has Critical Bugs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 1 — SECURITY & DATA INTEGRITY BUGS (must fix before production)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
See ARCHITECTURE_TASKS.md → Master Priority Queue → Fix Now tier
These are blocking — do NOT go live with any of these open.

CRITICAL SECURITY (AUTH / MULTI-TENANT ISOLATION):
  ✅ JWT fallback secret still in code (TASK-R4-001)
  ✅ organizationId missing from JWT payload (TASK-R12-003, R5-004)
  ✅ Refresh tokens stateless — cannot be revoked (TASK-R12-001)
  ✅ Login does not check org is_active (TASK-R12-002)
  ✅ No HMAC verification on any webhook endpoint (TASK-R12-010, R2-001)
  ✅ Raw webhook body not captured for HMAC (TASK-R2-002, R5-001)
  ✅ No webhook event idempotency (TASK-R12-011, R2-003)
  ✅ settingsService email change instant — no re-verification, account takeover via stolen session (TASK-R17-004)

CRITICAL DATA INTEGRITY (MULTI-TENANT ISOLATION GAPS):
  ✅ Dashboard controller — zero org filter on all 5 queries (TASK-R9-010)
  ✅ Analytics controller — zero org filter on all 8 queries (TASK-R8-014)
  ✅ Finance getInvoiceById — no org ownership check (TASK-R9-016)
  ✅ Finance getFinancialSummary — SQL injection via org filter string (TASK-R9-017)
  ✅ Returns updateReturn — no org ownership check (TASK-R10-016)
  ✅ Returns getReturnStats — no org filter (TASK-R10-017)
  ✅ Shipments getTimeline — no org filter (TASK-R10-025)
  ✅ Tracking controller — all 5 handlers have no org filter (TASK-R11-016)
  ✅ SLA getEta, getSlaViolations, getSlaDashboard, resolveException — no org filter (TASK-R11-009 to R11-012)
  ✅ Carrier quotes getQuotesForOrder — no org filter (TASK-R11-003)
  ✅ Assignment controller — org not passed to any repo call (TASK-R8-018)
  ✅ UserRepository findByEmail / findByUsername — no org filter (TASK-R8-001)
  ✅ WarehouseRepository getActiveWarehouses, findByCode — no org filter (TASK-R8-006, R8-007)
  ✅ Order/Return/Shipment repos — organizationId optional everywhere (TASK-R7-001)
  ✅ AlertService getAlerts/ack/resolve — no org filter (TASK-R13-002)
  ✅ AlertService recipient fallback — notifies all-tenant admins (TASK-R13-003)
  ✅ ExceptionService getExceptionStatistics, getHighPriorityExceptions — no org filter (TASK-R14-006)
  ✅ InvoiceService getInvoicingSummary — no org filter, all tenants' billing exposed (TASK-R15-003)
  ✅ InvoiceService approveInvoice / markInvoicePaid / disputeInvoice — no org ownership check (TASK-R15-004)
  ✅ InvoiceService generateMonthlyInvoices — processes all tenants' carriers globally (TASK-R15-005)
  ✅ orderService createOrder — organization_id taken from client payload, not JWT (cross-tenant create) (TASK-R16-003)

CRITICAL CONCURRENCY / OVERSELLING:
  ✅ AllocationService — no transaction + no SELECT FOR UPDATE on inventory (TASK-R13-009)
  ✅ Inventory transferInventory — no SELECT FOR UPDATE lock (TASK-R9-026)
  ✅ JobsService getPendingJobs — no FOR UPDATE SKIP LOCKED, concurrent workers double-execute (TASK-R15-009)
  ✅ Carrier assignment — no unique partial index, race creates duplicates (TASK-R6-006)
  ✅ org code generation — COUNT-based, concurrent creates collide (TASK-R7-006)
  ✅ warehouse code generation — COUNT-based, concurrent creates collide (TASK-R8-010)

CRITICAL CRASHED ENDPOINTS (fail on every call today):
  ✅ createShipment — variable `value` undefined crashes every call (TASK-R10-021)
  ✅ createShipment — variable `orderId` undefined crashes every call (TASK-R10-022)
  ✅ createReturn — only first item persisted, rest silently dropped (TASK-R10-015)
  ✅ inspectReturn — `withTransaction` not imported, ReferenceError on every call (TASK-R16-006)
  ✅ updateShipmentTracking — returns out-of-scope `updateResult.rows[0]`, ReferenceError on every call (TASK-R17-001)
  ✅ updateShipmentTracking — catch/finally uses undeclared `client`, ReferenceError on any failure path (TASK-R17-002)

HIGH PRIORITY SECURITY:
  ✅ Webhook tracking update — no carrier identity check, fake delivery possible (TASK-R11-017) [fixed: updateCarrierAvailability HMAC/admin guard]
  ✅ Assignment accept/reject — client-supplied carrierId trusted (TASK-R8-019) [fixed: reads from req.authenticatedCarrier]
  ✅ companiesController — no superadmin role assertion in handlers (TASK-R9-001) [fixed: authorize('superadmin') middleware]
  ✅ deleteCompany hard-deletes with no audit trail (TASK-R9-003) [fixed: soft-delete + audit log]
  ✅ Finance writes — no transactions (TASK-R9-018) [fixed: withTransaction + org ownership check]
  ✅ Mass assignment — no stripUnknown on Joi validation (TASK-R3-003) [fixed: stripUnknown:true in middleware]
  ✅ Order totals trusted from client instead of server-recalculated (TASK-R3-001) [fixed: server recalculates totals]
  ✅ carrierValidationService — Math.random() rejection in production code (TASK-R12-017) [fixed: deterministic validation]
  ✅ api_key_encrypted sent to carrier API without decryption (TASK-R12-014) [fixed: decrypt before use]
  ✅ No axios timeout on carrier API calls (TASK-R12-015) [fixed: 10s timeout]
  ✅ AlertService — new alert created every cron run, no dedup/cooldown (TASK-R13-001) [fixed: cooldown check added]
  ✅ AllocationService — no inventory reservation after allocation (TASK-R13-010) [fixed: reservation step added]
  ✅ JobsService list/cancel/retry/DLQ — no org filter (TASK-R15-012) [fixed: org filter added]
  ✅ osrmService Haversine fallback durationMinutes off by 60x (TASK-R16-007) [fixed: /3600 divisor]
  ✅ orderService order number collision — Math.random() 5-digit (TASK-R16-001) [fixed: sequence-based]
  ✅ orderService transfer order number collision — Date.now() ms-level (TASK-R16-002) [fixed: sequence-based]
  ✅ settingsService password change — no transaction (TASK-R17-003) [fixed: withTransaction wrap]
  ✅ settingsService session revoke — JWT stays valid until expiry (TASK-R17-007) [fixed: blocklist table]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 2 — BACKEND MODULE STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✅🔴 User & Access Management   (RBAC, login, profile, settings — bugs per Part 1)
  ✅🔴 MDM                        (warehouses, carriers, products, SLA policies, rate cards)
  ✅🔴 Finance Module              (invoices, refunds, disputes, reconciliation)
  ✅🔴 SLA Management Engine       (policies, violations, scoring, breach detection)
  ✅🔴 Exception Management        (detection, escalation, root cause, resolution)
  ✅🔴 Returns & Reverse Logistics (RMA, pickup, refund processing, analytics)
  ✅🔴 Alert Service               (rule engine, escalation jobs, notifications)
  ✅🔴 Allocation Service          (warehouse scoring, split order handling)
  ✅🔴 Order Management           (creation, listing, updates, inventory lifecycle — state machine + reservation all wired)
  🟡🔴 Shipments                  (CRUD and status — 2 crashes, no real carrier API)
  🟡🔴 Carrier Quotes             (estimate works; real carrier API calls stubbed/commented out)
  🟡    Background Jobs            (queue, retry, DLQ, cron CRUD — NO WORKERS executing jobs)
  🟡🔴 Webhooks                   (endpoints exist — no HMAC auth, no dedup)
  🟡    Notification Service       (createNotification works — NO email/SMS transport)
  ❌    WebSocket / Real-time      (not started)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 3 — BACKEND FEATURES STILL TO BUILD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ JOB WORKERS / PROCESSORS
     - Worker process that reads from jobs table and executes by job_type
     - Handlers needed: process_order, allocate_inventory, send_notification,
       process_return, generate_invoice, sla_check, alert_escalation, webhook event jobs
     - Dead letter queue recovery worker
     - Cron triggers: evaluate_alerts, check_sla_breaches, generate_invoices

❌ REAL CARRIER API INTEGRATION
     - Fix TASK-R12-014 first (decrypt api_key_encrypted before use)
     - Fix TASK-R12-015 first (add axios timeout)
     - Uncomment and complete: getDHLQuote, getFedExQuote, getBlueDartQuote, getDelhiveryQuote
     - Shipment label generation endpoint
     - Carrier tracking pull / webhook ingestion

❌ EMAIL / SMS NOTIFICATION TRANSPORT
     - Wire notificationService to email provider (Nodemailer / SendGrid / SES)
     - Wire SMS provider (Twilio / TextLocal) for critical alerts
     - Route through job queue (create notification_job → worker sends)
     - Email templates: order confirmed, shipped, delivered, SLA breach, exception

❌ WEBSOCKET SERVER
     - Add socket.io or ws to server.js
     - Authenticated rooms scoped per organization
     - Events: shipment_status_changed, alert_triggered, exception_created
     - Frontend useSocket hook already exists — just needs the server

✅ ORDER INVENTORY LIFECYCLE LINK
     - ✅ Reserve stock on order creation (TASK-R1-006) — in orderService.createOrder
     - ✅ Release reservation on order cancellation — updateOrderStatus + cancelOrder both release stock
     - ✅ Commit reservation to deduction on ship — updateOrderStatus(→'shipped') calls deductStock
     - ✅ inventory_reservations table (TASK-R13-010) [migration 019]

✅ ORDER STATE MACHINE (TASK-R1-007)
     - ORDER_VALID_TRANSITIONS map (12 states) defined in orderService.js
     - updateOrderStatus enforces transitions, throws BusinessLogicError on invalid move

✅ RETURN STATE MACHINE (TASK-R1-014)
     - RETURN_VALID_TRANSITIONS map (9 states) defined in returnsController.js
     - updateReturn fetches current status and enforces transitions before UPDATE

✅ ANALYTICS IMPROVEMENTS
     - ✅ Fix org filter (TASK-R8-014 / TASK-R9-010) — done
     - ✅ Parallelize sequential queries with Promise.all (TASK-R8-015, R9-011) — done
     - ✅ Data export CSV endpoint (GET /api/analytics/export?type=orders|shipments|returns|violations&range=...)
     - ✅ Accept time range param: ?range=day|week|month|year

✅ FINANCIAL AUDIT TRAIL (TASK-R9-019)
     - finance_audit_log table: entity_type, entity_id, action, old/new values, actor, timestamp
     - Insert on every: processRefund, resolveDispute, updateInvoice status change
     - Status transition validation added to updateInvoice (TASK-R9-020)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 4 — FRONTEND INTEGRATION GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  🟡 Create Order form          (UI exists — needs backend crash fixes first)
  🟡 Edit Order form            (UI exists — needs state machine enforcement)
  🟡 Create Shipment form       (UI exists — fix TASK-R10-021 + R10-022 first)
  🟡 Adjust Stock form          (UI exists — needs SELECT FOR UPDATE fix first)
  🟡 Add/Edit Warehouse form    (UI exists — needs race condition fix first)
  🟡 Add/Edit Carrier form      (UI exists — backend functional, connect form)
  🟡 Process Return form        (UI exists — fix multi-item bug first TASK-R10-015)
  ❌ Live tracking map          (needs WebSocket + carrier API)
  ❌ Real-time notifications    (needs WebSocket server)
  ✅ CSV export button (Analytics page — wired to GET /api/analytics/export)
  🟡 Alert management UI        (backend complete after Part 1 fixes)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 5 — DATABASE MIGRATIONS STILL NEEDED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✅ user_sessions table                (refresh token revocation — TASK-R12-001)
  ✅ webhook_events table               (idempotency dedup — TASK-R12-011) [migration 019]
  ✅ inventory_reservations table       (reservation system — TASK-R13-010) [migration 019]
  ✅ warehouse_metrics table            (pre-aggregated utilisation snapshots — TASK-R13-012) [migration 021]
  ✅ carrier_capacity table             (replace Math.random — TASK-R12-017) [migration 022]
  ✅ finance_audit_log table            (financial audit trail — TASK-R9-019) [migration 019]
  ✅ GIN index on warehouse.address JSONB             (TASK-R8-013) [migration 019]
  ✅ GIN trigram index on order_number, tracking_number (TASK-R7-004) [migration 019]
  ✅ UNIQUE partial index on carrier_assignments      (TASK-R6-006) [migration 019]
  ✅ CHECK constraint: inventory quantity invariant   (TASK-R6-012) [migration 019]
  ✅ weight column on allocation_rules (weighted scoring — TASK-R13-014) [migration 019]
  ✅ last_rr_warehouse_index on allocation_rules (true round robin — TASK-R13-013) [migration 019]
  ✅ cooldown_minutes [migration 009] + last_triggered_at on alert_rules [migration 021] (TASK-R13-001)
  ✅ exception_assignment_history table                (assignment audit trail — TASK-R14-008) [migration 019]
  ✅ zone column on rate_cards + carrier_zone_thresholds table (TASK-R14-002/R14-005) [migration 019]
  ✅ gst_rate column on rate_cards                     (configurable GST rate — TASK-R14-004) [migration 019]
  ✅ invoice_number_seq DB sequence                    (atomic numbering — TASK-R15-001) [migration 019]
  ✅ UNIQUE(carrier_id, billing_period_start, billing_period_end) on invoices (TASK-R15-002) [migration 019]
  ✅ dispute_reason + disputed_by + disputed_at columns on invoices (TASK-R15-007) [migration 019]
  ✅ worker_id + heartbeat_at columns on background_jobs  (worker heartbeat — TASK-R15-010) [migration 019]
  ✅ organization_id column on background_jobs + dead_letter_queue (TASK-R15-012) [migration 019]
  ✅ deduplication_key column on notifications         (notification dedup — TASK-R15-016) [migration 019]
  ✅ order_number_seq DB sequence                      (atomic order numbers — TASK-R16-001) [migration 010]
  ✅ carrier_pickup_notes TEXT column on returns       (pickup notes currently dropped — TASK-R16-012) [migration 019]
  ✅ pending_email + email_change_token + email_change_expires_at on users (email re-verify flow — TASK-R17-004) [migration 007]
  ✅ revoked_tokens table (or Redis set) for JWT blacklisting (session revoke — TASK-R17-007) [migration 011]
  ✅ next_sla_check_at TIMESTAMPTZ on shipments        (SLA monitor optimization — TASK-R17-012) [migration 019]
  ✅ pick_list_number_seq DB sequence                  (atomic pick list numbers — TASK-R17-014) [migration 019]
  ✅ token_version column on users + jti on user_sessions  (session bulk revocation — TASK-R8-002/003) [migration 020]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 6 — TESTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ❌ Unit tests (services + repositories)
  ❌ Integration tests (API endpoints with test DB)
  ❌ Auth/RBAC tests (org isolation matrix — all endpoints)
  ❌ Concurrency tests (allocation oversell, double refund scenarios)
  ❌ E2E tests (order → allocate → ship → deliver full flow)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECOMMENDED BUILD ORDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WEEK 1 — Fix all crashes + critical security
  1. Fix JWT (fallback secret, add organizationId, stateless tokens)
  2. Fix createShipment crashes (TASK-R10-021, R10-022)
  3. Fix createReturn drops items (TASK-R10-015)
  4. Add org filters everywhere (dashboard, analytics, finance, returns, SLA, tracking)
  5. Fix SQL injection in getFinancialSummary (TASK-R9-017)
  6. Add HMAC middleware on webhooks (TASK-R12-010)
  + Fix invoice org filter gaps — getInvoicingSummary, approveInvoice, markInvoicePaid, disputeInvoice (TASK-R15-003/R15-004)
  + Fix generateMonthlyInvoices to scope by org (TASK-R15-005)
  + Add org filter to exception stats + high-priority queue (TASK-R14-006)
  + Fix inspectReturn crash — add withTransaction import (TASK-R16-006)
  + Fix organization_id on createOrder to use JWT context not client payload (TASK-R16-003)
  + Fix Haversine fallback durationMinutes calculation (TASK-R16-007)
  + Fix updateShipmentTracking crashes — return value + remove undeclared client (TASK-R17-001, R17-002)
  + Wrap password change in withTransaction (TASK-R17-003)
  + Implement email re-verification flow — add pending_email columns (TASK-R17-004)

WEEK 2 — Data integrity + allocation safety
  7. Add inventory transaction + FOR UPDATE to allocationService (TASK-R13-009)
  8. Create inventory_reservations table + reservation step (TASK-R13-010)
  9. Replace Math.random() in carrierValidationService (TASK-R12-017)
  10. Add alert deduplication + cooldown (TASK-R13-001)
  11. Create user_sessions table (refresh token revocation) (TASK-R12-001)
  12. Create webhook_events table (idempotency) (TASK-R12-011)
  + Fix zone parameter silently ignored in delivery charge rate lookup (TASK-R14-002)
  + Add SELECT FOR UPDATE SKIP LOCKED to job worker (TASK-R15-009)
  + Add invoice duplicate prevention — pre-check + UNIQUE constraint (TASK-R15-002)

WEEK 3 — Feature completion
  13. Build job workers / processors
  14. Wire email/SMS notification transport
  15. Complete real carrier API calls (decrypt key, add timeout)
  16. Order → Inventory lifecycle link
  17. WebSocket server
  + Wire reship + refund service calls in resolveException (TASK-R14-011)

WEEK 4 — Integration + testing
  18. Connect all frontend forms to backend
  19. Analytics improvements (parallel queries, CSV export)
  20. Write unit + integration tests for all fixed modules
