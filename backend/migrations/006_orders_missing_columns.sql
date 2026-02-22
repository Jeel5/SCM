-- Migration 006: Add missing columns to orders table
-- The live DB was created before platform/customer_id were added to init.sql

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS platform VARCHAR(50),
  ADD COLUMN IF NOT EXISTS customer_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

COMMENT ON COLUMN orders.platform IS 'Source platform: amazon, shopify, ebay, website, api, manual';
COMMENT ON COLUMN orders.customer_id IS 'External customer ID from platform';
COMMENT ON COLUMN orders.payment_method IS 'Payment method: cod, prepaid, upi, card, netbanking';
