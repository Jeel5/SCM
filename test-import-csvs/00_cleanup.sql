-- ============================================================
-- CLEANUP SCRIPT — wipes all operational data for org Croma
-- Preserves: admin@croma.com, superadmin@twinchain.com, Croma org
-- Run: PGPASSWORD='...' psql -h localhost -U postgres -d scm_db -f 00_cleanup.sql
-- ============================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE 'Starting cleanup...'; END $$;

-- Analytics
DELETE FROM analytics_daily_stats              WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';
DELETE FROM analytics_daily_carrier_stats      WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';
DELETE FROM analytics_daily_warehouse_activity WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';

-- Audit / notifications / alerts
DELETE FROM audit_logs              WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';
DELETE FROM organization_audit_logs WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';
DELETE FROM notifications           WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';
DELETE FROM alerts                  WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';

-- Jobs
DELETE FROM background_jobs  WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';
DELETE FROM cron_schedules   WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';

-- SLA
DELETE FROM sla_violations WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';
DELETE FROM sla_policies   WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';

-- Shipment dependencies
DELETE FROM eta_predictions
  WHERE shipment_id IN (SELECT id FROM shipments WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb');
DELETE FROM shipment_events
  WHERE shipment_id IN (SELECT id FROM shipments WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb');
-- carrier_assignments has organization_id directly
DELETE FROM carrier_assignments WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';
-- carrier_rejections links via order_id
DELETE FROM carrier_rejections
  WHERE order_id IN (SELECT id FROM orders WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb');

-- Return dependencies
DELETE FROM return_items
  WHERE return_id IN (SELECT id FROM returns WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb');

-- Invoice dependencies
DELETE FROM invoice_line_items
  WHERE invoice_id IN (SELECT id FROM invoices WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb');

-- Restock dependencies
DELETE FROM restock_order_items
  WHERE restock_order_id IN (SELECT id FROM restock_orders WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb');

-- Order dependencies
DELETE FROM allocation_history
  WHERE order_id IN (SELECT id FROM orders WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb');
DELETE FROM exceptions    WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';
DELETE FROM carrier_quotes WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';

-- Main transactional tables
DELETE FROM returns         WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';
DELETE FROM shipments       WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';
DELETE FROM invoices        WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';
DELETE FROM restock_orders  WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';
DELETE FROM order_items
  WHERE order_id IN (SELECT id FROM orders WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb');
DELETE FROM orders          WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';

-- Inventory
DELETE FROM stock_movements
  WHERE warehouse_id IN (SELECT id FROM warehouses WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb');
DELETE FROM inventory       WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';

-- Products
DELETE FROM products        WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';

-- Master / reference data
DELETE FROM carrier_performance_metrics WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';
-- rate_cards links via carrier_id (no org_id) — delete refs to this org's carriers
DELETE FROM rate_cards
  WHERE carrier_id IN (SELECT id FROM carriers WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb');
DELETE FROM warehouses      WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';
DELETE FROM carriers        WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';
DELETE FROM suppliers       WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';
DELETE FROM sales_channels  WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb';

-- Extra users (keep admin only)
DELETE FROM user_sessions
  WHERE user_id IN (SELECT id FROM users WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb' AND role != 'admin');
DELETE FROM user_notification_preferences
  WHERE user_id IN (SELECT id FROM users WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb' AND role != 'admin');
DELETE FROM user_settings
  WHERE user_id IN (SELECT id FROM users WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb' AND role != 'admin');
DELETE FROM users
  WHERE organization_id = '14a71c77-c3f4-442a-8a11-851e402bf4eb' AND role != 'admin';

-- Global housekeeping
DELETE FROM quote_idempotency_cache;
DELETE FROM revoked_tokens    WHERE expires_at < NOW();
TRUNCATE dead_letter_queue;

COMMIT;

DO $$ BEGIN RAISE NOTICE 'Cleanup complete. Users and org preserved.'; END $$;
