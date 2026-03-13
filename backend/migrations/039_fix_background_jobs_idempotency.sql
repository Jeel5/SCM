-- Migration 039: Add missing unique partial index on background_jobs.idempotency_key
-- This is required for the ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL
-- used in JobsRepository.createJobIdempotent().

CREATE UNIQUE INDEX IF NOT EXISTS uq_background_jobs_idempotency_key
  ON background_jobs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
