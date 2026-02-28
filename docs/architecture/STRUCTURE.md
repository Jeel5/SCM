You are assisting development of a large-scale **Supply Chain Management (SCM) Platform**.

IMPORTANT: This project is NOT a simple Express CRUD app.
It follows a **Domain Modular Architecture** designed for enterprise scalability.

---

## ARCHITECTURE PRINCIPLES

1. Domain-Based Structure (NOT Layer-Based)

All features must be organized by BUSINESS DOMAIN, not by technical layer.

❌ DO NOT create global folders like:

* controllers/
* services/
* repositories/
* routes/

✅ Instead, each domain owns everything related to it.

Example:

modules/
orders/
order.controller.js
order.service.js
order.repository.js
order.routes.js
order.validator.js

Each module is self-contained.

---

2. High-Level Folder Structure

---

backend/
app/                  -> Express bootstrap & route registration
modules/              -> Business domains
platform/             -> Cross-cutting system capabilities
infrastructure/       -> External integrations
shared/               -> reusable utilities
migrations/           -> database schema

---

3. MODULE RESPONSIBILITIES

---

Create or modify code ONLY inside the correct module.

Current domains include:

* orders
* inventory
* warehouse
* shipments
* carriers
* returns
* finance (invoices, billing)
* sla (monitoring & violations)
* notifications
* organizations (multi-tenant)
* users & settings

Each module contains:

* controller (HTTP handling)
* service (business logic)
* repository (database access)
* routes
* validators
* domain logic

Never mix responsibilities across modules.

---

4. PLATFORM LAYER (Cross-Cutting Concerns)

---

platform/
auth/           -> authentication
rbac/           -> permissions
database/       -> db connection & transactions
jobs/           -> background workers & cron
errors/         -> error classes & handler
middleware/     -> express middleware
logging/

These are framework-level capabilities.
Business logic must NOT be placed here.

---

5. INFRASTRUCTURE LAYER

---

Used only for external systems:

Examples:

* OSRM routing
* Carrier APIs
* Email/SMS providers
* Webhooks
* Queues

Rule:
Infrastructure NEVER contains business rules.

---

6. SERVICE DESIGN RULES

---

Services:

* orchestrate workflows
* contain business logic
* may call multiple repositories
* may call infrastructure adapters

Repositories:

* ONLY database access
* NO business decisions

Controllers:

* request validation
* call service
* return response

---

7. CODING EXPECTATIONS

---

When generating code:

* Follow existing naming conventions
* Keep modules isolated
* Prefer composition over shared global utilities
* Avoid circular dependencies
* Do not introduce new global folders
* Reuse shared utilities if available
* Keep transactions inside services
* External API calls happen outside DB transactions

---

8. SYSTEM CONTEXT

---

This platform includes:

* Order Management System (OMS)
* Warehouse Execution (WES)
* Transportation Management (TMS)
* SLA Monitoring & Exception Management
* Carrier Integration Platform
* Automated Billing & Invoicing
* Background Job Processing
* Multi-tenant Organizations
* Real-time Shipment Tracking

Design all solutions assuming enterprise scale.

---

9. WHEN ADDING NEW FEATURES

---

Always:

1. Identify correct domain module.
2. Add files inside that module.
3. Avoid creating cross-module coupling.
4. Keep business logic inside services.
5. Keep infrastructure isolated.

---

10. THINK LIKE A SENIOR BACKEND ARCHITECT

---

Prioritize:

* maintainability
* scalability
* domain ownership
* clear boundaries
* production readiness

Never design features like a small tutorial project.
This is an enterprise logistics platform.

---

## END OF ARCHITECTURE CONTEXT
