-- Database schema changes to support full backend functionality
-- Run this file to add missing columns to existing tables

-- Add missing timestamp columns to sla_violations table
ALTER TABLE sla_violations 
ADD COLUMN IF NOT EXISTS violated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Update existing records to have violated_at set to created_at
UPDATE sla_violations 
SET violated_at = created_at 
WHERE violated_at IS NULL;

-- Update resolved records to have resolved_at
UPDATE sla_violations 
SET resolved_at = created_at 
WHERE status = 'resolved' AND resolved_at IS NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_sla_violations_violated_at ON sla_violations(violated_at);
CREATE INDEX IF NOT EXISTS idx_sla_violations_resolved_at ON sla_violations(resolved_at);

-- Verify changes
SELECT 'SLA Violations table updated successfully' as status;
