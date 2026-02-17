-- Migration: Update Order Status Constraint and Add Carrier Reference
-- Purpose: Support new carrier assignment flow statuses
-- Date: 2026-02-16

-- Step 1: Drop existing CHECK constraint on orders.status
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Step 2: Add new CHECK constraint with additional statuses
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
    'on_hold',                    -- On hold
    'pending_carrier_assignment', -- Waiting for carrier to accept (EXISTING)
    'pending_manual_assignment'   -- All retries exhausted, needs manual assignment (NEW)
  ));

-- Step 3: Add carrier_id column if not exists (for tracking assigned carrier)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier_id UUID REFERENCES carriers(id);

-- Step 4: Create index for faster carrier lookups
CREATE INDEX IF NOT EXISTS idx_orders_carrier_id ON orders(carrier_id) WHERE carrier_id IS NOT NULL;

-- Step 5: Create index for manual assignment queue
CREATE INDEX IF NOT EXISTS idx_orders_manual_assignment ON orders(status) WHERE status = 'pending_manual_assignment';

-- Step 6: Add comment for documentation
COMMENT ON COLUMN orders.carrier_id IS 'Carrier that accepted the assignment (set when carrier accepts job)';
COMMENT ON COLUMN orders.status IS 'Order status workflow: created -> pending_carrier_assignment -> ready_to_ship -> shipped -> in_transit -> delivered';

-- Verification queries (informational - comment out in production)
-- SELECT status, COUNT(*) FROM orders GROUP BY status ORDER BY status;
-- SELECT carrier_id, COUNT(*) FROM orders WHERE carrier_id IS NOT NULL GROUP BY carrier_id;
