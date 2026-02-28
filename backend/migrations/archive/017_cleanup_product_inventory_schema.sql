-- Migration 017: Clean up product/inventory schema redundancies
-- 1. Drop duplicate is_hazardous column from products (keep is_hazmat)
-- 2. Add trigger to auto-sync inventory.sku + inventory.product_name from products when product_id set
DROP VIEW IF EXISTS v_products_shipping_details;
-- ── 1. Drop duplicate column ──────────────────────────────────────────────
ALTER TABLE products DROP COLUMN IF EXISTS is_hazardous;

-- Ensure is_hazmat exists (in case any older path missed it)
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_hazmat BOOLEAN DEFAULT false;

-- ── 2. Backfill inventory.sku / product_name where product_id is set ──────
UPDATE inventory i
SET
  sku          = COALESCE(i.sku, p.sku),
  product_name = COALESCE(i.product_name, p.name)
FROM products p
WHERE i.product_id = p.id
  AND (i.sku IS NULL OR i.product_name IS NULL);

-- ── 3. Trigger: keep inventory.sku + product_name in sync on insert/update ─
CREATE OR REPLACE FUNCTION sync_inventory_product_info()
RETURNS TRIGGER AS $$
DECLARE
  v_sku  VARCHAR(100);
  v_name VARCHAR(255);
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT sku, name INTO v_sku, v_name
    FROM products WHERE id = NEW.product_id LIMIT 1;

    NEW.sku          := COALESCE(NEW.sku, v_sku);
    NEW.product_name := COALESCE(NEW.product_name, v_name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_inventory_product_info ON inventory;
CREATE TRIGGER trg_sync_inventory_product_info
  BEFORE INSERT OR UPDATE OF product_id ON inventory
  FOR EACH ROW EXECUTE FUNCTION sync_inventory_product_info();
