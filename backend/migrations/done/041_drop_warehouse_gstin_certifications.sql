-- Remove deprecated warehouse compliance fields.

BEGIN;

ALTER TABLE warehouses
  DROP CONSTRAINT IF EXISTS warehouses_gstin_format;

ALTER TABLE warehouses
  DROP COLUMN IF EXISTS gstin,
  DROP COLUMN IF EXISTS certifications;

COMMIT;
