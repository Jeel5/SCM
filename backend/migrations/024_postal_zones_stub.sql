-- ⚠️  NOT_PRODUCTION_READY — postal zone stub
--
-- The current codebase approximates shipping zones by comparing the first three
-- digits of a pincode (see ConfidenceCalculator.calculate in shippingHelpers.js
-- and estimateDistanceFromPincode in shippingUtils.js).  This is purely a
-- development placeholder.  Before going to production, apply the real data or
-- integrate a pincode-to-zone API and replace both call-sites.
--
-- This migration creates the target schema so application code can be switched
-- to a proper lookup without a second DDL change.

CREATE TABLE IF NOT EXISTS postal_zones (
  id             SERIAL       PRIMARY KEY,
  pincode        VARCHAR(10)  NOT NULL UNIQUE,
  zone_code      VARCHAR(10)  NOT NULL,  -- e.g. 'Z1', 'METRO', 'NORTH-EAST'
  city           VARCHAR(100),
  state          VARCHAR(100),
  country        CHAR(2)      NOT NULL DEFAULT 'IN',
  lat            NUMERIC(9, 6),
  lon            NUMERIC(9, 6),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_postal_zones_zone_code ON postal_zones (zone_code);

-- Zone-pair distance lookup (replaces the hard-coded 50 / 300 / 800 km buckets)
CREATE TABLE IF NOT EXISTS zone_distances (
  id             SERIAL       PRIMARY KEY,
  from_zone      VARCHAR(10)  NOT NULL,
  to_zone        VARCHAR(10)  NOT NULL,
  distance_km    INTEGER      NOT NULL,
  transit_days   INTEGER,
  UNIQUE (from_zone, to_zone)
);

COMMENT ON TABLE postal_zones   IS 'NOT_PRODUCTION_READY: table is empty until seeded with real pincode data.';
COMMENT ON TABLE zone_distances IS 'NOT_PRODUCTION_READY: table is empty until seeded with carrier zone matrices.';
