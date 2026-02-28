-- Migration: Create carrier_rejections table to track when carriers reject shipments
-- This helps analyze carrier performance and identify patterns

CREATE TABLE IF NOT EXISTS carrier_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  carrier_name VARCHAR(255) NOT NULL,
  carrier_code VARCHAR(50) NOT NULL,
  reason VARCHAR(100) NOT NULL,
  message TEXT,
  rejected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_carrier_rejections_order_id ON carrier_rejections(order_id);
CREATE INDEX idx_carrier_rejections_carrier_code ON carrier_rejections(carrier_code);
CREATE INDEX idx_carrier_rejections_reason ON carrier_rejections(reason);
CREATE INDEX idx_carrier_rejections_rejected_at ON carrier_rejections(rejected_at);

-- Comments
COMMENT ON TABLE carrier_rejections IS 'Tracks when carriers reject shipment requests with reasons';
COMMENT ON COLUMN carrier_rejections.reason IS 'Rejection reason: at_capacity, weight_exceeded, route_not_serviceable, no_cold_storage, api_error';
COMMENT ON COLUMN carrier_rejections.message IS 'Detailed message from carrier explaining rejection';

-- Sample rejection reasons:
-- at_capacity: Carrier is at maximum capacity
-- weight_exceeded: Package weight exceeds carrier limit
-- route_not_serviceable: Carrier doesn't service this route
-- no_cold_storage: Cold storage required but not available
-- no_fragile_handling: Fragile handling required but not available
-- api_error: Carrier API failed or timed out
-- invalid_address: Delivery address incomplete or invalid
-- restricted_item: Item type restricted by carrier
