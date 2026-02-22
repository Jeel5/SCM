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
