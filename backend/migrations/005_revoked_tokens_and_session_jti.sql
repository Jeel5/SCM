-- Migration 005: Add revoked_tokens table and jti column to user_sessions
-- Required by auth middleware (isTokenRevoked) and logout/session management

-- JWT blocklist: stores revoked JTIs so stolen tokens can't be reused
CREATE TABLE IF NOT EXISTS revoked_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jti VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE revoked_tokens IS 'Blocklist of revoked JWT tokens (by JTI) for immediate invalidation';

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti ON revoked_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expires_at);

-- Add jti column to user_sessions so we can link sessions to JWT IDs
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS jti VARCHAR(255);
