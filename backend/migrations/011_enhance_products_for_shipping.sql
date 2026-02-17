-- Migration: Enhance Products for Real-World Shipping Requirements
-- Purpose: Add dimensions, item classification, and shipping attributes to products catalog
-- Date: 2026-02-17
-- Note: This is the source of truth for product specs. Order items copy these values at order creation.

-- Step 1: Add dimensions field (L×W×H in cm)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS dimensions JSONB DEFAULT '{"length": 0, "width": 0, "height": 0}'::jsonb;

COMMENT ON COLUMN products.dimensions IS 'Package dimensions in cm: {length, width, height}. Used for shipping cost calculations.';

-- Step 2: Add item classification fields
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_fragile BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_hazardous BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_perishable BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_cold_storage BOOLEAN DEFAULT false;

COMMENT ON COLUMN products.is_fragile IS 'Requires fragile handling (adds surcharge)';
COMMENT ON COLUMN products.is_hazardous IS 'Hazardous material (adds surcharge, special carrier requirements)';
COMMENT ON COLUMN products.is_perishable IS 'Perishable item (adds surcharge, time-sensitive delivery)';
COMMENT ON COLUMN products.requires_cold_storage IS 'Requires temperature-controlled transport (adds surcharge)';

-- Step 3: Add item type classification
ALTER TABLE products
ADD COLUMN IF NOT EXISTS item_type VARCHAR(50) DEFAULT 'general' 
  CHECK (item_type IN ('general', 'fragile', 'hazardous', 'perishable', 'electronics', 'documents', 'valuable'));

COMMENT ON COLUMN products.item_type IS 'Product category for handling requirements';

-- Step 4: Add volumetric weight (calculated from dimensions)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS volumetric_weight DECIMAL(10,3);

COMMENT ON COLUMN products.volumetric_weight IS 'Dimensional weight (L×W×H/5000). Auto-calculated from dimensions.';

-- Step 5: Add package type
ALTER TABLE products
ADD COLUMN IF NOT EXISTS package_type VARCHAR(50) DEFAULT 'box'
  CHECK (package_type IN ('envelope', 'box', 'tube', 'pallet', 'crate', 'bag', 'custom'));

COMMENT ON COLUMN products.package_type IS 'Recommended package type for this product';

-- Step 6: Add handling instructions
ALTER TABLE products
ADD COLUMN IF NOT EXISTS handling_instructions TEXT;

COMMENT ON COLUMN products.handling_instructions IS 'Special handling instructions for carriers';

-- Step 7: Add insurance requirements
ALTER TABLE products
ADD COLUMN IF NOT EXISTS requires_insurance BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS declared_value DECIMAL(10,2);

COMMENT ON COLUMN products.requires_insurance IS 'Whether this product requires shipping insurance';
COMMENT ON COLUMN products.declared_value IS 'Default declared value for insurance calculation';

-- Step 8: Create indexes for product filtering by shipping attributes
CREATE INDEX IF NOT EXISTS idx_products_fragile ON products(is_fragile) WHERE is_fragile = true;
CREATE INDEX IF NOT EXISTS idx_products_hazardous ON products(is_hazardous) WHERE is_hazardous = true;
CREATE INDEX IF NOT EXISTS idx_products_perishable ON products(is_perishable) WHERE is_perishable = true;
CREATE INDEX IF NOT EXISTS idx_products_item_type ON products(item_type);

-- Step 9: Create trigger to auto-calculate volumetric weight when dimensions change
CREATE OR REPLACE FUNCTION calculate_product_volumetric_weight()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate volumetric weight: (L × W × H) / 5000 (industry standard)
  -- Dimensions are in cm, weight in kg
  IF NEW.dimensions IS NOT NULL AND 
     (NEW.dimensions->>'length')::numeric > 0 AND 
     (NEW.dimensions->>'width')::numeric > 0 AND 
     (NEW.dimensions->>'height')::numeric > 0 THEN
    
    NEW.volumetric_weight := (
      (NEW.dimensions->>'length')::numeric * 
      (NEW.dimensions->>'width')::numeric * 
      (NEW.dimensions->>'height')::numeric
    ) / 5000.0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_product_volumetric_weight ON products;
CREATE TRIGGER trigger_calculate_product_volumetric_weight
  BEFORE INSERT OR UPDATE OF dimensions ON products
  FOR EACH ROW
  EXECUTE FUNCTION calculate_product_volumetric_weight();

-- Step 10: Update existing products with sample dimensions (adjust based on actual products)
-- Example: Set default dimensions for existing products based on typical sizes
UPDATE products 
SET dimensions = jsonb_build_object(
  'length', 
  CASE 
    WHEN weight < 0.5 THEN 15
    WHEN weight < 2 THEN 25
    WHEN weight < 5 THEN 35
    ELSE 50
  END,
  'width',
  CASE 
    WHEN weight < 0.5 THEN 10
    WHEN weight < 2 THEN 20
    WHEN weight < 5 THEN 30
    ELSE 40
  END,
  'height',
  CASE 
    WHEN weight < 0.5 THEN 8
    WHEN weight < 2 THEN 15
    WHEN weight < 5 THEN 25
    ELSE 35
  END
)
WHERE dimensions IS NULL OR dimensions = '{"length": 0, "width": 0, "height": 0}'::jsonb;

-- Step 11: Create view for shipping-ready products with calculated weights
CREATE OR REPLACE VIEW v_products_shipping_details AS
SELECT 
  p.id,
  p.name,
  p.sku,
  p.weight as actual_weight,
  p.volumetric_weight,
  GREATEST(COALESCE(p.weight, 0), COALESCE(p.volumetric_weight, 0)) as chargeable_weight,
  p.dimensions,
  p.is_fragile,
  p.is_hazardous,
  p.is_perishable,
  p.requires_cold_storage,
  p.item_type,
  p.package_type,
  p.handling_instructions,
  p.requires_insurance,
  p.declared_value,
  -- Calculate total volume in cubic meters
  CASE 
    WHEN p.dimensions IS NOT NULL AND 
         (p.dimensions->>'length')::numeric > 0 AND 
         (p.dimensions->>'width')::numeric > 0 AND 
         (p.dimensions->>'height')::numeric > 0
    THEN (
      (p.dimensions->>'length')::numeric * 
      (p.dimensions->>'width')::numeric * 
      (p.dimensions->>'height')::numeric
    ) / 1000000.0
    ELSE 0
  END as volume_cubic_meters,
  -- Determine special handling flag
  CASE 
    WHEN p.is_fragile OR p.is_hazardous OR p.is_perishable OR p.requires_cold_storage 
    THEN true 
    ELSE false 
  END as requires_special_handling,
  -- Estimated shipping cost multiplier
  CASE
    WHEN p.is_hazardous THEN 1.25
    WHEN p.is_perishable THEN 1.15
    WHEN p.is_fragile THEN 1.10
    WHEN p.requires_cold_storage THEN 1.30
    ELSE 1.0
  END as shipping_cost_multiplier
FROM products p;

COMMENT ON VIEW v_products_shipping_details IS 'Complete shipping details for products including chargeable weight and special handling flags';

-- Verification queries (comment out in production)
-- SELECT * FROM v_products_shipping_details LIMIT 10;
-- SELECT item_type, COUNT(*), AVG(chargeable_weight) FROM v_products_shipping_details GROUP BY item_type;
-- SELECT COUNT(*) as fragile_products FROM products WHERE is_fragile = true;
