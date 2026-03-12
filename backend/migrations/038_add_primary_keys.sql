-- Migration 038: Add PRIMARY KEY constraints to all tables
--
-- Root cause: every table was created with CHECK (id IS NOT NULL) instead of
-- PRIMARY KEY. Without a declared PRIMARY KEY, PostgreSQL cannot infer that
-- all other columns are functionally dependent on id, so any query that does
-- SELECT t.* ... GROUP BY t.id fails with:
--   "column must appear in the GROUP BY clause or be used in an aggregate function"
--
-- Adding PRIMARY KEY on id:
--   1. Fixes GROUP BY functional-dependency inference (the immediate 500 error)
--   2. Creates an implicit unique B-tree index on id (faster lookups)
--   3. Foreign key references to these tables become properly enforced

ALTER TABLE organizations              ADD PRIMARY KEY (id);
ALTER TABLE users                      ADD PRIMARY KEY (id);
ALTER TABLE warehouses                 ADD PRIMARY KEY (id);
ALTER TABLE carriers                   ADD PRIMARY KEY (id);
ALTER TABLE products                   ADD PRIMARY KEY (id);
ALTER TABLE inventory                  ADD PRIMARY KEY (id);
ALTER TABLE orders                     ADD PRIMARY KEY (id);
ALTER TABLE order_items                ADD PRIMARY KEY (id);
ALTER TABLE order_splits               ADD PRIMARY KEY (id);
ALTER TABLE shipments                  ADD PRIMARY KEY (id);
ALTER TABLE shipment_events            ADD PRIMARY KEY (id);
ALTER TABLE returns                    ADD PRIMARY KEY (id);
ALTER TABLE return_items               ADD PRIMARY KEY (id);
ALTER TABLE carrier_assignments        ADD PRIMARY KEY (id);
ALTER TABLE carrier_quotes             ADD PRIMARY KEY (id);
ALTER TABLE carrier_rejections         ADD PRIMARY KEY (id);
ALTER TABLE carrier_capacity_log       ADD PRIMARY KEY (id);
ALTER TABLE carrier_performance_metrics ADD PRIMARY KEY (id);
ALTER TABLE rate_cards                 ADD PRIMARY KEY (id);
ALTER TABLE invoices                   ADD PRIMARY KEY (id);
ALTER TABLE invoice_line_items         ADD PRIMARY KEY (id);
ALTER TABLE sla_policies               ADD PRIMARY KEY (id);
ALTER TABLE sla_violations             ADD PRIMARY KEY (id);
ALTER TABLE exceptions                 ADD PRIMARY KEY (id);
ALTER TABLE alerts                     ADD PRIMARY KEY (id);
ALTER TABLE alert_rules                ADD PRIMARY KEY (id);
ALTER TABLE notifications              ADD PRIMARY KEY (id);
ALTER TABLE user_notification_preferences ADD PRIMARY KEY (id);
ALTER TABLE user_permissions           ADD PRIMARY KEY (id);
ALTER TABLE user_sessions              ADD PRIMARY KEY (id);
ALTER TABLE user_settings              ADD PRIMARY KEY (id);
ALTER TABLE audit_logs                 ADD PRIMARY KEY (id);
ALTER TABLE background_jobs            ADD PRIMARY KEY (id);
ALTER TABLE job_execution_logs         ADD PRIMARY KEY (id);
ALTER TABLE cron_schedules             ADD PRIMARY KEY (id);
ALTER TABLE dead_letter_queue          ADD PRIMARY KEY (id);
ALTER TABLE stock_movements            ADD PRIMARY KEY (id);
ALTER TABLE pick_lists                 ADD PRIMARY KEY (id);
ALTER TABLE pick_list_items            ADD PRIMARY KEY (id);
ALTER TABLE allocation_history         ADD PRIMARY KEY (id);
ALTER TABLE allocation_rules           ADD PRIMARY KEY (id);
ALTER TABLE eta_predictions            ADD PRIMARY KEY (id);
ALTER TABLE shipping_estimates         ADD PRIMARY KEY (id);
ALTER TABLE postal_zones               ADD PRIMARY KEY (id);
ALTER TABLE zone_distances             ADD PRIMARY KEY (id);
ALTER TABLE sales_channels             ADD PRIMARY KEY (id);
ALTER TABLE suppliers                  ADD PRIMARY KEY (id);
ALTER TABLE revoked_tokens             ADD PRIMARY KEY (id);
ALTER TABLE webhook_logs               ADD PRIMARY KEY (id);

-- quote_idempotency_cache uses idempotency_key as its natural PK (no id column)
ALTER TABLE quote_idempotency_cache    ADD PRIMARY KEY (idempotency_key);
