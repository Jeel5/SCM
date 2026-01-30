-- Migration: 007_add_carrier_assignments_table.sql
-- Adds carrier assignment request/approval workflow system

BEGIN;

-- Create carrier_assignments table
CREATE TABLE IF NOT EXISTS carrier_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  carrier_id UUID REFERENCES carriers(id),
  service_type VARCHAR(50), -- express, standard, bulk
  status VARCHAR(50) DEFAULT 'pending', -- pending, assigned, accepted, rejected, cancelled
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

-- Create indexes for carrier_assignments
CREATE INDEX IF NOT EXISTS idx_carrier_assignments_status ON carrier_assignments(status);
CREATE INDEX IF NOT EXISTS idx_carrier_assignments_order_id ON carrier_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_carrier_assignments_carrier_id ON carrier_assignments(carrier_id);
CREATE INDEX IF NOT EXISTS idx_carrier_assignments_expires_at ON carrier_assignments(expires_at);

-- Add carrier_assignment_id to shipments table if not exists
ALTER TABLE shipments 
  ADD COLUMN IF NOT EXISTS carrier_assignment_id UUID REFERENCES carrier_assignments(id);

-- Add route_geometry to shipments for Maplibre visualization
ALTER TABLE shipments 
  ADD COLUMN IF NOT EXISTS route_geometry JSONB;

-- Create index for route_geometry queries
CREATE INDEX IF NOT EXISTS idx_shipments_route_geometry ON shipments USING gin(route_geometry);

COMMIT;
