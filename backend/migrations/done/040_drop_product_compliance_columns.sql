-- Remove deprecated product compliance/identification fields.
-- These attributes were removed from frontend/backend and are no longer stored.

BEGIN;

DROP INDEX IF EXISTS idx_products_hsn;
DROP INDEX IF EXISTS idx_products_manufacturer_barcode_org;

ALTER TABLE products
  DROP COLUMN IF EXISTS manufacturer_barcode,
  DROP COLUMN IF EXISTS hsn_code,
  DROP COLUMN IF EXISTS gst_rate;

COMMIT;
