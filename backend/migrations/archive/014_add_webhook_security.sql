-- Migration: Add Webhook Security Fields
-- Purpose: Implement HMAC signature verification for webhooks (Industry Standard)
-- Date: 2026-02-18
-- Security: Prevents unauthorized webhook requests and request forgery

-- Step 1: Add webhook security fields to carriers table
ALTER TABLE carriers 
  ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(255),        -- Their secret (for verifying their webhooks to us)
  ADD COLUMN IF NOT EXISTS our_client_id VARCHAR(100),         -- Our ID (for authenticating to their API)
  ADD COLUMN IF NOT EXISTS our_client_secret VARCHAR(255),     -- Our secret (for signing our requests to them)
  ADD COLUMN IF NOT EXISTS ip_whitelist JSONB,                 -- Optional: Their allowed IPs
  ADD COLUMN IF NOT EXISTS webhook_events TEXT[],              -- Which events they subscribe to
  ADD COLUMN IF NOT EXISTS webhook_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN carriers.webhook_secret IS 'Shared secret for HMAC-SHA256 signature verification (carrier signs their webhooks)';
COMMENT ON COLUMN carriers.our_client_id IS 'Our client ID for authenticating with carrier API';
COMMENT ON COLUMN carriers.our_client_secret IS 'Our secret for signing requests to carrier API';
COMMENT ON COLUMN carriers.ip_whitelist IS 'Array of allowed IP addresses for webhook requests';
COMMENT ON COLUMN carriers.webhook_events IS 'Array of webhook event types carrier subscribes to';

-- Step 2: Create webhook logs table for audit trail
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id UUID REFERENCES carriers(id),
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) DEFAULT 'POST',
  -- Request details
  request_signature TEXT,
  request_timestamp BIGINT,
  signature_valid BOOLEAN,
  ip_address INET,
  user_agent TEXT,
  -- Payload
  payload JSONB,
  headers JSONB,
  -- Response
  response_status INT,
  response_body JSONB,
  error_message TEXT,
  -- Processing
  processing_time_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_carrier ON webhook_logs(carrier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_signature_valid ON webhook_logs(signature_valid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_endpoint ON webhook_logs(endpoint, created_at DESC);

COMMENT ON TABLE webhook_logs IS 'Audit trail for all webhook requests (authenticated and rejected)';

-- Step 3: Generate webhook secrets for existing carriers
-- Simple secrets for demo (in production, use crypto.randomBytes(32).toString('hex'))
UPDATE carriers 
SET webhook_secret = 'whsec_' || LOWER(code) || '_' || MD5(RANDOM()::TEXT),
    our_client_id = 'scm_client_' || id::TEXT,
    our_client_secret = 'scm_secret_' || MD5(RANDOM()::TEXT),
    webhook_events = ARRAY['shipment.pickup', 'shipment.in_transit', 'shipment.delivered', 'shipment.exception'],
    webhook_enabled = true
WHERE webhook_secret IS NULL;

-- Step 4: Function to generate new webhook secret
CREATE OR REPLACE FUNCTION generate_webhook_credentials()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.webhook_secret IS NULL THEN
    NEW.webhook_secret := 'whsec_' || LOWER(NEW.code) || '_' || MD5(RANDOM()::TEXT);
  END IF;
  IF NEW.our_client_id IS NULL THEN
    NEW.our_client_id := 'scm_client_' || NEW.id::TEXT;
  END IF;
  IF NEW.our_client_secret IS NULL THEN
    NEW.our_client_secret := 'scm_secret_' || MD5(RANDOM()::TEXT);
  END IF;
  IF NEW.webhook_events IS NULL THEN
    NEW.webhook_events := ARRAY['shipment.pickup', 'shipment.in_transit', 'shipment.delivered', 'shipment.exception'];
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Trigger to auto-generate credentials for new carriers
DROP TRIGGER IF EXISTS carrier_webhook_credentials_trigger ON carriers;
CREATE TRIGGER carrier_webhook_credentials_trigger
  BEFORE INSERT ON carriers
  FOR EACH ROW
  EXECUTE FUNCTION generate_webhook_credentials();

-- Step 6: View for carrier webhook configuration
CREATE OR REPLACE VIEW carrier_webhook_config AS
SELECT 
  id,
  code,
  name,
  webhook_secret,
  our_client_id,
  webhook_events,
  webhook_enabled,
  ip_whitelist,
  created_at
FROM carriers
WHERE webhook_enabled = true;

COMMENT ON VIEW carrier_webhook_config IS 'Webhook configuration for active carriers';
