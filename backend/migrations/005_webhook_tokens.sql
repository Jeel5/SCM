-- Migration 005: Add webhook_token to organizations for per-org webhook routing
-- This allows each organization to have a unique webhook URL:
--   POST /api/webhooks/:orgToken/orders
--   POST /api/webhooks/:orgToken/inventory
--   POST /api/webhooks/:orgToken/returns
-- Without a token, webhooks land with organization_id = NULL (demo/testing only)

-- pgcrypto is required for gen_random_bytes()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add webhook_token column (unique, auto-generated per org)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS webhook_token VARCHAR(64) UNIQUE DEFAULT NULL;

-- Populate existing organizations with secure random tokens
-- Uses gen_random_bytes for cryptographically secure tokens
UPDATE organizations
SET webhook_token = encode(gen_random_bytes(32), 'hex')
WHERE webhook_token IS NULL;

-- Add NOT NULL + default for future inserts
ALTER TABLE organizations
  ALTER COLUMN webhook_token SET DEFAULT encode(gen_random_bytes(32), 'hex');

-- Index for fast lookup by token (webhook hot path)
CREATE INDEX IF NOT EXISTS idx_organizations_webhook_token
  ON organizations(webhook_token);

COMMENT ON COLUMN organizations.webhook_token IS
  'Secret token for org-scoped webhook URLs. Used in /api/webhooks/:token/orders etc.';
