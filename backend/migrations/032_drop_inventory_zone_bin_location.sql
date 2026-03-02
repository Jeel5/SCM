-- Migration 032: Drop zone and bin_location from inventory
-- These fields were never enforced (no zone-based capacity tracking, no bin validation).
-- They were display-only optional strings with no operational effect in this SCM scope.
-- Nullify any existing data first, then drop the columns cleanly.

ALTER TABLE inventory
  DROP COLUMN IF EXISTS zone,
  DROP COLUMN IF EXISTS bin_location;
