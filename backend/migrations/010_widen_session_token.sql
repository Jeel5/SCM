-- Migration 010: widen session_token / refresh_token from varchar(500) to text
-- varchar(500) overflows when JWTs carry impersonation metadata payloads

BEGIN;

ALTER TABLE user_sessions
  ALTER COLUMN session_token TYPE text,
  ALTER COLUMN refresh_token TYPE text;

COMMIT;
