-- Migration 027: Add SCM-scoped warehouse fields + drop out-of-scope product images
-- Warehouse additions: gstin, has_cold_storage, temperature range, daily capacities,
--   customs_bonded_warehouse, certifications
-- Product removal: images column (belongs in PIM/e-commerce, not SCM)

-- ============================================================
-- 1. DROP images from products
-- ============================================================
ALTER TABLE products DROP COLUMN IF EXISTS images;

-- ============================================================
-- 2. ADD new columns to warehouses
-- ============================================================
ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS gstin                   VARCHAR(15),
  ADD COLUMN IF NOT EXISTS has_cold_storage        BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS temperature_min_celsius DECIMAL(5,1),
  ADD COLUMN IF NOT EXISTS temperature_max_celsius DECIMAL(5,1),
  ADD COLUMN IF NOT EXISTS daily_inbound_capacity  INTEGER,
  ADD COLUMN IF NOT EXISTS daily_outbound_capacity INTEGER,
  ADD COLUMN IF NOT EXISTS customs_bonded_warehouse BOOLEAN    NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS certifications          TEXT[]      NOT NULL DEFAULT '{}';

-- ============================================================
-- 3. Constraints
-- ============================================================

-- GSTIN format: India's 15-character GST Identification Number
-- Pattern: 2-digit state code + 5-char PAN letters + 4-digit PAN number +
--          1 entity code + 1 Z (fixed) + 1 check digit
ALTER TABLE warehouses
  ADD CONSTRAINT warehouses_gstin_format
  CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$');

-- Capacity values must be positive
ALTER TABLE warehouses
  ADD CONSTRAINT warehouses_daily_inbound_capacity_check
  CHECK (daily_inbound_capacity IS NULL OR daily_inbound_capacity > 0);

ALTER TABLE warehouses
  ADD CONSTRAINT warehouses_daily_outbound_capacity_check
  CHECK (daily_outbound_capacity IS NULL OR daily_outbound_capacity > 0);

-- Temperature min must not exceed max
ALTER TABLE warehouses
  ADD CONSTRAINT warehouses_temperature_range_check
  CHECK (
    temperature_min_celsius IS NULL OR
    temperature_max_celsius IS NULL OR
    temperature_min_celsius <= temperature_max_celsius
  );

-- ============================================================
-- 4. Backfill has_cold_storage for existing cold_storage warehouses
-- ============================================================
UPDATE warehouses
  SET has_cold_storage = true
WHERE warehouse_type = 'cold_storage'
  AND has_cold_storage = false;

-- ============================================================
-- 5. Indexes (used for product-to-warehouse routing queries)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_warehouses_cold_storage
  ON warehouses(has_cold_storage) WHERE has_cold_storage = true;

CREATE INDEX IF NOT EXISTS idx_warehouses_bonded_customs
  ON warehouses(customs_bonded_warehouse) WHERE customs_bonded_warehouse = true;
