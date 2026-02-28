-- Migration 020: User security hardening
-- TASK-R8-002: updatePassword now revokes all existing sessions (handled in service layer)
-- TASK-R8-003: deactivate() now revokes all existing sessions (handled in controller/service)
-- This migration adds token_version for future stateless revocation support and ensures
-- the jti column exists on user_sessions (needed for bulk session revocation).

-- Add token_version to users table for stateless revocation fallback
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

-- Ensure user_sessions has a jti column to support bulk revocation
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS jti VARCHAR(36);

-- Ensure revoked_tokens.jti has a unique constraint (for ON CONFLICT DO NOTHING)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_revoked_tokens_jti' AND conrelid = 'revoked_tokens'::regclass
  ) THEN
    ALTER TABLE revoked_tokens ADD CONSTRAINT uq_revoked_tokens_jti UNIQUE (jti);
  END IF;
END $$;

-- Index to quickly look up active sessions for a user (used in bulk revocation)
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
  ON user_sessions (user_id)
  WHERE is_active = true;

COMMENT ON COLUMN users.token_version IS 'Incremented on password change or deactivation to invalidate all existing JWTs if stateless revocation is needed';
COMMENT ON COLUMN user_sessions.jti IS 'JWT ID (jti claim) for the access token tied to this session — enables immediate blocklisting';
