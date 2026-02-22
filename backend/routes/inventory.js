// Inventory routes — all require authentication and inventory permissions
import express from 'express';
import {
  getInventory,
  getInventoryItem,
  getInventoryStats,
  getLowStockItems,
  createInventoryItem,
  updateInventoryItem,
  adjustStock,
  getStockMovements,
  transferInventory
} from '../controllers/inventoryController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
import { injectOrgContext } from '../middlewares/multiTenant.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import {
  createInventorySchema,
  updateInventorySchema,
  adjustInventorySchema,
  transferInventorySchema,
  listInventoryQuerySchema
} from '../validators/inventorySchemas.js';

const router = express.Router();

// ── READ ────────────────────────────────────────────────────────────────────

// List inventory (with filters + pagination)
router.get(
  '/inventory',
  authenticate, injectOrgContext, authorize('inventory:read'),
  validateQuery(listInventoryQuerySchema),
  getInventory
);

// Aggregate stats for dashboard / warehouse view
router.get(
  '/inventory/stats',
  authenticate, injectOrgContext, authorize('inventory:read'),
  getInventoryStats
);

// All items at or below reorder_point
router.get(
  '/inventory/low-stock',
  authenticate, injectOrgContext, authorize('inventory:read'),
  getLowStockItems
);

// Single inventory item (must come AFTER static routes like /stats, /low-stock)
router.get(
  '/inventory/:id',
  authenticate, injectOrgContext, authorize('inventory:read'),
  getInventoryItem
);

// Stock movement history for one item
router.get(
  '/inventory/:id/movements',
  authenticate, injectOrgContext, authorize('inventory:read'),
  getStockMovements
);

// ── WRITE ───────────────────────────────────────────────────────────────────

// Create new inventory record (or upsert via unique idx)
router.post(
  '/inventory',
  authenticate, injectOrgContext, authorize('inventory:create'),
  validateRequest(createInventorySchema),
  createInventoryItem
);

// Transfer stock between warehouses (simple, no order created)
router.post(
  '/inventory/transfer',
  authenticate, injectOrgContext, authorize('inventory:update'),
  validateRequest(transferInventorySchema),
  transferInventory
);

// Adjust stock (add / remove / set / damaged)
router.post(
  '/inventory/:id/adjust',
  authenticate, injectOrgContext, authorize('inventory:update'),
  validateRequest(adjustInventorySchema),
  adjustStock
);

// Update metadata (bin_location, zone, thresholds)
router.put(
  '/inventory/:id',
  authenticate, injectOrgContext, authorize('inventory:update'),
  validateRequest(updateInventorySchema),
  updateInventoryItem
);

export default router;
