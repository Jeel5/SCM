-- 007_carrier_status_normalization.sql
-- Normalize carrier availability statuses:
-- 1) Treat legacy 'maintenance' as 'available'
-- 2) Add explicit 'suspended' for admin-side operational block

BEGIN;

-- Normalize existing data before tightening constraint
UPDATE public.carriers
SET availability_status = 'available'
WHERE availability_status = 'maintenance';

ALTER TABLE public.carriers
  DROP CONSTRAINT IF EXISTS carriers_availability_status_check;

ALTER TABLE public.carriers
  ADD CONSTRAINT carriers_availability_status_check
  CHECK (
    availability_status IN ('available', 'busy', 'offline', 'suspended')
  );

COMMIT;
