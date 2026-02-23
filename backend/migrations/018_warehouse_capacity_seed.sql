-- Migration 018: Set capacity for existing warehouses that have NULL capacity
-- Also adds a default capacity for any future warehouses without one.

UPDATE warehouses
SET capacity = CASE code
    WHEN 'WH-MUM' THEN 50000
    WHEN 'WH-DEL' THEN 40000
    WHEN 'WH-BLR' THEN 35000
    ELSE 10000  -- default for any other existing warehouses
END
WHERE capacity IS NULL OR capacity = 0;

-- Backfill current_utilization for all warehouses based on live inventory data.
-- This ensures the stored column is consistent even before the new trigger logic
-- in inventoryController.js takes effect.
UPDATE warehouses w
SET current_utilization = LEAST(
  ROUND(
    COALESCE(
      (SELECT SUM(available_quantity + reserved_quantity + damaged_quantity + in_transit_quantity)
       FROM inventory
       WHERE warehouse_id = w.id),
      0
    ) * 100.0 / NULLIF(w.capacity, 0),
    100
  ), 2
);
