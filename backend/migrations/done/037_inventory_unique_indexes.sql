-- Migration 037: Add missing unique indexes on inventory table
-- Fixes "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- on POST /api/inventory (and equivalent errors from shipment transfers and return stock upserts).
--
-- Three code paths do ON CONFLICT upserts against the inventory table:
--   1. InventoryRepository.createInventoryItem  → (warehouse_id, sku) WHERE sku IS NOT NULL
--   2. ShipmentRepository.upsertInventoryForTransfer → (warehouse_id, sku) WHERE sku IS NOT NULL
--   3. ReturnRepository.upsertInventoryStock        → (warehouse_id, product_id) WHERE product_id IS NOT NULL
--
-- NULL-safe partial indexes are used so that rows with NULL sku / product_id
-- are not incorrectly constrained against each other.

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_warehouse_sku
  ON inventory (warehouse_id, sku)
  WHERE sku IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_warehouse_product
  ON inventory (warehouse_id, product_id)
  WHERE product_id IS NOT NULL;
