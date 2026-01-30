-- Seed: Add carrier assignment retry cron job
-- Runs every 30 minutes to handle expired, busy, and rejected assignments

INSERT INTO cron_schedules (
  id,
  name,
  job_type,
  cron_expression,
  payload,
  is_active,
  next_run_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Carrier Assignment Retry',
  'carrier_assignment_retry',
  '*/30 * * * *', -- Every 30 minutes
  '{}',
  true,
  NOW() + INTERVAL '30 minutes',
  NOW(),
  NOW()
) ON CONFLICT (name) DO UPDATE SET
  cron_expression = EXCLUDED.cron_expression,
  next_run_at = EXCLUDED.next_run_at,
  updated_at = NOW();
