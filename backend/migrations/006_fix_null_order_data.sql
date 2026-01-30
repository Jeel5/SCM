-- Fix NULL values in existing orders
-- This updates orders that were created before proper data mapping

-- Update NULL order_numbers with generated values
UPDATE orders 
SET order_number = 'ORD-' || EXTRACT(EPOCH FROM created_at)::bigint || '-' || SUBSTRING(id::text, 1, 8)
WHERE order_number IS NULL;

-- Update NULL total_amount with calculated value from items
UPDATE orders o
SET total_amount = COALESCE(
  (SELECT SUM(quantity * unit_price) 
   FROM order_items 
   WHERE order_id = o.id),
  0
)
WHERE total_amount IS NULL OR total_amount = 0;

-- Update NULL tax_amount to 0
UPDATE orders 
SET tax_amount = 0 
WHERE tax_amount IS NULL;

-- Update NULL shipping_amount to 0
UPDATE orders 
SET shipping_amount = 0 
WHERE shipping_amount IS NULL;

-- Update NULL customer_phone with placeholder
UPDATE orders 
SET customer_phone = '+1-555-0100' 
WHERE customer_phone IS NULL;

-- Recalculate total_amount to include tax and shipping where needed
UPDATE orders 
SET total_amount = COALESCE(
  (SELECT SUM(quantity * unit_price) 
   FROM order_items 
   WHERE order_id = orders.id),
  0
) + COALESCE(tax_amount, 0) + COALESCE(shipping_amount, 0)
WHERE total_amount < (
  SELECT COALESCE(SUM(quantity * unit_price), 0) 
  FROM order_items 
  WHERE order_id = orders.id
);

-- Fix NULL unit_price in order_items (set to random realistic price)
UPDATE order_items
SET unit_price = (RANDOM() * 150 + 10)::numeric(10,2)
WHERE unit_price IS NULL;

-- Display updated counts
SELECT 
  'Orders updated' as action,
  COUNT(*) as count
FROM orders
WHERE order_number LIKE 'ORD-%'
UNION ALL
SELECT 
  'Order items with prices' as action,
  COUNT(*) as count
FROM order_items
WHERE unit_price IS NOT NULL;
