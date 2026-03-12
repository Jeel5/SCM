-- Migration 036: Create org_code_seq and wh_code_seq sequences
-- Fixes "relation org_code_seq does not exist" error on POST /api/organizations
-- and the equivalent for warehouse code generation.
-- These were defined in archive/006_concurrency_fixes.sql but never applied.

-- Atomic sequences for human-readable code generation.
-- NEXTVAL is guaranteed unique even under concurrent inserts (no TOCTOU race).
CREATE SEQUENCE IF NOT EXISTS org_code_seq START 1 INCREMENT 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS wh_code_seq  START 1 INCREMENT 1 NO CYCLE;

-- Initialise sequences to current max values so existing codes are not reused.
SELECT setval('org_code_seq', GREATEST(
  (SELECT COALESCE(MAX(CAST(SPLIT_PART(code, '-', 3) AS INTEGER)), 0)
   FROM organizations WHERE code ~ '^ORG-\d{2}-\d+$'),
  1
));

SELECT setval('wh_code_seq', GREATEST(
  (SELECT COALESCE(MAX(CAST(SPLIT_PART(code, '-', 3) AS INTEGER)), 0)
   FROM warehouses WHERE code ~ '^WH-\d{2}-\d+$'),
  1
));

-- DB-level uniqueness guard on code columns (no-op if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'organizations' AND indexname = 'uq_organizations_code_idx'
  ) THEN
    CREATE UNIQUE INDEX uq_organizations_code_idx ON organizations (code);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'warehouses' AND indexname = 'uq_warehouses_code_idx'
  ) THEN
    CREATE UNIQUE INDEX uq_warehouses_code_idx ON warehouses (code);
  END IF;
END $$;
