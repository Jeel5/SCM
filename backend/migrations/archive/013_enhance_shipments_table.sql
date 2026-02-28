-- Migration: Enhance Shipments Table with Item Attributes
-- Purpose: Add shipping attributes from order items to shipments for carrier visibility
-- Date: 2026-02-18
-- Context: Carriers need to know item characteristics (fragile, hazardous, etc.) to handle shipments properly

-- Step 1: Add item classification flags
-- These are aggregated from order items - if ANY item has the flag, the shipment gets it
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS is_fragile BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_hazardous BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_perishable BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_cold_storage BOOLEAN DEFAULT false;

COMMENT ON COLUMN shipments.is_fragile IS 'True if ANY item in shipment is fragile (aggregated from order_items)';
COMMENT ON COLUMN shipments.is_hazardous IS 'True if ANY item is hazardous (requires special carrier certification)';
COMMENT ON COLUMN shipments.is_perishable IS 'True if ANY item is perishable (time-sensitive delivery required)';
COMMENT ON COLUMN shipments.requires_cold_storage IS 'True if ANY item requires temperature control';

-- Step 2: Add item type (most restrictive from all items)
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS item_type VARCHAR(50) DEFAULT 'general' 
  CHECK (item_type IN ('general', 'fragile', 'hazardous', 'perishable', 'electronics', 'documents', 'valuable'));

COMMENT ON COLUMN shipments.item_type IS 'Most restrictive item type from all items in shipment';

-- Step 3: Add package type (most common or most restrictive)
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS package_type VARCHAR(50) DEFAULT 'box'
  CHECK (package_type IN ('envelope', 'box', 'tube', 'pallet', 'crate', 'bag', 'custom'));

COMMENT ON COLUMN shipments.package_type IS 'Package type determined from order items';

-- Step 4: Add handling instructions (concatenated from all items)
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS handling_instructions TEXT;

COMMENT ON COLUMN shipments.handling_instructions IS 'Special handling instructions aggregated from all order items';

-- Step 5: Add insurance requirements
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS requires_insurance BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS declared_value DECIMAL(10,2);

COMMENT ON COLUMN shipments.requires_insurance IS 'True if ANY item requires insurance';
COMMENT ON COLUMN shipments.declared_value IS 'Total declared value for insurance (sum of all item declared values)';

-- Step 6: Add total item count (different from package_count)
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS total_items INTEGER DEFAULT 0;

COMMENT ON COLUMN shipments.total_items IS 'Total number of items (quantity) in this shipment';

-- Step 7: Create indexes for carrier filtering
-- Carriers need to quickly find shipments they can handle (e.g., exclude hazardous if not certified)
CREATE INDEX IF NOT EXISTS idx_shipments_is_hazardous ON shipments(is_hazardous) WHERE is_hazardous = true;
CREATE INDEX IF NOT EXISTS idx_shipments_is_perishable ON shipments(is_perishable) WHERE is_perishable = true;
CREATE INDEX IF NOT EXISTS idx_shipments_requires_cold_storage ON shipments(requires_cold_storage) WHERE requires_cold_storage = true;
CREATE INDEX IF NOT EXISTS idx_shipments_item_type ON shipments(item_type) WHERE item_type != 'general';

-- Step 8: Create index for shipment status tracking
CREATE INDEX IF NOT EXISTS idx_shipments_status_created ON shipments(status, created_at DESC);

-- Step 9: Add comment explaining field removal considerations
COMMENT ON COLUMN shipments.awb_number IS 'Air Waybill Number (optional - mainly for air freight, can be same as carrier_tracking_number)';
COMMENT ON COLUMN shipments.route_geometry IS 'GeoJSON route for map display (populated during transit, not at creation)';
COMMENT ON COLUMN shipments.tracking_events IS 'Tracking history array (populated as carrier provides updates)';

-- Step 10: Verify columns that are already present and properly used
-- dimensions JSONB - already exists ✓
-- volumetric_weight DECIMAL(10,3) - already exists ✓
-- package_count INTEGER - already exists ✓
-- cod_amount DECIMAL(10,2) - already exists ✓
-- weight DECIMAL(10,3) - already exists ✓

-- No fields need to be removed - all serve valid purposes:
-- - awb_number: Valid for air freight
-- - route_geometry: Used for live tracking maps
-- - tracking_events: Essential for shipment history
-- - current_location: Essential for real-time tracking
-- - POD fields: Required for delivery proof
