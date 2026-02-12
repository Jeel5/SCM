-- Migration: Add idempotency key to carrier_assignments for preventing duplicate API calls
-- This ensures that if carrier assignment request is retried, we don't create duplicate assignments

ALTER TABLE carrier_assignments 
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255) UNIQUE;

-- Create index for fast lookup by idempotency key
CREATE INDEX IF NOT EXISTS idx_carrier_assignments_idempotency_key 
ON carrier_assignments(idempotency_key);

-- Add comment
COMMENT ON COLUMN carrier_assignments.idempotency_key IS 'Unique key to prevent duplicate carrier assignment requests. Format: {orderId}-carrier-{carrierId}-{timestamp}';
