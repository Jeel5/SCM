-- Migration 045: Cleanup supplier fields and prepare for inbound tracking
-- Removes: website, payment_terms, lead_time_days, reliability_score
-- These fields are not essential for inbound order tracking

-- Drop constraints first
ALTER TABLE public.suppliers 
DROP CONSTRAINT IF EXISTS suppliers_reliability_score_check;

-- Drop columns
ALTER TABLE public.suppliers 
DROP COLUMN IF EXISTS website CASCADE;

ALTER TABLE public.suppliers 
DROP COLUMN IF EXISTS payment_terms CASCADE;

ALTER TABLE public.suppliers 
DROP COLUMN IF EXISTS lead_time_days CASCADE;

ALTER TABLE public.suppliers 
DROP COLUMN IF EXISTS reliability_score CASCADE;

-- Add api_endpoint for webhook support (for receiving shipment updates from supplier)
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS api_endpoint VARCHAR(500) NULL;

-- Add inbound_contact_name and email for order communication
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS inbound_contact_name VARCHAR(255) NULL;

ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS inbound_contact_email VARCHAR(255) NULL;

-- Index for api lookups (if supplier webhooks are implemented)
CREATE INDEX IF NOT EXISTS idx_suppliers_api_endpoint ON public.suppliers (api_endpoint) 
WHERE api_endpoint IS NOT NULL;

COMMENT ON COLUMN public.suppliers.api_endpoint IS 'Webhook endpoint for receiving inbound shipment status updates from supplier';
COMMENT ON COLUMN public.suppliers.inbound_contact_name IS 'Contact name for inbound order communication';
COMMENT ON COLUMN public.suppliers.inbound_contact_email IS 'Contact email for inbound order communication';
