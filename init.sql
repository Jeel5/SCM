-- ================================================================================
-- SCM Database Initialization Script
-- ================================================================================
-- This script creates all tables, indexes, and initial data for the SCM system
-- 
-- WEBHOOK ENHANCEMENTS (for external integrations):
-- - Orders: Added external_order_id, platform, tax_amount, shipping_amount
--   Made order_number nullable for external orders
-- - Inventory: Added sku, product_name, quantity, bin_location for warehouse webhooks
--   Created unique index on (warehouse_id, sku) for upsert operations
-- - Shipments: Added tracking_events JSONB column for carrier tracking updates
-- - Returns: Added external_return_id, customer_name, customer_email, items JSONB
--   Made rma_number nullable for external returns
-- - Order Items: product_id made nullable to support external orders without product mapping
--
-- BACKGROUND JOBS: Includes tables for job queue, execution logs, cron schedules, and DLQ
-- USER SESSIONS: Includes tables for notification preferences and session management
-- ================================================================================

-- Create these tables in order (dependencies matter)

-- 1. Organizations & Users
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'operations_manager', 'warehouse_manager', 'carrier_partner', 'finance', 'customer_support')),
  organization_id UUID REFERENCES organizations(id),
  avatar VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  changes JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User notification preferences
CREATE TABLE user_notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  notification_types JSONB DEFAULT '{"orders": true, "shipments": true, "sla_alerts": true, "exceptions": true, "returns": true, "system_updates": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- User sessions for session management
CREATE TABLE user_sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(500) NOT NULL,
  device_name VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 2. Master Data Management (MDM)
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  address JSONB NOT NULL, -- {street, city, state, postal_code, country, coordinates}
  capacity INTEGER,
  manager_id UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  service_type VARCHAR(50), -- express, standard, bulk
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  website VARCHAR(500),
  reliability_score DECIMAL(3,2) DEFAULT 0.85,
  is_active BOOLEAN DEFAULT true,
  availability_status VARCHAR(20) DEFAULT 'available', -- available, busy, offline
  last_status_change TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id UUID REFERENCES carriers(id),
  origin_state VARCHAR(100),
  destination_state VARCHAR(100),
  service_type VARCHAR(50),
  base_rate DECIMAL(10,2),
  per_kg_rate DECIMAL(10,2),
  fuel_surcharge_pct DECIMAL(5,2),
  effective_from DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  weight DECIMAL(10,2), -- in kg
  dimensions JSONB, -- {length, width, height}
  unit_price DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  service_type VARCHAR(50), -- express, standard, bulk
  origin_region VARCHAR(100),
  destination_region VARCHAR(100),
  delivery_hours INTEGER NOT NULL, -- e.g., 24, 48, 72
  penalty_per_hour DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Inventory & Stock
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES warehouses(id),
  product_id UUID REFERENCES products(id),
  sku VARCHAR(100), -- Added for webhook inventory
  product_name VARCHAR(255), -- Added for webhook inventory
  quantity INTEGER DEFAULT 0, -- Added for webhook inventory
  available_quantity INTEGER DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0,
  damaged_quantity INTEGER DEFAULT 0,
  bin_location VARCHAR(50), -- Added for webhook inventory
  last_stock_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index for warehouse + SKU (for webhook inventory upserts)
CREATE UNIQUE INDEX idx_inventory_warehouse_sku ON inventory(warehouse_id, sku);

CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES warehouses(id),
  product_id UUID REFERENCES products(id),
  movement_type VARCHAR(50), -- inbound, outbound, transfer, adjustment
  quantity INTEGER NOT NULL,
  reference_type VARCHAR(50), -- order, return, adjustment
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE, -- Made nullable for external orders
  external_order_id VARCHAR(100), -- Added for webhook orders
  platform VARCHAR(50), -- Added for webhook orders (amazon, shopify, etc.)
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),
  status VARCHAR(50) DEFAULT 'created', -- created, confirmed, allocated, shipped, delivered, returned, cancelled
  priority VARCHAR(20) DEFAULT 'standard', -- express, standard, bulk
  total_amount DECIMAL(10,2),
  tax_amount DECIMAL(10,2) DEFAULT 0, -- Added for webhook orders
  shipping_amount DECIMAL(10,2) DEFAULT 0, -- Added for webhook orders
  currency VARCHAR(3) DEFAULT 'USD',
  shipping_address JSONB NOT NULL,
  billing_address JSONB,
  estimated_delivery TIMESTAMPTZ,
  actual_delivery TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for webhook orders
CREATE INDEX idx_orders_external_order_id ON orders(external_order_id);
CREATE INDEX idx_orders_platform ON orders(platform);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  sku VARCHAR(100),
  product_name VARCHAR(255),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2),
  weight DECIMAL(10,2),
  warehouse_id UUID REFERENCES warehouses(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Carrier Assignment & Requests
CREATE TABLE carrier_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  carrier_id UUID REFERENCES carriers(id),
  service_type VARCHAR(50), -- express, standard, bulk
  status VARCHAR(50) DEFAULT 'pending', -- pending, assigned, accepted, rejected, busy, expired, cancelled
  pickup_address JSONB,
  delivery_address JSONB,
  estimated_pickup TIMESTAMPTZ,
  estimated_delivery TIMESTAMPTZ,
  special_instructions TEXT,
  request_payload JSONB, -- Full order/item details sent to carrier for review
  acceptance_payload JSONB, -- Carrier response with dispatch info
  carrier_reference_id VARCHAR(100), -- Carrier's internal order/job ID
  rejected_reason TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- Assignment expires if not accepted within 24 hours
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_carrier_assignments_status ON carrier_assignments(status);
CREATE INDEX idx_carrier_assignments_order_id ON carrier_assignments(order_id);
CREATE INDEX idx_carrier_assignments_carrier_id ON carrier_assignments(carrier_id);
CREATE INDEX idx_carrier_assignments_expires_at ON carrier_assignments(expires_at);

-- 5.5. Shipments & Tracking
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number VARCHAR(100) UNIQUE NOT NULL,
  order_id UUID REFERENCES orders(id),
  carrier_assignment_id UUID REFERENCES carrier_assignments(id),
  carrier_id UUID REFERENCES carriers(id),
  warehouse_id UUID REFERENCES warehouses(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, picked_up, in_transit, at_hub, out_for_delivery, delivered, failed_delivery, returned
  origin_address JSONB,
  destination_address JSONB,
  weight DECIMAL(10,2),
  dimensions JSONB, -- {length, width, height}
  shipping_cost DECIMAL(10,2),
  pickup_scheduled TIMESTAMPTZ,
  pickup_actual TIMESTAMPTZ,
  delivery_scheduled TIMESTAMPTZ, -- frontend: estimatedDelivery
  delivery_actual TIMESTAMPTZ, -- frontend: actualDelivery
  current_location JSONB, -- {lat, lng, city, state} from OSRM/carrier data
  route_geometry JSONB, -- GeoJSON LineString from OSRM for Maplibre
  tracking_events JSONB DEFAULT '[]'::jsonb, -- Added for webhook tracking updates
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for tracking events queries
CREATE INDEX idx_shipments_tracking_events ON shipments USING gin(tracking_events);

CREATE TABLE shipment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- picked_up, in_transit, at_hub, out_for_delivery, delivered, exception
  location JSONB,
  description TEXT,
  event_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SLA & Compliance
CREATE TABLE sla_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES shipments(id),
  sla_policy_id UUID REFERENCES sla_policies(id),
  promised_delivery TIMESTAMPTZ,
  actual_delivery TIMESTAMPTZ,
  delay_hours DECIMAL(10,2),
  penalty_amount DECIMAL(10,2),
  reason VARCHAR(255),
  status VARCHAR(50) DEFAULT 'open', -- open, acknowledged, resolved, waived
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Returns & Reverse Logistics
CREATE TABLE returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rma_number VARCHAR(50) UNIQUE, -- Made nullable for external returns
  external_return_id VARCHAR(100), -- Added for webhook returns
  customer_name VARCHAR(255), -- Added for webhook returns
  customer_email VARCHAR(255), -- Added for webhook returns
  order_id UUID REFERENCES orders(id),
  shipment_id UUID REFERENCES shipments(id),
  reason VARCHAR(255),
  status VARCHAR(50) DEFAULT 'requested', -- requested, approved, pickup_scheduled, in_transit, received, inspected, refunded, rejected
  return_shipment_id UUID REFERENCES shipments(id),
  quality_check_result VARCHAR(50), -- passed, failed, damaged
  refund_amount DECIMAL(10,2),
  restocking_fee DECIMAL(10,2),
  items JSONB, -- Added for webhook returns with item details
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for webhook returns
CREATE INDEX idx_returns_external_return_id ON returns(external_return_id);

CREATE TABLE return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID REFERENCES returns(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  reason_detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Exceptions & Incidents
CREATE TABLE exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_type VARCHAR(50), -- delay, damage, lost_shipment, address_issue, carrier_issue
  severity VARCHAR(20), -- low, medium, high, critical
  shipment_id UUID REFERENCES shipments(id),
  order_id UUID REFERENCES orders(id),
  description TEXT,
  status VARCHAR(50) DEFAULT 'open', -- open, investigating, resolved, escalated
  assigned_to UUID REFERENCES users(id),
  resolution VARCHAR(50), -- reship, refund, escalate, none
  resolution_notes TEXT,
  sla_impacted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 9. ETA Predictions & Risk Scoring
CREATE TABLE eta_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES shipments(id),
  predicted_delivery TIMESTAMPTZ,
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  delay_risk_score VARCHAR(20), -- low, medium, high
  factors JSONB, -- {distance, carrier_reliability, warehouse_load, weather, etc}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(50), -- order_update, shipment_update, sla_breach, exception_alert, return_update
  title VARCHAR(255),
  message TEXT,
  link VARCHAR(500),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Background Jobs & Scheduler
CREATE TABLE background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(255) NOT NULL, -- invoice_generation, sla_check, report_generation, etc.
  priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
  status VARCHAR(100) DEFAULT 'pending', -- pending, running, completed, failed, retrying
  payload JSONB, -- Job parameters
  result JSONB, -- Job output
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job execution logs
CREATE TABLE job_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES background_jobs(id) ON DELETE CASCADE,
  attempt_number INTEGER,
  status VARCHAR(50), -- started, completed, failed
  error_message TEXT,
  execution_time_ms INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Cron schedules for recurring jobs
CREATE TABLE cron_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  job_type VARCHAR(100) NOT NULL,
  cron_expression VARCHAR(100) NOT NULL, -- e.g., '0 0 * * *' for daily at midnight
  payload JSONB,
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Financials
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  carrier_id UUID REFERENCES carriers(id),
  billing_period_start DATE,
  billing_period_end DATE,
  total_shipments INTEGER,
  base_amount DECIMAL(10,2),
  penalties DECIMAL(10,2),
  adjustments DECIMAL(10,2),
  final_amount DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, paid, disputed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Dead Letter Queue for Failed Jobs
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_job_id UUID NOT NULL,
  job_type VARCHAR(100) NOT NULL,
  payload JSONB,
  priority INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  moved_to_dlq_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Alert Rules and Alerts
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(100) NOT NULL,
  severity VARCHAR(50) NOT NULL DEFAULT 'medium',
  message_template TEXT NOT NULL,
  threshold INTEGER,
  conditions JSONB,
  assigned_users UUID[],
  assigned_roles VARCHAR(50)[],
  escalation_enabled BOOLEAN DEFAULT false,
  escalation_delay_minutes INTEGER DEFAULT 15,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES alert_rules(id),
  rule_name VARCHAR(255),
  alert_type VARCHAR(100),
  severity VARCHAR(50),
  message TEXT,
  data JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  resolution TEXT
);

-- 15. User Settings
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_preferences JSONB DEFAULT '{}',
  ui_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_carrier ON shipments(carrier_id);
CREATE INDEX idx_inventory_warehouse ON inventory(warehouse_id);
CREATE INDEX idx_sla_violations_status ON sla_violations(status);
CREATE INDEX idx_exceptions_status ON exceptions(status);
CREATE INDEX idx_user_preferences_user_id ON user_notification_preferences(user_id);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_active ON user_sessions(user_id, is_active);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_background_jobs_status ON background_jobs(status);
CREATE INDEX idx_background_jobs_priority ON background_jobs(priority, scheduled_for);
CREATE INDEX idx_background_jobs_type ON background_jobs(job_type);
CREATE INDEX idx_job_execution_logs_job_id ON job_execution_logs(job_id);
CREATE INDEX idx_cron_schedules_active ON cron_schedules(is_active, next_run_at);

-- Additional Indexes for Performance
CREATE INDEX idx_sla_violations_violated_at ON sla_violations(violated_at);
CREATE INDEX idx_sla_violations_resolved_at ON sla_violations(resolved_at);
CREATE INDEX idx_exceptions_priority ON exceptions(priority, status);
CREATE INDEX idx_exceptions_escalation ON exceptions(escalation_level);

-- Dead Letter Queue Indexes
CREATE INDEX idx_dead_letter_queue_job_type ON dead_letter_queue(job_type);
CREATE INDEX idx_dead_letter_queue_created_at ON dead_letter_queue(created_at);

-- Alert System Indexes
CREATE INDEX idx_alert_rules_active ON alert_rules(is_active);
CREATE INDEX idx_alert_rules_type ON alert_rules(rule_type);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_triggered_at ON alerts(triggered_at);
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

BEGIN;

-- Users (admin, ops, warehouse, carrier, finance, support)
INSERT INTO users (email, password_hash, name, role, organization_id, avatar, is_active)
SELECT * FROM (VALUES
  ('admin@logitower.com','$2b$10$demoHashedPassword','John Admin','admin', (SELECT id FROM organizations WHERE code='DEMO001'),'https://api.dicebear.com/7.x/avataaars/svg?seed=John',true),
  ('ops@logitower.com','$2b$10$demoHashedPassword','Sarah Operations','operations_manager', (SELECT id FROM organizations WHERE code='DEMO001'),'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',true),
  ('wh1@logitower.com','$2b$10$demoHashedPassword','Luis Warehouse','warehouse_manager', (SELECT id FROM organizations WHERE code='DEMO001'),NULL,true),
  ('wh2@logitower.com','$2b$10$demoHashedPassword','Priya Warehouse','warehouse_manager', (SELECT id FROM organizations WHERE code='DEMO001'),NULL,true),
  ('carrier@logitower.com','$2b$10$demoHashedPassword','DHL Partner','carrier_partner', (SELECT id FROM organizations WHERE code='DEMO001'),NULL,true),
  ('finance@logitower.com','$2b$10$demoHashedPassword','Alice Finance','finance', (SELECT id FROM organizations WHERE code='DEMO001'),NULL,true),
  ('support@logitower.com','$2b$10$demoHashedPassword','Bob Support','customer_support', (SELECT id FROM organizations WHERE code='DEMO001'),NULL,true),
  ('admin@acme.com','$2b$10$demoHashedPassword','Acme Admin','admin', (SELECT id FROM organizations WHERE code='ACME001'),NULL,true)
) AS v(email, password_hash, name, role, organization_id, avatar, is_active)
ON CONFLICT (email) DO NOTHING;

COMMIT;