# SCM Platform Logic and Test Coverage (Presentation Version)

## 4.1 User and Access Management Module (RBAC)

### Logic

📌 Logic:

User registration accepts core identity fields and stores passwords using BCrypt hashing (salt factor 12).
Login validates credentials and issues JWT access and refresh tokens through secure httpOnly cookies.
Session revocation is enforced through revoked-token tracking and JTI validation checks.
RBAC middleware applies dot-notation permissions to control endpoint and action access.
Role-aware UI access ensures users only see dashboards and features mapped to their role.
Each request is tagged with requestId and logged with structured user and organization context.
Brute-force defense monitors repeated failed attempts per IP and applies temporary lockout safeguards.

### Test Cases
| Test Case ID | Scenario | Input | Expected Output |
|---|---|---|---|
| TC-01 | Login works | Valid email and password | User logs in successfully |
| TC-02 | Login fails on wrong password | Valid email and wrong password | Login is rejected |
| TC-03 | Token refresh works | Expired access token + valid refresh cookie | New access token is issued |
| TC-04 | Logout blocks access | Logout then call protected API | API returns unauthorized |
| TC-05 | Permission allowed | User with orders view permission opens orders | Orders page/data opens |
| TC-06 | Permission denied | User without finance permission opens finance page | Access is denied |
| TC-07 | Role-based menu | Login as warehouse user | Only allowed menu items are shown |
| TC-08 | Auth rate limit | Many failed logins from same IP | Further login attempts are blocked temporarily |

## 4.2 Order Management System (OMS)

### Logic

📌 Logic:

Order creation captures required order details and progresses through a controlled lifecycle.
State transitions follow defined workflow stages to prevent invalid movement across statuses.
Order writes across multiple entities are handled atomically using transactional processing.
Background order-processing jobs execute asynchronous allocation and setup tasks.
ATP validation confirms SKU availability before final commitment.
Address and route validation ensure deliverability before downstream fulfillment.
Order updates are propagated in real time to organization-scoped channels.
Organization-level scoping ensures strict tenant data isolation across order operations.

### Test Cases
| Test Case ID | Scenario | Input | Expected Output |
|---|---|---|---|
| TC-09 | Create draft order | Valid order details | Draft order is created |
| TC-10 | Submit order | Valid draft order | Status changes to submitted |
| TC-11 | Reject out-of-stock order | Order with unavailable SKU | Order is rejected with stock error |
| TC-12 | Reject invalid address | Order with bad delivery address | Order is rejected with address error |
| TC-13 | Keep data complete on failure | Force DB error during order create | No partial order data is saved |
| TC-14 | Process order job | Submit order that triggers async setup | Background order job is created and runs |
| TC-15 | State transition rules | Try invalid status jump | Invalid status update is blocked |
| TC-16 | Org data isolation | Org A user fetches orders | Only Org A orders are shown |

## 4.3 Inventory and Warehouse Management Module (IWMS)

### Logic

📌 Logic:

Inventory is maintained across multiple warehouses with clear tracking of Total, Committed, and Quality Check quantities.
When an order is allocated, stock is validated and reserved through soft-lock controls.
Warehouse allocation is selected using availability, location fit, and workload balancing rules.
Split-fulfillment decisions are applied when multi-warehouse sourcing improves service performance.
Stock is updated automatically during allocation, packing, shipment movement, and receipt confirmation.
Hard deduction is applied after physical handling checkpoints are completed.
Low-stock monitoring evaluates reorder thresholds using usage and lead-time patterns.
Rebalancing jobs recommend stock transfers to reduce regional shortages and overstock risk.

### Test Cases
| Test Case ID | Scenario | Input | Expected Output |
|---|---|---|---|
| TC-17 | Reserve stock on allocation | Create allocation for order | Reserved quantity increases |
| TC-18 | Prevent over-selling | Concurrent requests for same low stock item | System blocks extra allocation |
| TC-19 | Deduct stock after packing/shipping | Complete pick and pack flow | Actual stock reduces correctly |
| TC-20 | Stock add movement log | Add stock to warehouse | Movement entry is recorded |
| TC-21 | Stock transfer movement log | Transfer stock between warehouses | Out and in movement entries are recorded |
| TC-22 | Best warehouse selection | Order with serviceable address | Closest eligible warehouse is selected |
| TC-23 | Split fulfillment | Multi-item order with split stock locations | Order is split correctly across warehouses |
| TC-24 | Low stock alert | Reduce stock below threshold | Low stock alert is created |
| TC-25 | Rebalancing suggestion | Large regional stock imbalance | Transfer recommendation is generated |

