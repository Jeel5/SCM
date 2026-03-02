-- Migration 031: Drop daily_inbound_capacity and daily_outbound_capacity from warehouses
-- These fields were never enforced in any business logic (no capacity checks, no gate controls).
-- They were stored and displayed only — pure noise for an SCM system. Removing to keep the
-- schema honest and avoid misleading users about enforced limits.

ALTER TABLE warehouses
  DROP COLUMN IF EXISTS daily_inbound_capacity,
  DROP COLUMN IF EXISTS daily_outbound_capacity;
