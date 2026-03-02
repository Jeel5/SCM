-- Migration 033: Enhance sla_policies with carrier/zone/threshold fields
-- and add missing penalty tracking columns to sla_violations
-- Date: 2026-03-02

BEGIN;

-- ─── sla_policies: add carrier, zone, and warning threshold ──────────────────

-- carrier_id: NULL means policy applies to all carriers
ALTER TABLE sla_policies
  ADD COLUMN IF NOT EXISTS carrier_id UUID REFERENCES carriers(id) ON DELETE SET NULL;

-- origin/destination zone types for zone-based SLA matching
ALTER TABLE sla_policies
  ADD COLUMN IF NOT EXISTS origin_zone_type VARCHAR(20)
    CHECK (origin_zone_type IS NULL OR origin_zone_type IN ('local', 'metro', 'regional', 'national', 'remote'));

ALTER TABLE sla_policies
  ADD COLUMN IF NOT EXISTS destination_zone_type VARCHAR(20)
    CHECK (destination_zone_type IS NULL OR destination_zone_type IN ('local', 'metro', 'regional', 'national', 'remote'));

-- warning_threshold_percent: % of transit time elapsed before raising a warning
ALTER TABLE sla_policies
  ADD COLUMN IF NOT EXISTS warning_threshold_percent INTEGER DEFAULT 80
    CHECK (warning_threshold_percent BETWEEN 1 AND 100);

-- ─── sla_violations: add missing penalty tracking columns ─────────────────────

ALTER TABLE sla_violations
  ADD COLUMN IF NOT EXISTS penalty_applied BOOLEAN DEFAULT FALSE;

ALTER TABLE sla_violations
  ADD COLUMN IF NOT EXISTS penalty_calculated_at TIMESTAMPTZ;

ALTER TABLE sla_violations
  ADD COLUMN IF NOT EXISTS penalty_approved_by UUID REFERENCES users(id) ON DELETE SET NULL;

COMMIT;