## 4.4 Shipment Management Module

### Logic

📌 Logic:

Shipment records are generated once allocation readiness is confirmed.
Each shipment is linked to its order and managed through a defined status lifecycle.
Carrier assignment is optimized using cached quotes, capacity fit, and reliability factors.
Shipment movement follows standardized states from pickup to delivery completion.
Tracking timelines capture location breadcrumbs and milestone events for live visibility.
Dispatch operations coordinate manifests, warehouse handoff, and delivery instructions.
Proof-of-delivery artifacts (photo/signature) finalize shipment completion.
Final shipment state updates are reflected system-wide for operational and finance continuity.

### Test Cases
| Test Case ID | Scenario | Input | Expected Output |
|---|---|---|---|
| TC-26 | Shipment creation | Confirm allocation for order | Shipment record is created |
| TC-27 | Auto carrier assignment | Shipment with multiple carrier options | Best carrier is selected |
| TC-28 | Quote caching | Repeat quote call inside cache window | Cached quote is reused |
| TC-29 | Pickup state update | Update shipment to picked up | Status becomes picked up |
| TC-30 | Transit state update | Update shipment to in transit | Status becomes in transit |
| TC-31 | Out for delivery update | Update shipment to out for delivery | Status becomes out for delivery |
| TC-32 | Delivery proof completion | Upload PoD/signature | Status becomes delivered |
| TC-33 | Unauthorized shipment update blocked | Wrong carrier updates shipment | Update is rejected |
| TC-34 | Real-time tracking update | New tracking event received | Tracking timeline updates immediately |

## 4.5 Carrier Management System (CMS)

### Logic

📌 Logic:

Carrier profiles maintain operational data such as capacity, permit types, and current availability.
Carrier states are managed dynamically as Active, Busy, or Unavailable based on workload.
During shipment assignment, only eligible and available carriers are considered.
Utilization thresholds and assignment rules prevent overloading specific carriers.
Delivery completion updates carrier status back to active assignment readiness.
Performance scoring uses turnaround and reliability outcomes to improve future selection.
Carrier webhook updates are accepted only after signature verification.
Failed webhook processing is retried asynchronously with exponential backoff handling.

### Test Cases
| Test Case ID | Scenario | Input | Expected Output |
|---|---|---|---|
| TC-35 | Carrier listing filter | Request eligible carriers for assignment | Busy/offline carriers are not listed |
| TC-36 | Webhook signature valid | Send webhook with correct HMAC | Webhook is accepted |
| TC-37 | Webhook signature invalid | Send webhook with wrong HMAC | Webhook is rejected |
| TC-38 | Webhook retry queue | Force webhook processing failure | Retry job is queued with backoff |

## 4.6 SLA Management and ETA Prediction Engine

### Logic

📌 Logic:

SLA policies define delivery commitments through tiered deadline models.
Each shipment is mapped to an SLA timeline at creation and monitored against milestone anchors.
ETA prediction combines route intelligence, historical transit behavior, and operational buffers.
Progress is monitored continuously to identify potential delays before deadline breach.
Hourly SLA checks detect shipments moving outside committed service windows.
Potential breach flags are raised early in control views for proactive intervention.
Delay conditions trigger automated customer and operations alerts.
Compliance metrics are aggregated by domain, including warehouse and carrier performance.

### Test Cases
| Test Case ID | Scenario | Input | Expected Output |
|---|---|---|---|
| TC-39 | SLA policy creation | Create valid SLA policy | Policy is saved |
| TC-40 | SLA tier assignment | Create new order/shipment | Correct SLA tier and deadline set |
| TC-41 | ETA calculation | Distance and route data | ETA is calculated and stored |
| TC-42 | Potential breach detection | ETA later than SLA deadline | Breach flag is created |
| TC-43 | SLA monitor run | Trigger SLA monitor endpoint/job | Violations are detected |
| TC-44 | Delay exception generation | Shipment crosses delay threshold | Delay exception is created |
| TC-45 | SLA dashboard metrics | Request SLA dashboard summary | Compliance and violation numbers are returned |

