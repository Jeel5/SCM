-- Migration 011: Token blocklist for JWT revocation + session-tied JTI

-- Stores revoked JWTs (by jti claim) until they expire
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti         UUID        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revoked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL  -- when the token would have expired anyway
);

-- Auto-cleanup: index lets a background job or scheduled DELETE remove expired rows
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens (expires_at);

-- Fast lookup during request authentication
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti ON revoked_tokens (jti);

-- Ensure the user_sessions table has a jti column for session revocation
ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS jti UUID;
