-- ============================================================
-- 025: Products Table Enhancements
-- Add industry-standard fields; remove redundant item_type column
-- ============================================================

-- ── Drop redundant column ──────────────────────────────────
-- item_type duplicates boolean flags (is_fragile, is_hazmat, is_perishable)
-- and category (electronics, documents). Default was always 'general'.
ALTER TABLE products DROP COLUMN IF EXISTS item_type;

-- ── Add new columns ────────────────────────────────────────

-- Product identification (warehouse scanning & customs)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS barcode            VARCHAR(100),
  ADD COLUMN IF NOT EXISTS hsn_code           VARCHAR(20),      -- Harmonized System of Nomenclature (mandatory for India GST)
  ADD COLUMN IF NOT EXISTS gst_rate           DECIMAL(5,2) DEFAULT 18.00, -- GST rate percentage (0, 5, 12, 18, 28)
  ADD COLUMN IF NOT EXISTS brand              VARCHAR(255),
  ADD COLUMN IF NOT EXISTS country_of_origin  VARCHAR(100) DEFAULT 'India',

-- Order & procurement rules
  ADD COLUMN IF NOT EXISTS min_order_qty      INTEGER DEFAULT 1
    CHECK (min_order_qty >= 1),

-- Returns & compliance  
  ADD COLUMN IF NOT EXISTS warranty_period_days INTEGER DEFAULT 0
    CHECK (warranty_period_days >= 0),           -- 0 = no warranty

-- Perishables
  ADD COLUMN IF NOT EXISTS shelf_life_days    INTEGER
    CHECK (shelf_life_days IS NULL OR shelf_life_days > 0),

-- Flexible search tagging
  ADD COLUMN IF NOT EXISTS tags               JSONB DEFAULT '[]'::jsonb,

-- Primary supplier (procurement reference)
  ADD COLUMN IF NOT EXISTS supplier_id        UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- ── Indexes ────────────────────────────────────────────────
-- Unique barcode per organization (two orgs can share a barcode, same org cannot)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode_org
  ON products(organization_id, barcode)
  WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_brand
  ON products(organization_id, brand)
  WHERE brand IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_hsn
  ON products(hsn_code)
  WHERE hsn_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_supplier
  ON products(supplier_id)
  WHERE supplier_id IS NOT NULL;

-- GIN index for tag search
CREATE INDEX IF NOT EXISTS idx_products_tags
  ON products USING GIN(tags);

COMMENT ON COLUMN products.barcode              IS 'EAN-13 / UPC-A / QR barcode for warehouse scanning';
COMMENT ON COLUMN products.hsn_code             IS 'HSN/SAC code — required on Indian GST invoices (Schedule I of Customs Tariff Act)';
COMMENT ON COLUMN products.gst_rate             IS 'GST rate percentage applicable to this product (0, 5, 12, 18, or 28)';
COMMENT ON COLUMN products.brand                IS 'Brand or manufacturer name';
COMMENT ON COLUMN products.country_of_origin    IS 'Country of manufacture — required for customs declarations';
COMMENT ON COLUMN products.min_order_qty        IS 'Minimum units per order (MOQ) — enforced at order placement';
COMMENT ON COLUMN products.warranty_period_days IS 'Warranty duration in days (0 = no warranty)';
COMMENT ON COLUMN products.shelf_life_days      IS 'Shelf life in days for perishable products';
COMMENT ON COLUMN products.tags                 IS 'Free-form tags for search/filtering e.g. ["summer","new-arrival"]';
COMMENT ON COLUMN products.supplier_id          IS 'Primary supplier for procurement and replenishment';
