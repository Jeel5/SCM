-- Migration 035: Add pending email change staging columns and token_version to users
-- Required by settingsService.updateUserProfile (email staging),
-- settingsService.changePassword (token_version bump for JWT invalidation),
-- and usersController.deactivateUser (token_version bump).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pending_email         VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_change_token    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_change_expires  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_version         INTEGER NOT NULL DEFAULT 0;

-- Index token on email_change_token for O(1) verification lookups
CREATE INDEX IF NOT EXISTS idx_users_email_change_token
  ON users (email_change_token)
  WHERE email_change_token IS NOT NULL;
