-- Migration 044: Add customer invoices support
-- Extends invoices table to support both customer invoices (FROM us TO customers)
-- and carrier invoices (FROM carriers TO us)

-- Add invoice_type column to distinguish customer vs carrier invoices
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(50) DEFAULT 'carrier'::character varying NOT NULL;

-- Add customer_id column for customer invoices
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS customer_id UUID NULL;

-- Add order_id column for linking to orders
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS order_id UUID NULL;

-- Add constraint to ensure at least one of carrier_id or customer_id is present
ALTER TABLE public.invoices 
DROP CONSTRAINT IF EXISTS invoices_invoice_type_check CASCADE;

ALTER TABLE public.invoices 
ADD CONSTRAINT invoices_invoice_type_check CHECK (
  (invoice_type::text = ANY (ARRAY['customer'::character varying, 'carrier'::character varying]::text[]))
);

-- Update existing invoices to be marked as carrier invoices
UPDATE public.invoices 
SET invoice_type = 'carrier' 
WHERE invoice_type IS NULL OR invoice_type = 'carrier';

-- Add index for customer lookups
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices USING btree (customer_id) 
WHERE (customer_id IS NOT NULL AND invoice_type = 'customer');

-- Add index for order lookups
CREATE INDEX IF NOT EXISTS idx_invoices_order ON public.invoices USING btree (order_id) 
WHERE (order_id IS NOT NULL);

-- Add comment
COMMENT ON COLUMN public.invoices.invoice_type IS 'customer = FROM us TO customer; carrier = FROM carrier TO us';
COMMENT ON COLUMN public.invoices.customer_id IS 'Reference to customer for customer invoices (NULL for carrier invoices)';
COMMENT ON COLUMN public.invoices.order_id IS 'Reference to order for traceability';
