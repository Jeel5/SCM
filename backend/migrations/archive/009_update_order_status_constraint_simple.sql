-- Migration: Update Order Status Constraint for Carrier Assignment Flow
-- Purpose: Add 'ready_to_ship' status, add carrier_id column
-- Date: 2026-02-16
-- Note: Using existing 'on_hold' instead of new 'pending_manual_assignment'

-- Step 1: Drop existing CHECK constraint on orders.status
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Step 2: Add updated CHECK constraint (keeping existing statuses, just adding ready_to_ship)
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN (
    'created',                    -- Order created, initial state
    'confirmed',                  -- Order confirmed by customer
    'processing',                 -- Being processed
    'allocated',                  -- Inventory allocated
    'ready_to_ship',              -- Carrier accepted, ready for pickup (NEW)
    'shipped',                    -- Carrier picked up and shipped
    'in_transit',                 -- In transit to customer
    'out_for_delivery',           -- Out for final delivery
    'delivered',                  -- Successfully delivered
    'returned',                   -- Returned by customer
    'cancelled',                  -- Cancelled
    'on_hold',                    -- On hold (any reason including carrier assignment failure)
    'pending_carrier_assignment'  -- Waiting for carrier to accept
  ));

-- Step 3: Add carrier_id column if not exists (for tracking assigned carrier)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier_id UUID REFERENCES carriers(id);

-- Step 4: Create index for faster carrier lookups
CREATE INDEX IF NOT EXISTS idx_orders_carrier_id ON orders(carrier_id) WHERE carrier_id IS NOT NULL;

-- Step 5: Create index for on_hold orders (for ops team dashboard)
CREATE INDEX IF NOT EXISTS idx_orders_on_hold ON orders(status) WHERE status = 'on_hold';

-- Step 6: Add comments for documentation
COMMENT ON COLUMN orders.carrier_id IS 'Carrier that accepted the assignment (set when carrier accepts job)';
COMMENT ON COLUMN orders.status IS 'Order workflow: created -> pending_carrier_assignment -> ready_to_ship -> shipped -> in_transit -> delivered. Use on_hold for any blocking issues.';

-- Verification query (optional)
-- SELECT status, COUNT(*) as count FROM orders GROUP BY status ORDER BY status;
