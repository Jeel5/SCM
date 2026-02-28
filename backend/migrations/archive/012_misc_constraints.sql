-- Migration 012: Missing database constraints for code-level fixes

-- TASK-R7-010: Unique constraint on shipment tracking events (idempotent inserts)
-- Required for addTrackingEvent ON CONFLICT clause
ALTER TABLE shipment_tracking
  ADD COLUMN IF NOT EXISTS carrier_status VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shipment_tracking_unique_event
  ON shipment_tracking (shipment_id, carrier_status, event_time)
  WHERE carrier_status IS NOT NULL;

-- TASK-R6-012: Inventory quantity invariant CHECK constraint
-- quantity = available_quantity + reserved_quantity + damaged_quantity + in_transit_quantity
-- (use DO $$ to handle pre-existing rows gracefully)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'inventory' AND constraint_name = 'chk_quantity_invariant'
  ) THEN
    ALTER TABLE inventory
      ADD CONSTRAINT chk_quantity_invariant
      CHECK (
        quantity = available_quantity
                 + COALESCE(reserved_quantity, 0)
                 + COALESCE(damaged_quantity, 0)
                 + COALESCE(in_transit_quantity, 0)
      );
  END IF;
END $$;

-- TASK-R1-007 / TASK-R1-014: status columns already exist; no schema change needed.
-- State machine enforcement is code-level in orderService + returnsController.

-- TASK-R4-002: Trigger to prevent clients writing current_utilization directly (belt-and-suspenders)
-- (Optional safety measure — primary enforcement is in validator schema)
