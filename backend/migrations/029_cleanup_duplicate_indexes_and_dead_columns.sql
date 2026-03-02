-- Migration 029: Remove duplicate indexes and dead columns
-- ─────────────────────────────────────────────────────────────────────────────
-- Problem 1: Duplicate organisation_id indexes (each table had both
--   idx_*_org  AND  idx_*_organization_id pointing to the same column).
--   PostgreSQL only uses one; keeping both wastes memory and slows writes.
--
-- Problem 2: Dead columns never read or written by any application code:
--   • orders.supplier_name    – supplier_id FK is used; this varchar was not.
--   • shipments.awb_number    – domestic courier "AWB" ≡ carrier_tracking_number;
--                               carrier_tracking_number is the one used everywhere.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Drop duplicate indexes ────────────────────────────────────────────────

-- carriers: idx_carriers_org is kept (shorter name, same definition)
DROP INDEX IF EXISTS idx_carriers_organization_id;

-- orders: idx_orders_org is kept; idx_orders_status_org covers composite queries
DROP INDEX IF EXISTS idx_orders_organization_id;

-- shipments: idx_shipments_org is kept; idx_shipments_status_org covers composite
DROP INDEX IF EXISTS idx_shipments_organization_id;

-- inventory: only one org index exists, nothing to drop
-- carrier_assignments: only one org index (organization_id_fkey constraint index), nothing to drop

-- ── 2. Drop dead column: orders.supplier_name ────────────────────────────────
-- supplier_id (FK → organizations) is used for all supplier lookups.
-- supplier_name was a denormalised copy that was never populated or queried.

ALTER TABLE orders
  DROP COLUMN IF EXISTS supplier_name;

-- ── 3. Drop dead column: shipments.awb_number ────────────────────────────────
-- In the Indian domestic carrier context (Delhivery, BlueDart, etc.),
-- AWB = carrier tracking number.  The app uses carrier_tracking_number everywhere.
-- awb_number was never written or read by any application code.

ALTER TABLE shipments
  DROP COLUMN IF EXISTS awb_number;

-- ─────────────────────────────────────────────────────────────────────────────
-- Summary of net change:
--   Indexes removed : 3  (saves ~3 × 8 kB per-page overhead on writes)
--   Columns removed : 2  (orders.supplier_name, shipments.awb_number)
-- No data is lost — these columns were always NULL.
-- ─────────────────────────────────────────────────────────────────────────────
