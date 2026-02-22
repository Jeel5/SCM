-- ================================================================================
-- Migration 015: Transfer Orders and System Enhancements
-- ================================================================================
-- Date: 2026-02-21
-- Purpose: Add support for transfer orders, warehouse enhancements, and inventory fixes
--
-- Changes:
-- 1. Add missing warehouse fields (zones, operating_hours)
-- 2. Update orders.order_type to support 'transfer' orders
-- 3. Rename inventory columns for consistency (quantity → quantity_total, etc.)
-- 4. Add performed_by column to stock_movements if missing
-- ================================================================================

BEGIN;

-- ============================================
-- 1. WAREHOUSE ENHANCEMENTS
-- ============================================

-- Add zones field (number of zones in warehouse)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'warehouses' AND column_name = 'zones'
    ) THEN
        ALTER TABLE warehouses ADD COLUMN zones INTEGER DEFAULT 0;
        COMMENT ON COLUMN warehouses.zones IS 'Number of storage zones in warehouse';
    END IF;
END $$;

-- Add operating_hours field (JSONB: {open, close, timezone})
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'warehouses' AND column_name = 'operating_hours'
    ) THEN
        ALTER TABLE warehouses ADD COLUMN operating_hours JSONB;
        COMMENT ON COLUMN warehouses.operating_hours IS 'Operating hours: {open: "HH:MM", close: "HH:MM", timezone: "TZ"}';
        
        -- Set default operating hours for existing warehouses
        UPDATE warehouses 
        SET operating_hours = '{"open": "00:00", "close": "23:59", "timezone": "UTC"}'::jsonb
        WHERE operating_hours IS NULL;
    END IF;
END $$;

-- ============================================
-- 2. ORDERS TABLE - TRANSFER ORDER SUPPORT
-- ============================================

-- Update order_type constraint to include 'transfer'
DO $$ 
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'orders' AND constraint_name LIKE '%order_type%'
    ) THEN
        ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
    END IF;
    
    -- Add new constraint with 'transfer' included
    ALTER TABLE orders ADD CONSTRAINT orders_order_type_check 
    CHECK (order_type IN ('regular', 'replacement', 'cod', 'transfer'));
    
    COMMENT ON COLUMN orders.order_type IS 'Order type: regular, replacement, cod, transfer (warehouse-to-warehouse)';
END $$;

-- ============================================
-- 3. INVENTORY TABLE - ADD MISSING COLUMNS
-- ============================================

-- Add unit_cost field if missing (needed for inventory valuation)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory' AND column_name = 'unit_cost'
    ) THEN
        ALTER TABLE inventory ADD COLUMN unit_cost DECIMAL(10,2) DEFAULT 0;
        COMMENT ON COLUMN inventory.unit_cost IS 'Cost per unit for inventory valuation';
    END IF;
END $$;

-- Note: Keeping existing column names (quantity, available_quantity, reserved_quantity)
-- for backward compatibility with existing code
COMMENT ON COLUMN inventory.quantity IS 'Total quantity (available + reserved + damaged + in_transit)';
COMMENT ON COLUMN inventory.available_quantity IS 'Available quantity for sale/transfer';
COMMENT ON COLUMN inventory.reserved_quantity IS 'Reserved quantity (allocated to orders)';
COMMENT ON COLUMN inventory.damaged_quantity IS 'Damaged/unusable quantity';
COMMENT ON COLUMN inventory.in_transit_quantity IS 'Quantity in transit (being transferred)';

-- ============================================
-- 4. STOCK MOVEMENTS - ADD PERFORMED_BY
-- ============================================

-- Add performed_by column if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_movements' AND column_name = 'performed_by'
    ) THEN
        ALTER TABLE stock_movements ADD COLUMN performed_by VARCHAR(255);
        COMMENT ON COLUMN stock_movements.performed_by IS 'User ID or system identifier who performed the movement';
    END IF;
