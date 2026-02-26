-- Migration 021: warehouse_metrics table + last_triggered_at on alert_rules
-- ─────────────────────────────────────────────────────────────────────────────
-- Covers:
--   TASK-R13-001  alert_rules.last_triggered_at — enables cooldown dedup query
--                 to filter by the column rather than scanning the alerts table
--   TASK-R13-012  warehouse_metrics — stores periodic warehouse utilisation
--                 snapshots for the analytics dashboard
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- TASK-R13-001: Track when each alert rule last fired
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ;

COMMENT ON COLUMN alert_rules.last_triggered_at IS
  'Updated by triggerAlert after a successful INSERT into alerts; '
  'enables fast O(1) cooldown check without scanning the alerts table (TASK-R13-001).';

-- ─────────────────────────────────────────────────────────────────────────────
-- TASK-R13-012: Warehouse metrics snapshots
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouse_metrics (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID         REFERENCES organizations(id) ON DELETE CASCADE,
  warehouse_id     UUID         NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  snapshot_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Utilisation
  capacity_total   INTEGER      NOT NULL DEFAULT 0,
  capacity_used    INTEGER      NOT NULL DEFAULT 0,
  utilisation_pct  NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN capacity_total > 0
         THEN ROUND(capacity_used::numeric / capacity_total * 100, 2)
         ELSE 0
    END
  ) STORED,

  -- Inventory counts
  sku_count        INTEGER      NOT NULL DEFAULT 0,
  total_units      INTEGER      NOT NULL DEFAULT 0,

  -- Throughput (period defaults to the rolling hour preceding the snapshot)
  inbound_units    INTEGER      NOT NULL DEFAULT 0,
  outbound_units   INTEGER      NOT NULL DEFAULT 0,

  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_metrics_warehouse_time
  ON warehouse_metrics (warehouse_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_warehouse_metrics_org_time
  ON warehouse_metrics (organization_id, snapshot_at DESC);

COMMENT ON TABLE warehouse_metrics IS
  'Periodic utilisation / throughput snapshots for each warehouse; '
  'used by the analytics dashboard (TASK-R13-012).';
