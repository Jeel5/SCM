-- Migration 009: Alert cooldown dedup + miscellaneous fixes (TASK-R13-001)

-- Add cooldown_minutes to alert_rules so each rule can configure its own cooldown window.
-- Default 60 minutes means the same rule won't fire again within an hour.
ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS cooldown_minutes INTEGER NOT NULL DEFAULT 60;

-- Index to speed up the dedup query: "unreacted alerts for rule X in the last N minutes"
CREATE INDEX IF NOT EXISTS idx_alerts_rule_triggered
  ON alerts (rule_id, triggered_at DESC);
