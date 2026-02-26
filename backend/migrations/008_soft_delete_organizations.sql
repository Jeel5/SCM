-- Migration 008: Soft-delete support for organizations (TASK-R9-003)
-- Adds audit trail columns so companies are never hard-deleted

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_deleted  BOOLEAN    NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by  UUID REFERENCES users(id) ON DELETE SET NULL;

-- Partial index speeds up the common query "WHERE is_deleted IS NOT TRUE"
CREATE INDEX IF NOT EXISTS idx_organizations_active
  ON organizations (id)
  WHERE is_deleted IS NOT TRUE;
