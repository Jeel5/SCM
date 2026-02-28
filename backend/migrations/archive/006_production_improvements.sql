-- Production improvements for two-phase quoting system

-- 1. Add analytics fields to carrier_quotes table
ALTER TABLE carrier_quotes 
ADD COLUMN IF NOT EXISTS response_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS was_retried BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS selection_reason VARCHAR(255);

-- 2. Add response_time_ms to carrier_rejections table
ALTER TABLE carrier_rejections
ADD COLUMN IF NOT EXISTS response_time_ms INTEGER;

-- 3. Create idempotency cache table
CREATE TABLE IF NOT EXISTS quote_idempotency_cache (
  idempotency_key VARCHAR(255) PRIMARY KEY,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index for cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_idempotency_expires 
ON quote_idempotency_cache(expires_at);

-- 4. Add shipping_locked to orders table (concurrency guard)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS shipping_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shipping_locked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS shipping_locked_by VARCHAR(255);

-- Index for locked orders
CREATE INDEX IF NOT EXISTS idx_orders_shipping_locked 
ON orders(shipping_locked) WHERE shipping_locked = true;

-- 5. Add current_load to carriers table (capacity management)
ALTER TABLE carriers
ADD COLUMN IF NOT EXISTS current_load INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_capacity INTEGER,
ADD COLUMN IF NOT EXISTS daily_capacity INTEGER;

-- 6. Create carrier_capacity_log table (track capacity over time)
CREATE TABLE IF NOT EXISTS carrier_capacity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id UUID REFERENCES carriers(id),
  capacity_snapshot INTEGER,
  max_capacity INTEGER,
  utilization_percent DECIMAL(5,2),
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_capacity_log_time 
ON carrier_capacity_log(carrier_id, logged_at DESC);

-- 7. Add confidence fields for Phase 1 estimates (stored for comparison)
CREATE TABLE IF NOT EXISTS shipping_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255),
  from_pincode VARCHAR(10),
  to_pincode VARCHAR(10),
  weight_kg DECIMAL(10,2),
  service_type VARCHAR(50),
  estimated_cost DECIMAL(10,2),
  min_cost DECIMAL(10,2),
  max_cost DECIMAL(10,2),
  confidence DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  order_id UUID REFERENCES orders(id),
  actual_cost DECIMAL(10,2),
  accuracy_percent DECIMAL(5,2)
);

-- Index for accuracy analysis
CREATE INDEX IF NOT EXISTS idx_shipping_estimates_order 
ON shipping_estimates(order_id) WHERE order_id IS NOT NULL;

-- 8. Clean up expired idempotency cache (run daily)
COMMENT ON TABLE quote_idempotency_cache IS 
'Auto-cleanup query: DELETE FROM quote_idempotency_cache WHERE expires_at < NOW() - INTERVAL ''1 day''';

-- 9. Add comments for analytics queries
COMMENT ON COLUMN carrier_quotes.response_time_ms IS 
'Response time in milliseconds. Useful for identifying slow carriers.';

COMMENT ON COLUMN carrier_quotes.was_retried IS 
'True if quote was obtained on retry attempt. Useful for reliability analysis.';

COMMENT ON COLUMN carrier_quotes.selection_reason IS 
'Why this carrier was selected: best_price, best_speed, best_balance, only_option, etc.';

COMMENT ON COLUMN carrier_rejections.response_time_ms IS 
'Response time before rejection. Null if timeout.';

-- 10. Useful analytics views

-- Carrier Performance View
CREATE OR REPLACE VIEW carrier_performance_summary AS
SELECT 
  c.name AS carrier_name,
  c.code AS carrier_code,
  COUNT(DISTINCT cq.order_id) AS total_quotes_given,
  AVG(cq.response_time_ms) AS avg_response_time_ms,
  COUNT(*) FILTER (WHERE cq.was_retried = true) AS retry_count,
  COUNT(*) FILTER (WHERE cq.is_selected = true) AS times_selected,
  ROUND(
    COUNT(*) FILTER (WHERE cq.is_selected = true)::DECIMAL /  
    NULLIF(COUNT(DISTINCT cq.order_id), 0) * 100, 
    2
  ) AS selection_rate_percent
