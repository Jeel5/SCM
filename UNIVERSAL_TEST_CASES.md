# Universal Test Cases Matrix

Date: 2026-04-09
Repository: SCM
Scope: Backend APIs, services, repositories, jobs, frontend flows, demo portals, and operational controls.

## Status Legend

- Passed: Implemented and supported by current code behavior and/or automated tests.
- Partial: Implemented, but coverage is incomplete (edge cases, automation, or end-to-end verification missing).
- Not Implemented: No production path or missing endpoint/workflow for the scenario.

## Evidence Sources Used During Scan

- Existing reports: `TEST_CASE_VERIFICATION_REPORT.md`, `IMPORTANT_TEST_CASES.md`
- Backend routes: `backend/routes/*.js`
- Controllers/services/repositories across `backend/controllers`, `backend/services`, `backend/repositories`
- Scheduled jobs: `backend/jobs/scheduledHandlers.js`, `backend/jobs/cronScheduler.js`, `backend/server.js`
- Existing tests: `backend/tests/routes/*`, `backend/tests/repositories/*`, `backend/tests/services/*`, `backend/tests/integration.test.js`
- Frontend pages/hooks/apis: `frontend/src/pages/**`, `frontend/src/api/services.ts`

## Universal Test Cases

| ID | Module | Test Case | Detailed Validation | Status | Evidence / Gap |
|---|---|---|---|---|---|
| UTC-001 | Auth | Email/password login success | Valid credentials return success and set auth cookies/session | Passed | `backend/controllers/usersController.js` login flow |
| UTC-002 | Auth | Login failure on invalid password | Invalid password returns auth error without sensitive leakage | Passed | Same controller + error flow |
| UTC-003 | Auth | Token refresh | Refresh endpoint validates refresh token and issues new access token | Passed | `usersController.refreshToken` |
| UTC-004 | Auth | Logout revokes session | Logout clears cookies and revokes stored session | Passed | `usersController.logout` |
| UTC-005 | Auth | Protected route requires auth | Call protected route without token/cookie | Passed | Route tests in `backend/tests/routes/*.test.js` |
| UTC-006 | Auth | Authorization header fallback | Bearer token works when cookie absent | Passed | `backend/middlewares/auth.js` |
| UTC-007 | Auth | Token revocation enforcement | Revoked JTI is blocked on protected APIs | Partial | Middleware checks revocation; no dedicated route test |
| UTC-008 | Auth | Rate-limit on auth endpoints | Excessive auth attempts produce 429 | Passed | `backend/middlewares/rateLimiter.js`, `server.js` wiring |
| UTC-009 | Auth | Google login audience check | Backend rejects Google token when audience mismatches | Passed | `usersController.googleLogin` |
| UTC-010 | Auth | Google OAuth client-id config in frontend | Google button must fail-safe when client id missing | Partial | Frontend guard exists, but no automated test |
| UTC-011 | RBAC | Permission allow path | Authorized role can access matching endpoints | Passed | Route-level `authorize(...)` in routes |
| UTC-012 | RBAC | Permission deny path | Unauthorized role receives 403 | Passed | Route-level guards + middleware |
| UTC-013 | RBAC | UI menu permission gating | Sidebar/menu hides unauthorized sections | Partial | Frontend gating exists, UI tests missing |
| UTC-014 | Multi-tenant | Org isolation for reads | User only sees own org records across modules | Passed | Org filters throughout repositories |
| UTC-015 | Multi-tenant | Org isolation for writes | User cannot mutate cross-org resources | Partial | Many checks present; broad e2e absent |
| UTC-016 | Users | Profile fetch/update | User can fetch and patch profile data | Passed | `usersController` settings endpoints |
| UTC-017 | Users | Change password validation | Current/new password rules and update behavior | Partial | Endpoint present; no dedicated automated test |
| UTC-018 | Users | Session management | List sessions, revoke single/all sessions | Partial | Endpoint logic present; no route test |
| UTC-019 | Users | User creation under org | Admin creates org user with role constraints | Partial | Endpoint present; role matrix not fully tested |
| UTC-020 | Superadmin | Organization lifecycle actions | Suspend/activate/restore org behavior and access impact | Partial | Endpoints exist; deep lifecycle tests missing |
| UTC-021 | Superadmin | Impersonation start/stop | Superadmin can impersonate non-superadmin users safely | Partial | Controller logic exists; no dedicated automation |
| UTC-022 | Superadmin | Organization billing summary API | Billing stats per org are returned for superadmin | Passed | `routes/organizations.js` + `OrganizationRepository.getOrganizationBillingSummary` |
| UTC-023 | Orders | Draft order creation | Valid payload creates draft order | Passed | Order controller/service flow |
| UTC-024 | Orders | Status transitions valid path | Allowed transitions update order state | Partial | Works, but full transition matrix not auto-tested |
| UTC-025 | Orders | Invalid transitions rejected | Invalid state jump should fail consistently | Partial | Some checks exist; not centralized state-machine test |
| UTC-026 | Orders | Out-of-stock rejection | Insufficient stock blocks order allocation | Passed | Inventory reserve logic in service/repository |
| UTC-027 | Orders | Address validation robustness | Malformed address should be rejected | Partial | Basic structure present; strict validation not exhaustive |
| UTC-028 | Orders | Transaction atomicity | Mid-flow failures rollback partial writes | Passed | `withTransaction` usage in critical writes |
| UTC-029 | Orders | Order list filtering/pagination | Query filters and page metadata correctness | Partial | Endpoints present; no broad route assertions |
| UTC-030 | Orders | Order webhooks flow | External order payload creates internal order/jobs | Partial | Implemented; comprehensive deterministic e2e missing |
| UTC-031 | Inventory | Create inventory item | Create path inserts inventory record with defaults | Passed | Repo behavior verified in tests |
| UTC-032 | Inventory | Upsert inventory by SKU | Existing row upserts correctly per design | Passed | `InventoryRepository.test.js` |
| UTC-033 | Inventory | Reserve stock success | Available decreases, reserved increases | Passed | `InventoryRepository.test.js` |
| UTC-034 | Inventory | Reserve stock failure | Over-reserve fails safely | Passed | `InventoryRepository.test.js` |
| UTC-035 | Inventory | Adjust stock and movement logging | Add/subtract stock produces movement records | Partial | Paths exist; not fully asserted across all endpoints |
| UTC-036 | Inventory | Low-stock detection | Inventory below reorder point appears in low stock | Partial | Logic exists; no dedicated test suite |
| UTC-037 | Inventory | Reorder generation | Restock orders generated from low stock conditions | Partial | Implemented in imports/services; coverage incomplete |
| UTC-038 | Inventory | Restock list endpoint | Recent restocks fetch with filters/pagination | Passed | Endpoint exists and used by frontend |
| UTC-039 | Inventory | Restock update endpoint | Status/tracking/PO updates persist correctly | Passed | `PATCH /inventory/restock-orders/:id` present |
| UTC-040 | Inventory | Restock received inventory posting | First received transition increments inventory once | Passed | Receive-side transactional update implemented |
| UTC-041 | Inventory | Restock idempotency | Repeated received update does not double-add stock | Passed | Guarded logic in restock receive flow |
| UTC-042 | Warehouses | Warehouse CRUD | Create/list/update/deactivate warehouse behavior | Partial | Implemented via MDM routes; full matrix not auto-tested |
| UTC-043 | Warehouses | Transfer order flow | Transfer creates/updates stock and state transitions | Partial | UI and backend flow present; deep validation missing |
| UTC-044 | Warehouses | Capacity utilization metrics | Capacity/current stock utilization correctness | Partial | Analytics supports it; no strict assertion suite |
| UTC-045 | Carriers | Carrier create/read/update | Carrier lifecycle operations and field updates | Passed | Carrier repository tests cover create/update |
| UTC-046 | Carriers | Carrier assignment pending fetch | Pending assignments scoped by carrier id | Partial | Endpoint exists; deterministic route tests missing |
| UTC-047 | Carriers | Carrier webhook auth via HMAC | Signed payload accepted, invalid signature rejected | Partial | Middleware/logic exists; negative-path tests limited |
| UTC-048 | Carriers | Assignment accept/reject flow | Carrier can accept/reject assignment with quote data | Partial | Endpoints exist; full outcome assertions limited |
| UTC-049 | Shipments | Shipment creation | Shipment record created from assignment/order | Partial | Implemented; route-level deterministic tests missing |
| UTC-050 | Shipments | Shipment status timeline | Events added for picked-up/in-transit/delivered chain | Partial | Event model exists; no full route test chain |
| UTC-051 | Shipments | Unauthorized shipment updates blocked | Carrier/user without rights cannot update shipment | Partial | Guarding exists; no explicit regression suite |
| UTC-052 | Shipments | Tracking updates realtime propagation | Status updates reflected in downstream subscribers/UI | Partial | Socket emissions exist; no e2e websocket tests |
| UTC-053 | Returns | Return list endpoint auth + shape | Returns API returns expected canonical fields + stats | Passed | `backend/tests/routes/returns.test.js` |
| UTC-054 | Returns | Return lifecycle transitions | requested -> approved -> received -> inspected -> refunded | Partial | Workflow exists; full transition suite not automated |
| UTC-055 | Returns | Refund eligibility rules | Only eligible statuses can be refunded | Partial | Rule config exists; edge-case matrix incomplete |
| UTC-056 | Returns | Return creation validation | Missing key data rejected with clear errors | Partial | Validators exist; comprehensive test matrix missing |
| UTC-057 | Finance | Financial summary auth + shape | Summary endpoint protected and returns expected payload | Passed | `backend/tests/routes/finance.test.js` |
| UTC-058 | Finance | Outstanding invoice calculation | Outstanding includes pending+approved+disputed, excludes paid | Passed | `FinanceRepository.getFinancialSummary` |
| UTC-059 | Finance | Invoice create duplicate prevention | Duplicate invoice number in org rejected | Passed | `invoiceNumberExists` check in create flow |
| UTC-060 | Finance | Invoice approve transition | pending -> approved transition allowed and audited | Partial | Logic present; transition test limited |
| UTC-061 | Finance | Invoice pay transition | approved -> paid with payment fields | Partial | Service/repo logic present; broad route tests missing |
| UTC-062 | Finance | Invalid invoice transition blocked | Invalid status transitions rejected | Partial | Transition rules exist; exhaustive test matrix missing |
| UTC-063 | Finance | Dispute resolution flow | disputed invoice resolves to approved with optional adjustment | Partial | Implemented in repo/controller; limited automation |
| UTC-064 | Finance | Refund processing guard | Non-inspected return cannot be refunded | Partial | Lock/check logic exists; dedicated test missing |
| UTC-065 | Finance | Invoice audit logs immutable trail | Invoice updates append audit entries | Partial | Audit writes present; retrieval consistency not fully tested |
| UTC-066 | Finance | Auto invoice generation job | Scheduled job generates carrier invoices with line items | Partial | Job wired; deterministic monthly simulation not fully automated |
| UTC-067 | SLA | SLA policy CRUD | Policy create/list/update/deactivate behavior | Partial | Endpoints and repository present; limited tests |
| UTC-068 | SLA | SLA monitoring manual trigger | `/sla/monitor/run` detects violations and exceptions | Passed | Controller + route exist and execute both services |
| UTC-069 | SLA | Violation generation for overdue shipments | Late shipments create violation with penalty | Partial | Service logic exists; full data-path assertions missing |
| UTC-070 | SLA | Penalty capping logic | Penalty capped at defined percentage/rules | Partial | Calculation exists; edge-case tests missing |
| UTC-071 | SLA | Violation listing filters | Status/org filters and pagination correctness | Partial | Endpoint exists; no dedicated route tests |
| UTC-072 | SLA | SLA dashboard metrics | Compliance and violation buckets accuracy | Partial | Endpoint exists; no fixed fixture assertion suite |
| UTC-073 | SLA | Apply penalty operation via API | Dedicated API to apply penalty to violation | Not Implemented | Service method exists, route/controller action absent |
| UTC-074 | SLA | Waive penalty operation via API | Dedicated API to waive penalty with reason | Not Implemented | Service method exists, route/controller action absent |
| UTC-075 | Exceptions | Exception creation endpoint | Create exception with severity/type and org scope | Partial | Endpoint exists; broad validation matrix missing |
| UTC-076 | Exceptions | Exception details fetch | Retrieve exception by id with shipment/order joins | Partial | Endpoint exists; no dedicated route tests |
| UTC-077 | Exceptions | Exception resolve endpoint | Resolve updates status + resolution metadata | Partial | Implemented; tests limited |
| UTC-078 | Exceptions | Auto detect delayed shipment exceptions | Delayed shipments without exception get new delay exception | Passed | `exceptionService.autoDetectDelayExceptions` |
| UTC-079 | Exceptions | Auto escalation overdue exceptions | Escalation level/status updates for overdue exceptions | Passed | `autoEscalateOverdueExceptions` + fixed repo query |
| UTC-080 | Exceptions | Assign exception via API | Endpoint to assign exception owner | Not Implemented | Repository/service has assign method; route missing |
| UTC-081 | Exceptions | Escalate exception via API | Endpoint to manually escalate exception | Not Implemented | Service has escalate method; route missing |
| UTC-082 | Exceptions | Resolve with reship side-effect | Resolution=reship creates replacement shipment | Not Implemented | Placeholder comment in `exceptionService.resolveException` |
| UTC-083 | Exceptions | Resolve with refund side-effect | Resolution=refund triggers refund flow | Not Implemented | Placeholder comment in `exceptionService.resolveException` |
| UTC-084 | Analytics | Analytics aggregate endpoint | Range-based analytics returns all major blocks | Partial | Controller/repo implemented; no direct route tests |
| UTC-085 | Analytics | Orders over time bucket correctness | day/week/month/year grouping output consistency | Partial | SQL paths exist; deterministic fixture tests missing |
| UTC-086 | Analytics | Financial metrics math consistency | Revenue/cost/penalty/refund values consistent with data | Partial | Query and UI formulas exist; cross-check tests missing |
| UTC-087 | Analytics | Net revenue display logic in UI | Net revenue reflects +penalties and -refund/-shipping | Passed | Frontend analytics formula and labels implemented |
| UTC-088 | Analytics | CSV export by type/range | Export generates CSV with required columns | Partial | Export endpoints exist; no automated file-content tests |
| UTC-089 | Dashboard | Role-based tab visibility | Users see only allowed analytics/dashboard tabs | Partial | UI logic present; no automated frontend tests |
| UTC-090 | Notifications | Notification create emits realtime event | Persist + `notification:new` socket emission | Passed | `notificationService.test.js` |
| UTC-091 | Notifications | Notification list pagination | Count, unread count, and pagination accuracy | Passed | `notificationService.test.js` |
| UTC-092 | Notifications | Mark single as read | Authorized user marks notification read | Passed | `notificationService.test.js` |
| UTC-093 | Notifications | Mark all as read | Bulk read operation returns expected count | Partial | Service/repo path exists; direct test limited |
| UTC-094 | Jobs | SLA monitoring schedule registration | Baseline cron schedules auto-created at boot | Passed | `server.js` baseline schedule setup |
| UTC-095 | Jobs | Cron update/delete sync | Updating/deleting DB schedule syncs BullMQ repeatables | Partial | Scheduler methods exist; no integration automation |
| UTC-096 | Jobs | Job worker resilience and retries | Failed jobs retry/backoff/dead-letter behavior | Partial | Queue infra exists; chaos/soak tests missing |
| UTC-097 | Imports | Warehouse/carrier/product CSV imports | Import handlers parse, validate, and persist rows | Partial | Rich handlers exist; broad fixture set not automated |
| UTC-098 | Imports | Supplier merge by name | Supplier CSV enriches existing supplier records by name | Passed | Import handler logic implemented |
| UTC-099 | Imports | Product brand->supplier linkage | Product import links/creates supplier from brand | Passed | Import handler logic implemented |
| UTC-100 | Imports | Auto-generate supplier api endpoint | Missing supplier endpoint generated during import | Passed | Import handler generation logic implemented |
| UTC-101 | Imports | Auto-restock supplier fallback from brand | Restock creation resolves supplier via product brand | Passed | Commerce import handler logic implemented |
| UTC-102 | Imports | Import dry-run correctness | Dry-run performs validation without mutating DB | Partial | Dry-run support present; exhaustive asserts missing |
| UTC-103 | Webhooks | Public webhook auth and processing | Valid token/signature accepted and queued | Partial | Webhook routes and handlers present; deep e2e limited |
| UTC-104 | Webhooks | Invalid webhook auth rejection | Invalid token/signature rejected safely | Partial | Logic exists; negative automated tests limited |
| UTC-105 | Webhooks | Retry behavior on transient failure | Failed webhook processing retried with backoff | Partial | Job/retry structure exists; deterministic test missing |
| UTC-106 | Partners | Suppliers CRUD + endpoint actions | Create/update suppliers and open/demo endpoint actions | Partial | UI + API paths exist; no frontend automation |
| UTC-107 | Partners | Sales channels CRUD | Channel management with validation and activation state | Partial | API and UI flows present; route/UI tests sparse |
| UTC-108 | Geo | Reverse geocode proxy | Map click resolves address fields safely | Partial | Route exists and used in demo; no automated tests |
| UTC-109 | Demo | Customer portal order flow | Select product + map pin + estimate + place order | Partial | Demo JS implemented; manual validation only |
| UTC-110 | Demo | Carrier portal assignment lifecycle | Select carrier, accept/reject, status updates | Partial | Demo JS implemented; manual validation only |
| UTC-111 | Demo | Supplier portal reorder updates | Filter/edit restock status/tracking from demo portal | Partial | Demo JS implemented; manual validation only |
| UTC-112 | Security | CORS configuration | Allowed origins and credential behavior verified | Partial | Config exists; no dedicated security test |
| UTC-113 | Security | Helmet headers | Security headers present on responses | Partial | Middleware enabled; no response-header test suite |
| UTC-114 | Security | SQL injection protection via parameterized queries | Critical queries use placeholders not interpolation | Partial | Strong pattern present; not formally audited by tool |
| UTC-115 | Security | Input validation coverage | Joi schemas protect high-risk endpoints | Partial | Many validators present; not complete coverage map |
| UTC-116 | Security | Sensitive data exposure checks | Responses do not leak password hashes/secrets | Partial | Generally safe patterns; no dedicated static policy checks |
| UTC-117 | Performance | API throughput baseline | Core endpoints under acceptable latency under load | Not Implemented | No reproducible load benchmark suite in repo |
| UTC-118 | Performance | Concurrent stock reservation race test | Multi-thread reserve attempts never oversell | Not Implemented | No concurrency harness test in automated suite |
| UTC-119 | Reliability | Restart safety for cron and jobs | Restart keeps repeatables and avoids duplicates | Partial | Design supports this; restart integration tests absent |
| UTC-120 | Reliability | Graceful shutdown correctness | In-flight processing and server close behavior validated | Partial | Handlers implemented; no deterministic shutdown test |
| UTC-121 | Frontend QA | Unit tests for pages/hooks/components | Core UI logic covered by automated unit tests | Not Implemented | No frontend test suite found |
| UTC-122 | Frontend QA | E2E smoke across critical workflows | Login -> order -> shipment -> return -> finance validated | Not Implemented | No Playwright/Cypress suite found |
| UTC-123 | Data Integrity | Schema migration drift checks | Startup/CI validates schema against repository expectations | Partial | Migrations exist; strict drift gate not evident |
| UTC-124 | Observability | Structured logs for critical failures | Errors include IDs/context for triage | Passed | Structured logging pattern present in services/controllers |
| UTC-125 | Observability | Metrics/health completeness | Health endpoint + operational metrics coverage | Partial | `/health` exists; full metrics endpoint not evident |
| UTC-126 | Auth | Google OAuth missing client-id fail-safe | Login screen should hide/disable Google flow when client id env is absent | Partial | Guarding exists in frontend; automated UI test missing |
| UTC-127 | Auth | Google OAuth end-to-end success | Valid Google credential passes backend audience check and logs user in | Partial | Backend path exists; relies on external Google config and manual verification |
| UTC-128 | Exceptions | Startup exception escalation safety | Scheduler should not fail on escalation query/schema mismatch | Passed | Exception escalation query aligned to existing schema columns |
| UTC-129 | Inventory | Restock status update with received path | PATCH restock status to received should apply stock and return applied count | Passed | Restock receive flow implemented with transactional inventory update |
| UTC-130 | Inventory | Restock received duplicate update guard | Re-sending received should not double-apply stock movements | Passed | Receive path contains one-time application guard |
| UTC-131 | Inventory | Restock tracking-only updates | Tracking/PO/ETA updates should persist without inventory side effects | Passed | PATCH endpoint supports non-received updates safely |
| UTC-132 | Imports | Supplier endpoint autogeneration fallback | Missing supplier api_endpoint in CSV should be auto-filled | Passed | Import handler generates endpoint when field absent |
| UTC-133 | Imports | Supplier endpoint bearer token propagation | Generated supplier endpoint includes token when configured | Partial | Supported by env-based generation; env-dependent manual verification |
| UTC-134 | Imports | Supplier import merge by name casing | Name match should be case-insensitive and avoid duplicate supplier rows | Passed | Supplier upsert-by-name logic implemented |
| UTC-135 | Imports | Product brand-driven supplier mapping | Product brand should resolve/create supplier and link supplier_id | Passed | Product import brand-to-supplier linking implemented |
| UTC-136 | Demo | Carrier selector deduplication | Duplicate carrier records should render once in carrier portal | Passed | Carrier portal deduplicates entries before rendering buttons |
| UTC-137 | Demo | Supplier portal token prefill | token query param should prefill bearer token and persist local storage | Passed | Supplier demo script reads query token and stores it |
| UTC-138 | Demo | Supplier portal restock update action | Save Changes should PATCH restock and refresh list state | Partial | Flow implemented; no automated browser test |
| UTC-139 | Finance UI | Outstanding amount mapping correctness | Finance summary card must use outstanding_amount over pending_amount | Passed | Finance hook now prefers outstanding_amount from API |
| UTC-140 | Superadmin | Org billing scope correctness | Superadmin billing modal returns only selected org range window | Passed | Dedicated org billing endpoint and repository org filter present |

## High-Priority Gaps (Not Implemented)

1. Exception resolution side-effects are placeholders:
   - reship flow is not executed
   - refund flow is not executed
2. SLA penalty lifecycle is missing API surface:
   - apply penalty action endpoint missing
   - waive penalty action endpoint missing
3. Exception operations API surface is incomplete:
   - assign exception endpoint missing
   - manual escalate exception endpoint missing
4. Automated QA depth is missing on frontend and end-to-end system tests.
5. Concurrency/performance verification suite is missing.

## Recommended Execution Order for Test Automation Buildout

1. Add backend route tests for SLA/Exceptions/Orders/Shipments transition matrices.
2. Add integration tests for monthly invoice generation and webhook retry behavior.
3. Add deterministic concurrency tests for inventory reservation.
4. Add frontend unit tests for hooks and critical pages.
5. Add end-to-end smoke suite covering auth, order lifecycle, returns, finance, and analytics.

## Notes

- This file is intentionally universal and exhaustive for current repository surfaces.
- Status values are implementation-readiness labels, not production certification.
- Re-run this scan after any major route/service/schema change.
