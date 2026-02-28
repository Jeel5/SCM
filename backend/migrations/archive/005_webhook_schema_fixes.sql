-- Migration: Add missing columns for webhook processing
-- Date: 2026-01-30
-- Description: Adds columns required by webhook handlers for orders, inventory, and shipments

-- 1. Add columns to orders table for external order processing
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS external_order_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS platform VARCHAR(50), -- amazon, shopify, etc
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_amount DECIMAL(10,2) DEFAULT 0;

-- Make order_number nullable since external orders use external_order_id
ALTER TABLE orders ALTER COLUMN order_number DROP NOT NULL;

-- Create index for external order lookups
CREATE INDEX IF NOT EXISTS idx_orders_external_order_id ON orders(external_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_platform ON orders(platform);

-- 2. Add columns to inventory table for webhook sync
ALTER TABLE inventory 
  ADD COLUMN IF NOT EXISTS sku VARCHAR(100),
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bin_location VARCHAR(50);

-- Drop the conditional unique index if it exists
DROP INDEX IF EXISTS idx_inventory_warehouse_sku;

-- Create unique constraint on warehouse + sku (without WHERE clause to match ON CONFLICT)
CREATE UNIQUE INDEX idx_inventory_warehouse_sku ON inventory(warehouse_id, sku);

-- 3. Add tracking_events column to shipments table for event history
ALTER TABLE shipments 
  ADD COLUMN IF NOT EXISTS tracking_events JSONB DEFAULT '[]'::jsonb;

-- Create index for tracking event queries
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_events ON shipments USING gin(tracking_events);

-- 4. Update order_items to support SKU-only items (no product_id required)
ALTER TABLE order_items 
  ALTER COLUMN product_id DROP NOT NULL;

-- 5. Add external_return_id to returns table for webhook processing
ALTER TABLE returns 
  ADD COLUMN IF NOT EXISTS external_return_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS items JSONB;

-- Make rma_number nullable since external returns use external_return_id
ALTER TABLE returns ALTER COLUMN rma_number DROP NOT NULL;

-- Create index for external return lookups
CREATE INDEX IF NOT EXISTS idx_returns_external_return_id ON returns(external_return_id);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 005_webhook_schema_fixes.sql completed successfully';
  RAISE NOTICE '   - Added external_order_id, platform, tax_amount, shipping_amount to orders';
  RAISE NOTICE '   - Made order_number nullable for external orders';
  RAISE NOTICE '   - Added sku, product_name, quantity, bin_location to inventory';
  RAISE NOTICE '   - Added tracking_events JSONB column to shipments';
  RAISE NOTICE '   - Updated order_items to allow NULL product_id';
  RAISE NOTICE '   - Added external_return_id, customer_name, customer_email, items to returns';
  RAISE NOTICE '   - Made rma_number nullable for external returns';
END $$;
