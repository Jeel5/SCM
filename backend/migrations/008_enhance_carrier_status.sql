-- Migration: Enhance carrier assignment status management
-- Adds support for busy/expired statuses and carrier availability tracking

BEGIN;

-- Add availability status to carriers table
ALTER TABLE carriers 
ADD COLUMN IF NOT EXISTS availability_status VARCHAR(20) DEFAULT 'available',
ADD COLUMN IF NOT EXISTS last_status_change TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN carriers.availability_status IS 'Carrier availability: available, busy, offline';
COMMENT ON COLUMN carriers.last_status_change IS 'Timestamp of last availability status change';

-- Update carrier_assignments status to support more states
-- Note: Column already exists, just documenting valid values
COMMENT ON COLUMN carrier_assignments.status IS 'Assignment status: pending, assigned, accepted, rejected, busy, expired, cancelled';

-- Create index for carrier availability queries
CREATE INDEX IF NOT EXISTS idx_carriers_availability ON carriers(availability_status) WHERE is_active = true;

-- Create function to automatically update carrier last_status_change
CREATE OR REPLACE FUNCTION update_carrier_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.availability_status IS DISTINCT FROM NEW.availability_status THEN
    NEW.last_status_change = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for carrier status changes
DROP TRIGGER IF EXISTS carrier_status_update_trigger ON carriers;
CREATE TRIGGER carrier_status_update_trigger
  BEFORE UPDATE ON carriers
  FOR EACH ROW
  EXECUTE FUNCTION update_carrier_status_timestamp();

COMMIT;
