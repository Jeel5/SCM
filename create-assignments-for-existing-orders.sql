-- ================================================================================
-- Create carrier assignments for existing orders that don't have any
-- ================================================================================
-- This script finds orders without carrier assignments and creates them
-- Run this once to retroactively assign carriers to old orders

-- Create assignments for orders without any carrier assignments
INSERT INTO carrier_assignments (
  order_id, 
  carrier_id, 
  service_type, 
  status, 
  request_payload, 
  requested_at, 
  expires_at
)
SELECT 
  o.id as order_id,
  c.id as carrier_id,
  COALESCE(o.priority, 'standard') as service_type,
  'pending' as status,
  jsonb_build_object(
    'orderId', o.id,
    'orderNumber', o.order_number,
    'customerName', o.customer_name,
    'totalAmount', o.total_amount,
    'shippingAddress', o.shipping_address,
    'priority', o.priority
  ) as request_payload,
  NOW() as requested_at,
  NOW() + INTERVAL '24 hours' as expires_at
FROM orders o
CROSS JOIN LATERAL (
  -- Get top 3 carriers for this order's service type
  SELECT id 
  FROM carriers 
  WHERE is_active = true 
  AND (service_type = COALESCE(o.priority, 'standard') OR service_type = 'all')
  ORDER BY reliability_score DESC, RANDOM()
  LIMIT 3
) c
WHERE o.status IN ('pending', 'confirmed', 'processing')
AND NOT EXISTS (
  -- Don't create if assignments already exist
  SELECT 1 FROM carrier_assignments ca WHERE ca.order_id = o.id
);

-- Show what was created
SELECT 
  o.order_number,
  c.code as carrier_code,
  ca.service_type,
  ca.status,
  ca.expires_at
FROM carrier_assignments ca
JOIN orders o ON ca.order_id = o.id
JOIN carriers c ON ca.carrier_id = c.id
ORDER BY ca.created_at DESC
LIMIT 20;
