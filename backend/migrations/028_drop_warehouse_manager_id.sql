-- Migration 028: Drop manager_id from warehouses
-- manager_id is out of scope for SCM — warehouse management does not require
-- linking a user account to a warehouse in this system.

ALTER TABLE warehouses DROP COLUMN IF EXISTS manager_id;
