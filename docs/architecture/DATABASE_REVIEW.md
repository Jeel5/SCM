You are a Senior Principal Database Architect reviewing a production-grade Supply Chain Management (SCM) platform database.

The project is a multi-tenant logistics + e-commerce + warehouse + carrier orchestration system.

You must evaluate the database design using REAL WORLD INDUSTRY STANDARDS used by Amazon Logistics, DHL, Shiprocket, Delhivery, and enterprise ERP systems.

Analyze the schema and apply the following architectural principles:

- High scalability
- Multi-tenant isolation
- Operational safety
- Financial correctness
- Auditability
- Event traceability
- Future extensibility
- Query performance at millions of shipments

Do NOT focus on syntax — focus on architecture quality.

Provide recommendations grouped into:

1. CRITICAL CHANGES (must fix before production)
2. ARCHITECTURAL IMPROVEMENTS
3. PERFORMANCE IMPROVEMENTS
4. DATA MODEL CORRECTIONS
5. THINGS TO DELETE OR SIMPLIFY
6. ENTERPRISE FEATURES MISSING
7. IDEAL FINAL DATABASE ARCHITECTURE

------------------------------------------------------------
CURRENT SYSTEM CONTEXT
------------------------------------------------------------

This SCM platform supports:

- Orders
- Shipments
- Carrier Assignment
- Warehouse Operations
- Inventory
- Returns
- SLA Monitoring
- Billing & Invoices
- Background Jobs
- Notifications
- Multi-tenant Organizations
- Webhooks
- Tracking events
- Exception management

PostgreSQL is used.

Triggers already exist for:
- volumetric weight
- webhook credential generation
- inventory sync

------------------------------------------------------------
CRITICAL DATABASE DESIGN RECOMMENDATIONS
------------------------------------------------------------

### 1. ADD UNIVERSAL TENANCY COLUMN (CRITICAL)

Every business table MUST contain:

organization_id UUID NOT NULL

Required tables:
- orders
- shipments
- inventory
- products
- warehouses
- invoices
- exceptions
- returns
- carrier_assignments
- notifications
- sla_violations

Reason:
Real SCM systems NEVER rely only on middleware tenancy.

Add composite indexes:

CREATE INDEX idx_orders_org_created
ON orders (organization_id, created_at);

Without this → scaling failure at ~50k customers.

------------------------------------------------------------

### 2. ADD GLOBAL AUDIT TRAIL TABLE (CRITICAL)

Your system logs events in code but NOT structurally.

Add:

audit_events
-------------
id
organization_id
actor_user_id
entity_type
entity_id
action
old_data JSONB
new_data JSONB
created_at

Every update must be auditable.

Required for:
- enterprise customers
- finance compliance
- disputes
- SLA penalties

------------------------------------------------------------

### 3. SHIPMENTS NEED EVENT SOURCING MODEL

Currently tracking_events JSON exists.

This is GOOD but incomplete.

Industry standard:

shipments (current state)
shipment_events (source of truth)

RULE:
shipment.status must ALWAYS be derived from latest event.

Never treat status as independent data.

Add:

event_sequence INT
event_source ENUM('carrier','system','manual')

------------------------------------------------------------

### 4. INVENTORY MODEL NEEDS HARDENING (VERY IMPORTANT)

Current pattern risks stock corruption.

Split inventory into:

inventory_items
---------------
product_id
warehouse_id
on_hand_qty
reserved_qty
damaged_qty
in_transit_qty

inventory_movements (ledger)
----------------------------
id
product_id
warehouse_id
movement_type
reference_type
reference_id
quantity
created_at

Never update stock without movement entry.

Inventory must behave like a financial ledger.

------------------------------------------------------------

### 5. ORDERS & SHIPMENTS RELATIONSHIP

REAL SCM RULE:

Order ≠ Shipment

Support:

- Split shipment
- Partial shipment
- Multi-warehouse fulfillment

Add:

order_shipments
---------------
order_id
shipment_id
quantity_allocated

Without this you cannot scale fulfillment.

------------------------------------------------------------

### 6. CARRIER INTEGRATION ARCHITECTURE

Current system already strong.

Improve by adding:

carrier_api_logs
----------------
carrier_id
request_payload
response_payload
status_code
latency_ms
created_at

You WILL need this for production debugging.

Every logistics company keeps carrier logs.

------------------------------------------------------------

### 7. BACKGROUND JOB SYSTEM (VERY GOOD DESIGN)

Add missing fields:

background_jobs:
- locked_by
- locked_at
- heartbeat_at

Prevents duplicate workers.

Industry pattern = distributed job locking.

------------------------------------------------------------

### 8. INVOICING MUST BE DOUBLE-ENTRY READY

Finance systems must be immutable.

Add:

financial_transactions
----------------------
transaction_id
account_debit
account_credit
amount
reference_type
reference_id

Invoices alone are NOT enough.

------------------------------------------------------------

### 9. REMOVE BUSINESS LOGIC FROM TRIGGERS

Triggers detected:
- volumetric weight
- credential generation
- inventory sync

RULE:

Triggers allowed ONLY for:
- auditing
- derived fields

Move business decisions to services.

Triggers hide logic and break scaling.

------------------------------------------------------------

### 10. ADD SOFT DELETE STANDARD

Add to ALL operational tables:

deleted_at TIMESTAMP NULL

Never hard delete:
- orders
- invoices
- shipments
- returns

Enterprise requirement.

------------------------------------------------------------

### 11. INDEXING STRATEGY (MISSING BUT CRITICAL)

Add composite indexes:

orders(status, created_at)
shipments(status, carrier_id)
inventory(product_id, warehouse_id)
exceptions(priority, status)
notifications(user_id, is_read)

Avoid single-column indexes only.

------------------------------------------------------------

### 12. ENUM TABLES INSTEAD OF TEXT STATUS

Replace text status columns with lookup tables:

order_statuses
shipment_statuses
exception_types
return_statuses

Benefits:
- safer migrations
- reporting consistency
- analytics performance

------------------------------------------------------------

### 13. ADD TIME DIMENSION CONSISTENCY

Every table should contain:

created_at
updated_at
created_by
updated_by

You already partially do this — standardize globally.

------------------------------------------------------------

### 14. ADD DATA PARTITIONING (FUTURE SCALE)

Partition large tables:

shipment_events
notifications
audit_events
job_logs

Partition by month.

Otherwise Postgres slows after ~50M rows.

------------------------------------------------------------

### 15. IDEAL FINAL ARCHITECTURE

Domain separation:

CORE DOMAIN
- orders
- shipments
- inventory
- warehouses
- products

OPERATIONS DOMAIN
- pick_lists
- carrier_assignments
- shipment_events

FINANCE DOMAIN
- invoices
- penalties
- financial_transactions

PLATFORM DOMAIN
- users
- organizations
- audit_events
- notifications
- jobs

INTEGRATION DOMAIN
- webhooks
- carrier_api_logs

------------------------------------------------------------

FINAL VERDICT

Current schema quality:
★★★★☆ (4.5 / 5)

Strengths:
- Excellent service alignment
- Proper separation of concerns
- Real SCM workflow modeling
- Good use of JSONB where appropriate

Main risks:
- inventory correctness
- auditability
- financial tracking
- long-term scaling

After applying recommendations:

→ Enterprise-grade SCM architecture
→ VC / Startup / Production ready
→ Comparable to commercial logistics platforms
