-- Migration 022: carrier_capacity table
-- Replaces Math.random() capacity simulation (TASK-R12-017) with a real capacity
-- tracking table that records how many shipments each carrier has accepted today,
-- and automatically flips carriers.availability_status when the daily limit is reached.
--
-- Prerequisite columns already added by migration 006:
--   carriers.max_capacity        (total fleet capacity)
--   carriers.daily_capacity      (max shipments per day)
--   carrier_capacity_log         (historical capacity snapshots)

-- ─── carrier_capacity ─────────────────────────────────────────────────────────
-- One row per carrier per calendar day.  Background job inserts the row for
-- today (or resets used_shipments=0) at midnight, then increments used_shipments
-- each time a new carrier_assignment is created for that carrier.
CREATE TABLE IF NOT EXISTS carrier_capacity (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id          UUID         NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
  capacity_date       DATE         NOT NULL DEFAULT CURRENT_DATE,
  used_shipments      INTEGER      NOT NULL DEFAULT 0 CHECK (used_shipments >= 0),
  max_daily_shipments INTEGER      NOT NULL DEFAULT 100 CHECK (max_daily_shipments > 0),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_carrier_capacity_date UNIQUE (carrier_id, capacity_date)
);

CREATE INDEX IF NOT EXISTS idx_carrier_capacity_carrier_date
  ON carrier_capacity (carrier_id, capacity_date DESC);

-- ─── Auto-update carriers.availability_status ────────────────────────────────
-- Trigger fires whenever a carrier_capacity row is inserted or updated.
-- - If used_shipments reaches max_daily_shipments → set availability_status = 'at_capacity'
-- - If used_shipments drops below max_daily_shipments after being full → restore 'available'
--   (covers manual corrections and end-of-day resets)
CREATE OR REPLACE FUNCTION fn_sync_carrier_availability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.used_shipments >= NEW.max_daily_shipments THEN
    UPDATE carriers
    SET availability_status = 'at_capacity', updated_at = NOW()
    WHERE id = NEW.carrier_id
      AND availability_status NOT IN ('suspended', 'maintenance', 'at_capacity');
  ELSE
    -- Capacity freed (e.g. midnight reset or manual correction)
    UPDATE carriers
    SET availability_status = 'available', updated_at = NOW()
    WHERE id = NEW.carrier_id
      AND availability_status = 'at_capacity';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_carrier_capacity_availability ON carrier_capacity;
CREATE TRIGGER trg_carrier_capacity_availability
  AFTER INSERT OR UPDATE OF used_shipments, max_daily_shipments
  ON carrier_capacity
  FOR EACH ROW EXECUTE FUNCTION fn_sync_carrier_availability();

-- ─── Helper: increment carrier capacity for today ────────────────────────────
-- Called by the carrier assignment creation code (or a future DB trigger on
-- carrier_assignments) to atomically record one more shipment accepted today.
-- Usage:  SELECT increment_carrier_capacity('<carrier_uuid>');
CREATE OR REPLACE FUNCTION increment_carrier_capacity(p_carrier_id UUID)
RETURNS carrier_capacity LANGUAGE plpgsql AS $$
DECLARE
  v_daily_cap  INTEGER;
  v_result     carrier_capacity;
BEGIN
  -- Look up the carrier's configured daily limit
  SELECT COALESCE(daily_capacity, 100)
  INTO v_daily_cap
  FROM carriers
  WHERE id = p_carrier_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Carrier % not found', p_carrier_id;
  END IF;

  -- Upsert: create today's row if it doesn't exist, then increment
  INSERT INTO carrier_capacity (carrier_id, capacity_date, used_shipments, max_daily_shipments)
  VALUES (p_carrier_id, CURRENT_DATE, 1, v_daily_cap)
  ON CONFLICT (carrier_id, capacity_date) DO UPDATE
    SET used_shipments = carrier_capacity.used_shipments + 1,
        updated_at     = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- ─── Helper: reset all carriers at the start of a new day ────────────────────
-- Called by cron job at 00:00 each day.
-- Inserts a fresh row (used_shipments=0) for every active carrier, or updates
-- the existing one if somehow it already exists for today (idempotent).
CREATE OR REPLACE FUNCTION reset_carrier_capacity_for_day()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO carrier_capacity (carrier_id, capacity_date, used_shipments, max_daily_shipments)
  SELECT
    id                                   AS carrier_id,
    CURRENT_DATE                         AS capacity_date,
    0                                    AS used_shipments,
    COALESCE(daily_capacity, 100)        AS max_daily_shipments
  FROM carriers
  WHERE is_active = true
  ON CONFLICT (carrier_id, capacity_date) DO UPDATE
    SET used_shipments      = 0,
        max_daily_shipments = EXCLUDED.max_daily_shipments,
        updated_at          = NOW();
END;
$$;

-- ─── Seed today's capacity rows for existing active carriers ─────────────────
-- Ensures the table has data immediately after migration runs.
INSERT INTO carrier_capacity (carrier_id, capacity_date, used_shipments, max_daily_shipments)
SELECT
  id,
  CURRENT_DATE,
  0,
  COALESCE(daily_capacity, 100)
FROM carriers
WHERE is_active = true
ON CONFLICT (carrier_id, capacity_date) DO NOTHING;
