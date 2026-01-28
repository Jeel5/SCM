-- Database schema enhancements for advanced features
-- Run this file to add missing columns and tables for new functionality

-- ============================================================
-- 1. PICK, PACK, SHIP WORKFLOW
-- ============================================================

-- Add workflow tracking columns to order_items
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS pick_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS picked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS picked_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS pack_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS packed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS packed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS ship_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;

-- Create pick lists table
CREATE TABLE IF NOT EXISTS pick_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_list_number VARCHAR(50) UNIQUE NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id),
  assigned_to UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  priority INTEGER DEFAULT 5,
  total_items INTEGER DEFAULT 0,
  picked_items INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pick_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_list_id UUID REFERENCES pick_lists(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id),
  product_id UUID REFERENCES products(id),
  quantity_required INTEGER NOT NULL,
  quantity_picked INTEGER DEFAULT 0,
  location VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending', -- pending, picked, short_picked
  picked_at TIMESTAMPTZ
);

-- ============================================================
-- 2. RETURNS ENHANCEMENTS (Pickup Scheduling & RMA)
-- ============================================================

-- Add pickup scheduling fields to returns
ALTER TABLE returns 
ADD COLUMN IF NOT EXISTS pickup_scheduled_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pickup_time_slot VARCHAR(50),
ADD COLUMN IF NOT EXISTS pickup_address JSONB,
ADD COLUMN IF NOT EXISTS pickup_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS inspection_notes TEXT,
ADD COLUMN IF NOT EXISTS refund_initiated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refund_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refund_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS refund_reference VARCHAR(100);

-- ============================================================
-- 3. EXCEPTION ENHANCEMENTS (Priority & Escalation)
-- ============================================================

-- Add priority and escalation fields to exceptions
ALTER TABLE exceptions 
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0, -- 0=none, 1=L1, 2=L2, 3=L3
ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS escalated_to UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS root_cause VARCHAR(100),
ADD COLUMN IF NOT EXISTS impact_assessment TEXT,
ADD COLUMN IF NOT EXISTS estimated_resolution_time TIMESTAMPTZ;

-- ============================================================
-- 4. SLA ENHANCEMENTS (Automated Detection & Penalties)
-- ============================================================

-- Add detection and penalty fields to sla_violations
ALTER TABLE sla_violations 
ADD COLUMN IF NOT EXISTS violated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS detection_method VARCHAR(50) DEFAULT 'automated',
ADD COLUMN IF NOT EXISTS penalty_calculated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS penalty_approved_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS penalty_applied BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS waiver_reason TEXT;

-- ============================================================
-- 5. ORDER SPLITTING (Multi-Warehouse Fulfillment)
-- ============================================================

-- Add parent order tracking for splits
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS parent_order_id UUID REFERENCES orders(id),
ADD COLUMN IF NOT EXISTS is_split BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS split_reason VARCHAR(255);

-- Create order splits tracking table
CREATE TABLE IF NOT EXISTS order_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_order_id UUID REFERENCES orders(id),
  child_order_id UUID REFERENCES orders(id),
  warehouse_id UUID REFERENCES warehouses(id),
  split_reason VARCHAR(255),
  items_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_order_id, child_order_id)
);

-- ============================================================
-- 6. INVENTORY ALLOCATION RULES
-- ============================================================

-- Create allocation rules table
CREATE TABLE IF NOT EXISTS allocation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  priority INTEGER DEFAULT 5,
  strategy VARCHAR(50) NOT NULL, -- proximity, cost, sla, stock_level, round_robin
  conditions JSONB, -- {min_priority: 'express', regions: ['CA', 'NY']}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create allocation history for audit
CREATE TABLE IF NOT EXISTS allocation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  order_item_id UUID REFERENCES order_items(id),
  warehouse_id UUID REFERENCES warehouses(id),
  allocation_strategy VARCHAR(50),
  allocation_score DECIMAL(10,2),
  allocated_quantity INTEGER,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. AUTOMATED INVOICE GENERATION
-- ============================================================

-- Add automation fields to invoices
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS generation_job_id UUID,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS payment_due_date DATE,
ADD COLUMN IF NOT EXISTS payment_received_date DATE,
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

-- Create invoice line items table
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  shipment_id UUID REFERENCES shipments(id),
  description TEXT,
  item_type VARCHAR(50), -- shipping_fee, penalty, adjustment, fuel_surcharge
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2),
  amount DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. PERFORMANCE SCORING
-- ============================================================

-- Create carrier performance metrics table
CREATE TABLE IF NOT EXISTS carrier_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id UUID REFERENCES carriers(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_shipments INTEGER DEFAULT 0,
  on_time_deliveries INTEGER DEFAULT 0,
  late_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0,
  sla_violations INTEGER DEFAULT 0,
  total_penalties DECIMAL(10,2) DEFAULT 0,
  performance_score DECIMAL(5,2), -- 0-100
  reliability_score DECIMAL(3,2), -- 0.00-1.00
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(carrier_id, period_start, period_end)
);

-- ============================================================
-- INDEXES FOR NEW TABLES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_pick_lists_warehouse ON pick_lists(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_pick_lists_status ON pick_lists(status);
CREATE INDEX IF NOT EXISTS idx_pick_list_items_picklist ON pick_list_items(pick_list_id);
CREATE INDEX IF NOT EXISTS idx_order_splits_parent ON order_splits(parent_order_id);
CREATE INDEX IF NOT EXISTS idx_order_splits_child ON order_splits(child_order_id);
CREATE INDEX IF NOT EXISTS idx_allocation_history_order ON allocation_history(order_id);
CREATE INDEX IF NOT EXISTS idx_allocation_history_warehouse ON allocation_history(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_carrier_performance_carrier ON carrier_performance_metrics(carrier_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_priority ON exceptions(priority, status);
CREATE INDEX IF NOT EXISTS idx_exceptions_escalation ON exceptions(escalation_level);
CREATE INDEX IF NOT EXISTS idx_sla_violations_violated_at ON sla_violations(violated_at);
CREATE INDEX IF NOT EXISTS idx_sla_violations_resolved_at ON sla_violations(resolved_at);

-- ============================================================
-- INSERT DEFAULT ALLOCATION RULES
-- ============================================================

INSERT INTO allocation_rules (name, priority, strategy, conditions, is_active) VALUES
  ('Express Orders - Proximity First', 1, 'proximity', '{"min_priority": "express"}', true),
  ('Standard Orders - Cost Optimization', 2, 'cost', '{"min_priority": "standard"}', true),
  ('Bulk Orders - Stock Level', 3, 'stock_level', '{"min_priority": "bulk"}', true),
  ('Default Round Robin', 10, 'round_robin', '{}', true)
ON CONFLICT DO NOTHING;

-- Success message
SELECT '✅ All schema changes applied successfully!' as status;
