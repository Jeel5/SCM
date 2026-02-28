-- Migration 007: Email change verification (TASK-R17-004)
-- Prevents account takeover via stolen session by requiring
-- the user to verify ownership of the new email before it is applied.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pending_email          VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_change_token     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_change_expires   TIMESTAMPTZ;

-- Idempotency index: at most one pending change per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_change_token
  ON users (email_change_token)
  WHERE email_change_token IS NOT NULL;
