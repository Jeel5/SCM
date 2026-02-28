-- Migration: Enhance Order Items for Real-World Shipping Requirements
-- Purpose: Add dimensions, item classification, and shipping attributes
-- Date: 2026-02-17

-- Step 1: Add dimensions field (L×W×H in cm)
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS dimensions JSONB DEFAULT '{"length": 0, "width": 0, "height": 0}'::jsonb;

COMMENT ON COLUMN order_items.dimensions IS 'Package dimensions in cm: {length, width, height}';

-- Step 2: Add item classification fields
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS is_fragile BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_hazardous BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_perishable BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_cold_storage BOOLEAN DEFAULT false;

-- Step 3: Add item type classification
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS item_type VARCHAR(50) DEFAULT 'general' 
  CHECK (item_type IN ('general', 'fragile', 'hazardous', 'perishable', 'electronics', 'documents', 'valuable'));

-- Step 4: Add volumetric weight (calculated from dimensions)
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS volumetric_weight DECIMAL(10,3);

COMMENT ON COLUMN order_items.volumetric_weight IS 'Dimensional weight (L×W×H/5000). Used for carrier pricing when > actual weight';

-- Step 5: Add package type
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS package_type VARCHAR(50) DEFAULT 'box'
  CHECK (package_type IN ('envelope', 'box', 'tube', 'pallet', 'crate', 'bag', 'custom'));

-- Step 6: Add handling instructions
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS handling_instructions TEXT;

-- Step 7: Add insurance requirements
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS requires_insurance BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS declared_value DECIMAL(10,2);

-- Step 8: Create index for fragile/hazardous items (operations team needs quick access)
CREATE INDEX IF NOT EXISTS idx_order_items_fragile ON order_items(is_fragile) WHERE is_fragile = true;
CREATE INDEX IF NOT EXISTS idx_order_items_hazardous ON order_items(is_hazardous) WHERE is_hazardous = true;
CREATE INDEX IF NOT EXISTS idx_order_items_perishable ON order_items(is_perishable) WHERE is_perishable = true;

-- Step 9: Create trigger to auto-calculate volumetric weight when dimensions change
CREATE OR REPLACE FUNCTION calculate_volumetric_weight()
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

DROP TRIGGER IF EXISTS trigger_calculate_volumetric_weight ON order_items;
CREATE TRIGGER trigger_calculate_volumetric_weight
  BEFORE INSERT OR UPDATE OF dimensions ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_volumetric_weight();

-- Step 10: Update existing records with default dimensions (if weight exists)
-- Assuming average density to estimate dimensions for existing data
UPDATE order_items 
SET dimensions = jsonb_build_object(
  'length', 30,
  'width', 20,
  'height', 15
)
WHERE dimensions IS NULL AND weight IS NOT NULL;

-- Step 11: View for shipping-ready items with calculated weights
CREATE OR REPLACE VIEW v_order_items_shipping_details AS
SELECT 
  oi.id,
  oi.order_id,
  oi.product_id,
  oi.sku,
  oi.product_name,
  oi.quantity,
  oi.weight as actual_weight,
  oi.volumetric_weight,
  GREATEST(oi.weight, oi.volumetric_weight) as chargeable_weight,
  oi.dimensions,
  oi.is_fragile,
  oi.is_hazardous,
  oi.is_perishable,
  oi.requires_cold_storage,
  oi.item_type,
  oi.package_type,
  oi.handling_instructions,
  oi.requires_insurance,
  oi.declared_value,
  -- Calculate total volume in cubic meters
  (
    (oi.dimensions->>'length')::numeric * 
    (oi.dimensions->>'width')::numeric * 
    (oi.dimensions->>'height')::numeric
  ) / 1000000.0 as volume_cubic_meters,
  -- Determine special handling flag
  CASE 
    WHEN oi.is_fragile OR oi.is_hazardous OR oi.is_perishable OR oi.requires_cold_storage 
    THEN true 
    ELSE false 
  END as requires_special_handling
FROM order_items oi;

COMMENT ON VIEW v_order_items_shipping_details IS 'Complete shipping details for order items including chargeable weight and special handling';

-- Verification queries (comment out in production)
-- SELECT * FROM v_order_items_shipping_details LIMIT 5;
-- SELECT item_type, COUNT(*), AVG(chargeable_weight) FROM v_order_items_shipping_details GROUP BY item_type;