## 4.7 Finance Management Module

### Logic

📌 Logic:

Finance workflows capture shipment-level costs including delivery charges and operational overhead.
Each order is linked with cost and billing context for profitability tracking.
Invoicing logic cross-verifies execution and commercial records before settlement.
Delivered-state workflows trigger receipts and payment requests automatically.
Accounting controls maintain balanced debit-credit consistency for audit readiness.
Finance summaries are generated for daily and monthly operational reporting.
Variance analysis highlights cases where actual cost exceeds initial estimates.
Role-based controls restrict finance actions to authorized users.

### Test Cases
| Test Case ID | Scenario | Input | Expected Output |
|---|---|---|---|
| TC-46 | Create invoice totals | Invoice with charges and line items | Final amount is correct |
| TC-47 | Prevent duplicate invoice number | Reuse existing invoice number in same org | Request is rejected |
| TC-48 | Approve invoice | Approve pending invoice | Invoice status changes to approved |
| TC-49 | Mark invoice paid | Pay approved invoice | Invoice status changes to paid |
| TC-50 | Process refund | Valid refund request | Refund is posted correctly |
| TC-51 | Auto invoice on delivery | Shipment marked delivered | Invoice/receipt flow starts |
| TC-52 | Finance summary report | Request finance summary | Totals for invoices/refunds are returned |
| TC-53 | Block unauthorized finance access | Non-finance user calls finance API | Access is denied |

## 4.8 Analytics and Dashboard

### Logic

📌 Logic:

Analytics pipelines collect and merge data from orders, shipments, and inventory modules.
Data is processed and aggregated into KPI-ready and trend-ready views.
Dashboards display operational signals such as order flow, shipment movement, and warehouse utilization.
Carrier and service performance views support quality and efficiency decisions.
Real-time updates keep dashboard state aligned with live operations.
Drill-down logic links summary charts to detailed operational records.
Dashboard access is role-based so each user sees relevant business insights.

### Test Cases
| Test Case ID | Scenario | Input | Expected Output |
|---|---|---|---|
| TC-54 | KPI calculation | Known fulfillment dataset | KPI values are correct |
| TC-55 | Dashboard loads core cards | Open dashboard with valid role | Cards for orders/shipments/exceptions load |
| TC-56 | Role-based dashboard tabs | Login as warehouse role | Finance tab is hidden |
| TC-57 | Real-time dashboard update | Change order/shipment status | Dashboard updates quickly |
| TC-58 | Chart drill-down | Click chart point | Related list is filtered |
| TC-59 | Date-range analytics filter | Change dashboard date range | Metrics and charts refresh |
| TC-60 | Empty-state handling | Select time range with no data | Dashboard shows clean empty state |

## 4.9 Alerts and Notifications

### Logic

📌 Logic:

The alert layer monitors cross-module events and business exception signals continuously.
Alerts are generated for conditions such as delays, SLA risk, and operational anomalies.
Severity classification is applied as Critical, Warning, or Informational for prioritization.
Routing policies send critical alerts to admins and operational alerts to relevant stakeholders.
Notifications are delivered through in-app channels, with support for email and SMS workflows.
Escalation jobs promote unresolved critical alerts after defined timeout windows.
Notification history is stored for traceability, compliance, and response analysis.
Threshold tuning allows teams to shift from reactive handling to proactive monitoring.

### Test Cases
| Test Case ID | Scenario | Input | Expected Output |
|---|---|---|---|
| TC-61 | Create alert on event | Trigger critical business event | Alert is created |
| TC-62 | Severity tagging | Trigger warning and critical events | Correct severity is assigned |
| TC-63 | Route alert to right users | Send critical vs normal alert | Correct users receive it |
| TC-64 | In-app notification delivery | Create operational alert | In-app notification appears |
| TC-65 | Escalate unacknowledged alert | Leave alert pending past timeout | Alert is escalated |
| TC-66 | Notification history log | Send notification then query history | Delivery history is saved |
| TC-68 | Duplicate alert control | Trigger same event repeatedly quickly | System avoids noisy duplicate alerts |
