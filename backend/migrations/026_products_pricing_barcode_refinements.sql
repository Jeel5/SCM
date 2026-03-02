-- ============================================================
-- 026: Products Pricing & Barcode Refinements
-- Industry-standard pricing model + dual barcode system
-- ============================================================

-- ── PRICING RESTRUCTURE ────────────────────────────────────
-- Current: unit_price, cost_price, declared_value
-- Industry Standard: cost_price, selling_price, mrp

-- Rename unit_price → selling_price (clearer semantics)
ALTER TABLE products RENAME COLUMN unit_price TO selling_price;

-- Add MRP (Maximum Retail Price) - India legal requirement for packaged goods
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS mrp DECIMAL(12,2)
    CHECK (mrp IS NULL OR mrp >= 0);

-- Remove declared_value from products (should be at shipment level, varies by qty)
ALTER TABLE products DROP COLUMN IF EXISTS declared_value;

-- ── BARCODE RESTRUCTURE ────────────────────────────────────
-- Industry standard: manufacturer barcode (optional UPC/EAN) + internal warehouse barcode (mandatory)

-- Rename barcode → manufacturer_barcode
ALTER TABLE products RENAME COLUMN barcode TO manufacturer_barcode;

-- Add internal_barcode (auto-generated, always unique across ALL orgs)
-- Format: EAN-13 compatible sequential (will be auto-generated in application)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS internal_barcode VARCHAR(50);

-- Populate existing products with internal barcodes (sequential from ID)
UPDATE products 
SET internal_barcode = 'IB-' || LPAD(EXTRACT(EPOCH FROM created_at)::BIGINT::TEXT, 10, '0') || '-' || SUBSTRING(id::TEXT, 1, 8)
WHERE internal_barcode IS NULL;

-- Make internal_barcode NOT NULL and UNIQUE globally
ALTER TABLE products
  ALTER COLUMN internal_barcode SET NOT NULL,
  ADD CONSTRAINT products_internal_barcode_unique UNIQUE (internal_barcode);

-- Update manufacturer barcode index (was idx_products_barcode_org)
DROP INDEX IF EXISTS idx_products_barcode_org;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_manufacturer_barcode_org
  ON products(organization_id, manufacturer_barcode)
  WHERE manufacturer_barcode IS NOT NULL;

-- ── REMOVE FIELDS NOT NEEDED FOR B2C ───────────────────────
-- min_order_qty is B2B wholesale feature, not needed for e-commerce MVP
ALTER TABLE products DROP COLUMN IF EXISTS min_order_qty;

-- ── COMMENTS ───────────────────────────────────────────────
COMMENT ON COLUMN products.cost_price IS 'Purchase/manufacturing cost (COGS) - internal use for margin calculation';
COMMENT ON COLUMN products.selling_price IS 'Base catalog selling price (pre-tax, pre-discount)';
COMMENT ON COLUMN products.mrp IS 'Maximum Retail Price (India legal requirement, printed on package)';
COMMENT ON COLUMN products.manufacturer_barcode IS 'UPC/EAN/ISBN from product manufacturer (optional, for retail products)';
COMMENT ON COLUMN products.internal_barcode IS 'Auto-generated internal barcode for warehouse scanning (mandatory, globally unique)';
COMMENT ON COLUMN products.hsn_code IS 'HSN/SAC code for GST compliance (manual entry, government classification)';
COMMENT ON COLUMN products.gst_rate IS 'GST rate percentage (0/5/12/18/28) - can be auto-filled from HSN but user must confirm';
