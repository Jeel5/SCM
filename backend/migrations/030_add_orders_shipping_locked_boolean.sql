-- Migration 030: Add missing shipping_locked boolean to orders
-- ─────────────────────────────────────────────────────────────────────────────
-- OrderRepository uses shipping_locked as a boolean flag (SET shipping_locked = true/false,
-- WHERE shipping_locked = false/true) for optimistic concurrency during carrier-assignment.
-- The column existed in code but was never created in the DB schema, causing
-- silent failures in the shipping-lock acquire/release flow.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_locked boolean NOT NULL DEFAULT false;

-- Back-fill: any order that has a non-null shipping_locked_at and no unlock
-- recorded is considered currently locked.  This is safe: orders with rows are
-- few right now and worst-case we release the lock on next app restart.
UPDATE orders
  SET shipping_locked = true
  WHERE shipping_locked_at IS NOT NULL
    AND shipping_locked_by IS NOT NULL;

-- Index to make the "find expired locks" query fast
-- (scans only locked rows, not the full table)
CREATE INDEX IF NOT EXISTS idx_orders_shipping_locked
  ON orders (shipping_locked_at)
  WHERE shipping_locked = true;

COMMENT ON COLUMN orders.shipping_locked IS
  'Optimistic lock flag – set true while a worker holds the shipping assignment lock';
COMMENT ON COLUMN orders.shipping_locked_at IS
  'Timestamp when the lock was acquired; used to detect expired locks';
COMMENT ON COLUMN orders.shipping_locked_by IS
  'Worker/process identifier that acquired the lock (for debugging)';
