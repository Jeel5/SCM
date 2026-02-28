-- Migration 012: Cleanup Orders Table
-- Remove unnecessary columns and add supplier support for inbound orders
-- Date: 2026-02-18

BEGIN;

-- 1. Remove platform column (SCM is not a multi-platform marketplace)
ALTER TABLE orders DROP COLUMN IF EXISTS platform;

-- 2. Remove customer_id column (e-commerce platform manages customers, we only need name/contact)
ALTER TABLE orders DROP COLUMN IF EXISTS customer_id;

-- 3. Add supplier_id for inbound/purchase orders (warehouse restocking)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES organizations(id);

-- 4. Add supplier_name for denormalization (faster queries, avoid joins)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255);

-- 5. Update order_type constraint to support sales/purchase/transfer
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_type_check 
  CHECK (order_type IN ('sales', 'purchase', 'transfer', 'regular', 'replacement', 'cod'));

-- 6. Add index on supplier_id for inbound order queries
CREATE INDEX IF NOT EXISTS idx_orders_supplier_id ON orders(supplier_id) WHERE supplier_id IS NOT NULL;

-- 7. Add index on order_type for filtering
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);

-- 8. Add comments for clarity
COMMENT ON COLUMN orders.external_order_id IS 'Reference ID from external system: E-commerce order ID for sales orders, PO number for purchase orders';
COMMENT ON COLUMN orders.order_type IS 'Type of order: sales (outbound to customers), purchase (inbound from suppliers), transfer (between warehouses)';
COMMENT ON COLUMN orders.supplier_id IS 'Reference to supplier organization for purchase/inbound orders (NULL for sales orders)';
COMMENT ON COLUMN orders.supplier_name IS 'Supplier name for inbound orders (denormalized for performance)';
COMMENT ON COLUMN orders.customer_name IS 'Customer name for sales orders, or receiving warehouse for transfer orders';

COMMIT;

-- Rollback script (if needed):
-- BEGIN;
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform VARCHAR(50);
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id VARCHAR(100);
-- ALTER TABLE orders DROP COLUMN IF EXISTS supplier_id;
-- ALTER TABLE orders DROP COLUMN IF EXISTS supplier_name;
-- DROP INDEX IF EXISTS idx_orders_supplier_id;
-- DROP INDEX IF EXISTS idx_orders_order_type;
-- COMMIT;
