-- Dead Letter Queue for Failed Jobs
-- Migration: 005_dead_letter_queue.sql

CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_job_id UUID NOT NULL,
  job_type VARCHAR(100) NOT NULL,
  payload JSONB,
  priority INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  moved_to_dlq_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_queue_job_type ON dead_letter_queue(job_type);
CREATE INDEX IF NOT EXISTS idx_dead_letter_queue_created_at ON dead_letter_queue(created_at);

COMMENT ON TABLE dead_letter_queue IS 'Failed jobs that exceeded max retries';
COMMENT ON COLUMN dead_letter_queue.original_job_id IS 'ID of the original job in background_jobs';
COMMENT ON COLUMN dead_letter_queue.moved_to_dlq_at IS 'When the job was moved to dead letter queue';
