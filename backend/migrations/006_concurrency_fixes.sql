-- Migration 006: Concurrency safety fixes
-- Fixes TASK-R6-006, TASK-R7-006, TASK-R8-010

-- ============================================================
-- TASK-R6-006: Carrier assignment deduplication guard
-- Prevents race conditions creating duplicate active assignments
-- for the same (order, carrier) pair.
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_carrier_assignments_active
  ON carrier_assignments (order_id, carrier_id)
  WHERE status NOT IN ('rejected', 'cancelled');

-- ============================================================
-- TASK-R7-006 / TASK-R8-010: Sequence-based code generation
-- Replaces COUNT(*)-based approach that suffers from TOCTOU
-- races when concurrent inserts run simultaneously.
-- ============================================================

-- Atomic sequences for human-readable code generation.
-- Each NEXTVAL call is guaranteed unique even under high concurrency.
CREATE SEQUENCE IF NOT EXISTS org_code_seq  START 1 INCREMENT 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS wh_code_seq   START 1 INCREMENT 1 NO CYCLE;

-- Initialise sequences to current max values so existing codes are not reused.
SELECT setval('org_code_seq', GREATEST(
  (SELECT COALESCE(MAX(CAST(SPLIT_PART(code, '-', 3) AS INTEGER)), 0) FROM organizations WHERE code ~ '^ORG-\d{2}-\d+$'),
  1
));

SELECT setval('wh_code_seq', GREATEST(
  (SELECT COALESCE(MAX(CAST(SPLIT_PART(code, '-', 3) AS INTEGER)), 0) FROM warehouses WHERE code ~ '^WH-\d{2}-\d+$'),
  1
));

-- DB-level uniqueness safety net (no-op if constraint already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'organizations' AND indexname = 'uq_organizations_code_idx'
  ) THEN
    CREATE UNIQUE INDEX uq_organizations_code_idx ON organizations (code);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'warehouses' AND indexname = 'uq_warehouses_code_idx'
  ) THEN
    CREATE UNIQUE INDEX uq_warehouses_code_idx ON warehouses (code);
  END IF;
END $$;