FROM carriers c
LEFT JOIN carrier_quotes cq ON c.id = cq.carrier_id
GROUP BY c.id, c.name, c.code;

-- Carrier Rejection Analysis View
CREATE OR REPLACE VIEW carrier_rejection_analysis AS
SELECT 
  carrier_code,
  carrier_name,
  COUNT(*) AS total_rejections,
  COUNT(DISTINCT order_id) AS orders_rejected,
  reason,
  COUNT(*) AS rejection_count,
  ROUND(COUNT(*)::DECIMAL / SUM(COUNT(*)) OVER (PARTITION BY carrier_code) * 100, 2) AS percentage,
  AVG(response_time_ms) AS avg_response_time_ms
FROM carrier_rejections
GROUP BY carrier_code, carrier_name, reason
ORDER BY carrier_code, rejection_count DESC;

-- Estimate Accuracy View (after actual costs known)
CREATE OR REPLACE VIEW estimate_accuracy_analysis AS
SELECT 
  CASE 
    WHEN confidence >= 0.90 THEN 'Very High (90%+)'
    WHEN confidence >= 0.80 THEN 'High (80-90%)'
    WHEN confidence >= 0.70 THEN 'Medium (70-80%)'
    ELSE 'Low (<70%)'
  END AS confidence_range,
  COUNT(*) AS estimate_count,
  AVG(estimated_cost) AS avg_estimated,
  AVG(actual_cost) AS avg_actual,
  AVG(ABS(estimated_cost - actual_cost)) AS avg_difference,
  AVG(accuracy_percent) AS avg_accuracy_percent,
  COUNT(*) FILTER (WHERE ABS(estimated_cost - actual_cost) <= 50) AS within_50_rupees,
  ROUND(
    COUNT(*) FILTER (WHERE ABS(estimated_cost - actual_cost) <= 50)::DECIMAL / NULLIF(COUNT(*), 0) * 100,
    2
  ) AS within_50_percent
FROM shipping_estimates
WHERE actual_cost IS NOT NULL
GROUP BY 
  CASE 
    WHEN confidence >= 0.90 THEN 'Very High (90%+)'
    WHEN confidence >= 0.80 THEN 'High (80-90%)'
    WHEN confidence >= 0.70 THEN 'Medium (70-80%)'
    ELSE 'Low (<70%)'
  END
ORDER BY 
  CASE 
    WHEN CASE 
      WHEN confidence >= 0.90 THEN 'Very High (90%+)'
      WHEN confidence >= 0.80 THEN 'High (80-90%)'
      WHEN confidence >= 0.70 THEN 'Medium (70-80%)'
      ELSE 'Low (<70%)'
    END = 'Very High (90%+)' THEN 1
    WHEN CASE 
      WHEN confidence >= 0.90 THEN 'Very High (90%+)'
      WHEN confidence >= 0.80 THEN 'High (80-90%)'
      WHEN confidence >= 0.70 THEN 'Medium (70-80%)'
      ELSE 'Low (<70%)'
    END = 'High (80-90%)' THEN 2
    WHEN CASE 
      WHEN confidence >= 0.90 THEN 'Very High (90%+)'
      WHEN confidence >= 0.80 THEN 'High (80-90%)'
      WHEN confidence >= 0.70 THEN 'Medium (70-80%)'
      ELSE 'Low (<70%)'
    END = 'Medium (70-80%)' THEN 3
    ELSE 4
  END;

-- 11. Grant permissions (adjust as needed for your setup)
-- GRANT SELECT ON carrier_performance_summary TO readonly_user;
-- GRANT SELECT ON carrier_rejection_analysis TO readonly_user;
-- GRANT SELECT ON estimate_accuracy_analysis TO readonly_user;

-- Migration complete
SELECT 'Production improvements migration completed successfully' AS status;
