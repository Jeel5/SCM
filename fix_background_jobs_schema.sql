-- Fix background_jobs schema - increase column sizes
-- Run this to fix "value too long for type character varying(100)" error

-- Increase job_type column size
ALTER TABLE background_jobs 
ALTER COLUMN job_type TYPE VARCHAR(255);

-- Increase status column size (just in case)
ALTER TABLE background_jobs 
ALTER COLUMN status TYPE VARCHAR(100);

-- Add index on job_type for better performance
CREATE INDEX IF NOT EXISTS idx_background_jobs_job_type 
ON background_jobs(job_type);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ background_jobs schema updated successfully!';
  RAISE NOTICE '   - job_type: VARCHAR(100) → VARCHAR(255)';
  RAISE NOTICE '   - status: VARCHAR(50) → VARCHAR(100)';
  RAISE NOTICE '   - Added index on job_type';
END $$;
