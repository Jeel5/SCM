════════════════════════════════════════════════════════════════════
SCM PROJECT — OPTIONAL FUTURE IMPROVEMENTS
Out of scope for current project. None of these block MVP.
Reference only — build after the project is complete and stable.
════════════════════════════════════════════════════════════════════


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. PERFORMANCE & CACHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Redis caching layer
    - Cache warehouse lookups (CarrierPayloadBuilder warehouse DB query per assignment)
    - Cache dashboard stats (invalidate on mutation)
    - Cache org permissions / RBAC resolution per user
    - Session store (move user_sessions from Postgres to Redis)

  Database read replicas
    - Route analytics and reporting queries to read replica
    - Keep all writes on primary

  Materialized views / pre-aggregated metrics
    - system_metrics_hourly for alert rule evaluation (avoids OLTP scan)
    - warehouse_metrics rolling average (on-time rate, avg delivery days)
    - carrier_performance table updated nightly (replaces hardcoded reliability map)
    - Pre-computed dashboard summary table (invalidated by background job)

  Query optimization
    - Full-text search with tsvector/GIN for order/shipment search
    - Elasticsearch integration for advanced search across all entities
    - Partition large tables (shipment_events, audit_logs) by month


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. ADVANCED ANALYTICS & INTELLIGENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Predictive analytics
    - ML-based demand forecasting (predict reorder timing per SKU)
    - ETA prediction improvement (replace OSRM estimate with ML model)
    - Carrier delay prediction (based on historical performance + weather/events)
    - Exception risk scoring (flag orders likely to hit exceptions before they do)

  Advanced reporting
    - Custom report builder (drag-and-drop columns, filters, grouping)
    - Scheduled report delivery (send PDF/CSV to stakeholders on schedule)
    - PDF/Excel export for all list views
    - Operational intelligence dashboard (Datadog-style KPI monitoring)

  BI integration
    - Metabase / Superset connector
    - API for BI tools to query aggregated data warehouse


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. ARCHITECTURE EVOLUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Event-driven architecture
    - Replace cron-based alert evaluation with domain event triggers
      (shipment_delayed event → alert evaluation, not cron → DB scan)
    - Internal event bus (EventEmitter or Kafka/RabbitMQ for scale)
    - Domain events: order.created, inventory.updated, shipment.status_changed,
      sla.violated, exception.created, return.received
    - Event sourcing for audit trail (all state changes are events)

  Microservices extraction (when individual services need independent scaling)
    - shipping-service (carrier quotes + validation + selection)
    - notification-service (email/SMS/push — already near-independent)
    - analytics-service (reporting and aggregation only)
    - identity-service (auth + org management only)
    Note: Do NOT extract until all org isolation bugs are fixed in monolith first

  API evolution
    - API versioning (/api/v1/, /api/v2/) with version deprecation headers
    - GraphQL gateway for flexible frontend queries
    - gRPC for internal service-to-service communication
    - Public API with API keys for third-party integrations


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. IDENTITY & ACCESS MANAGEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  SSO / Enterprise identity
    - SAML 2.0 integration (Okta, Azure AD, Google Workspace)
    - OAuth 2.0 / OpenID Connect provider
    - SCIM user provisioning (auto-sync users from enterprise IdP)

  Advanced auth features
    - Two-factor authentication (TOTP / authenticator app)
    - Passkey / FIDO2 support
    - IP allowlisting per organization
    - Device fingerprinting and trust management
    - Suspicious login detection

  Service-to-service auth
    - M2M (machine-to-machine) tokens for internal services
    - Partner / affiliate API keys with scoped permissions
    - Carrier API credential rotation automation


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. MULTI-TENANCY EVOLUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Organization lifecycle management
    - Status machine: trial → active → suspended → cancelled → archived
    - Auto-suspend on non-payment (SaaS billing integration)
    - Trial period limits and feature gating per plan

  Tenant isolation upgrade
    - PostgreSQL Row Level Security (RLS) as defense-in-depth layer
      (second layer after application org filter bugs are all fixed)
    - Per-tenant DB schemas for highest isolation (enterprise tier)

  SaaS billing
    - Stripe integration for subscription management
    - Usage-based billing (per shipment, per API call, per user seat)
    - Invoice generation for SaaS subscriptions (separate from SCM invoices)
    - Dunning management (payment failure handling)
    - Plan tiers: Starter / Growth / Enterprise with feature flags


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. CARRIER & LOGISTICS INTELLIGENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Carrier marketplace
    - Uber Freight-style bidding (carriers compete on each shipment)
    - Dynamic pricing engine (demand-aware rate adjustment)
    - Carrier rating and feedback system

  Advanced allocation
    - 3D bin packing algorithm (replace linear height stacking)
    - Customer promise date constraints (same-day cutoff times)
    - Regional tax optimization routing
    - Warehouse blackout / maintenance window aware routing
    - Hazardous goods / cold chain routing rules

  Real-time carrier data
    - Carrier capacity feeds (live slot availability)
    - Network disruption alerts (weather, port closures, strikes)
    - Route optimization with live traffic (Google Maps Platform / HERE)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. DEVOPS & INFRASTRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  CI/CD pipeline
    - GitHub Actions: test → lint → build → deploy on every merge
    - Automated database migration runner in pipeline
    - Blue/green deployment strategy
    - Rollback automation on health check failure

  Container orchestration
    - Kubernetes manifests (Deployment, Service, Ingress, HPA)
    - Helm charts for environment-specific config
    - Auto-scaling based on queue depth (jobs backlog)

  Observability stack
    - Distributed tracing (OpenTelemetry + Jaeger / Datadog)
    - Structured log aggregation (ELK stack / Grafana Loki)
    - Metrics and dashboards (Prometheus + Grafana)
    - Alerting on infra metrics (CPU, memory, DB connections, queue depth)
    - Synthetic monitoring (uptime checks on critical endpoints)

  Multi-region / disaster recovery
    - Active-active multi-region Postgres (Citus / Cloud SQL replicas)
    - CDN for static assets (frontend)
    - Cross-region failover with <15min RTO
    - Automated backup + point-in-time restore testing


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. MOBILE & FRONTEND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Progressive Web App (PWA)
    - Offline support for warehouse scanning workflows
    - Push notifications (service worker)
    - Add to homescreen support

  Mobile app
    - React Native or Flutter app for warehouse operations
    - Barcode/QR scanner for pick-pack-ship workflows
    - Carrier driver app (accept pickup, confirm delivery, capture signature/photo)

  Advanced UI features
    - Drag-and-drop order prioritization
    - Kanban board for exception management
    - Map view for shipment tracking (Mapbox / Google Maps)
    - Real-time collaborative alerts (multiple ops users see same incident)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. COMPLIANCE & SECURITY HARDENING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Regulatory compliance
    - GDPR data export and right-to-erasure flows
    - SOC 2 Type II audit readiness
    - PCI DSS compliance (if payment data stored directly)
    - DPDP Act compliance for Indian operations

  Security hardening
    - IP rate limiting on all authentication endpoints
    - Account lockout after N failed login attempts
    - Password history enforcement (prevent reuse of last 5)
    - Vulnerability scanning in CI (Snyk / Trivy)
    - Penetration testing (annual external assessment)
    - WAF (Web Application Firewall) in front of API


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. DEVELOPER EXPERIENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  API documentation
    - OpenAPI / Swagger spec generated from code
    - Interactive API explorer (Swagger UI / Redoc)
    - Postman collection auto-generation

  SDK / client libraries
    - TypeScript SDK for frontend (auto-generated from OpenAPI spec)
    - Webhook SDK for integration partners

  Developer portal
    - Self-service API key creation for integration partners
    - Sandbox environment with mock carrier responses
    - Webhook testing tool (ngrok-style tunnel for local development)
