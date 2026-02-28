-- Migration 023: Per-carrier API timeout configuration
-- Allows each carrier to have its own timeout instead of a single global env var.
-- Default 15 000 ms; hard-capped at 45 000 ms by the application layer.

ALTER TABLE carriers
  ADD COLUMN IF NOT EXISTS api_timeout_ms INTEGER
    DEFAULT 15000
    CHECK (api_timeout_ms BETWEEN 1000 AND 45000);

COMMENT ON COLUMN carriers.api_timeout_ms IS
  'Per-carrier HTTP timeout in milliseconds for outbound quote/tracking API calls. '
  'NULL means use the application default (DEFAULT_CARRIER_API_TIMEOUT_MS). '
  'Value is capped to 45 000 ms in the application layer.';
