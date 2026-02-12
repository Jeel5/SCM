-- Create tables needed for the demo
-- Run this if you haven't run migrations yet

-- Table to store carrier quotes (acceptances)
CREATE TABLE IF NOT EXISTS carrier_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(100) NOT NULL,
  carrier_id UUID REFERENCES carriers(id),
  quoted_price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  estimated_delivery_days INTEGER NOT NULL,
  estimated_delivery_date TIMESTAMPTZ,
  service_type VARCHAR(50),
  valid_until TIMESTAMPTZ,
  breakdown JSONB,
  is_selected BOOLEAN DEFAULT false,
  response_time_ms INTEGER,
  was_retried BOOLEAN DEFAULT false,
  selection_reason VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carrier_quotes_order_id ON carrier_quotes(order_id);
CREATE INDEX IF NOT EXISTS idx_carrier_quotes_carrier_id ON carrier_quotes(carrier_id);
CREATE INDEX IF NOT EXISTS idx_carrier_quotes_is_selected ON carrier_quotes(is_selected);

-- Table to store carrier rejections
CREATE TABLE IF NOT EXISTS carrier_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(100) NOT NULL,
  carrier_name VARCHAR(100) NOT NULL,
  carrier_code VARCHAR(50) NOT NULL,
  reason VARCHAR(100) NOT NULL,
  message TEXT,
  response_time_ms INTEGER,
  rejected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carrier_rejections_order_id ON carrier_rejections(order_id);
CREATE INDEX IF NOT EXISTS idx_carrier_rejections_carrier_code ON carrier_rejections(carrier_code);
CREATE INDEX IF NOT EXISTS idx_carrier_rejections_reason ON carrier_rejections(reason);

-- Insert demo carriers if they don't exist
INSERT INTO carriers (code, name, service_type, reliability_score, is_active, availability_status)
VALUES 
  ('DHL', 'DHL Express India', 'express', 0.92, true, 'available'),
  ('FEDEX', 'FedEx India', 'express', 0.88, true, 'available'),
  ('BLUEDART', 'Blue Dart', 'express', 0.85, true, 'available'),
  ('DELHIVERY', 'Delhivery', 'standard', 0.82, true, 'available')
ON CONFLICT (code) DO NOTHING;

-- Success message
SELECT 'Demo tables created successfully!' as message;
