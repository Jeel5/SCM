ALTER TABLE sla_policies
  DROP COLUMN IF EXISTS origin_zone_type,
  DROP COLUMN IF EXISTS destination_zone_type;