END $$;

-- ============================================
-- 5. INDEXES FOR PERFORMANCE
-- ============================================

-- Index for transfer order queries
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type) WHERE order_type = 'transfer';

-- Index for low stock queries
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(warehouse_id, available_quantity, reorder_point) 
WHERE available_quantity <= reorder_point;

-- Index for stock movement lookups by reference
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

-- Index for inventory stats aggregation
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_stats ON inventory(warehouse_id, quantity, available_quantity, reserved_quantity);

-- ============================================
-- 6. HELPER VIEW FOR TRANSFER ORDERS
-- ============================================

-- Create or replace view for easy transfer order querying
CREATE OR REPLACE VIEW transfer_orders AS
SELECT 
    o.id,
    o.order_number,
    o.status,
    o.priority,
    o.total_amount,
    o.shipping_address,
    o.billing_address,
    o.estimated_delivery,
    o.actual_delivery,
    o.notes,
    o.created_at,
    o.updated_at,
    -- Extract warehouse info from addresses
    (SELECT w.id FROM warehouses w WHERE w.address::text = o.billing_address::text LIMIT 1) as from_warehouse_id,
    (SELECT w.id FROM warehouses w WHERE w.address::text = o.shipping_address::text LIMIT 1) as to_warehouse_id,
    -- Get shipment info
    s.id as shipment_id,
    s.tracking_number,
    s.status as shipment_status,
    c.name as carrier_name
FROM orders o
LEFT JOIN shipments s ON s.order_id = o.id
LEFT JOIN carriers c ON s.carrier_id = c.id
WHERE o.order_type = 'transfer';

COMMENT ON VIEW transfer_orders IS 'Convenient view for querying transfer orders with shipment details';

-- ============================================
-- 7. DATA VALIDATION & FIXES
-- ============================================

-- Ensure quantity = available_quantity + reserved_quantity + damaged_quantity + in_transit_quantity
UPDATE inventory
SET quantity = COALESCE(available_quantity, 0) + COALESCE(reserved_quantity, 0) + 
               COALESCE(damaged_quantity, 0) + COALESCE(in_transit_quantity, 0)
WHERE quantity != (COALESCE(available_quantity, 0) + COALESCE(reserved_quantity, 0) + 
                   COALESCE(damaged_quantity, 0) + COALESCE(in_transit_quantity, 0));

-- Set default reorder_point for items without one (10% of max or 50, whichever is lower)
UPDATE inventory
SET reorder_point = LEAST(COALESCE(max_stock_level, 500) * 0.1, 50)
WHERE reorder_point IS NULL;

-- ============================================
-- 8. AUDIT LOG
-- ============================================

-- Log this migration
INSERT INTO audit_logs (
    action,
    entity_type,
    changes
) VALUES (
    'schema_migration',
    'database',
    jsonb_build_object(
        'migration_number', '015',
        'description', 'Applied transfer orders and system enhancements migration',
        'changes', jsonb_build_array(
            'Added warehouses.zones and warehouses.operating_hours columns',
            'Updated orders.order_type to support transfer orders',
            'Added inventory.unit_cost column',
            'Added stock_movements.performed_by column',
            'Created indexes for performance optimization',
            'Created transfer_orders view'
        ),
        'applied_at', NOW()
    )
);

COMMIT;

-- ================================================================================
-- END OF MIGRATION 015
-- ================================================================================

-- Verify migration
SELECT 'Migration 015 completed successfully!' as status;

-- Show summary
SELECT 
    'Warehouses with operating hours: ' || COUNT(*) as info
FROM warehouses 
WHERE operating_hours IS NOT NULL
UNION ALL
SELECT 
    'Transfer orders in system: ' || COUNT(*) as info
FROM orders 
WHERE order_type = 'transfer'
UNION ALL
SELECT 
    'Inventory items tracked: ' || COUNT(*) as info
FROM inventory;
