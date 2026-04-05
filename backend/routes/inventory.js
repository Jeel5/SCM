// Inventory routes — all require authentication and inventory permissions
import express from 'express';
import {
  getInventory,
  getInventoryItem,
  getInventoryStats,
  getLowStockItems,
  getRestockOrders,
  createInventoryItem,
  updateInventoryItem,
  adjustStock,
  getStockMovements,
  transferInventory
} from '../controllers/inventoryController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import {
  createInventorySchema,
  updateInventorySchema,
  adjustInventorySchema,
  transferInventorySchema,
  listInventoryQuerySchema
} from '../validators/inventorySchemas.js';
import { validateUUIDParams } from '../middlewares/validateParams.js';

const router = express.Router();

// ── READ ────────────────────────────────────────────────────────────────────

// List inventory (with filters + pagination)
router.get(
  '/inventory',
  authenticate, authorize('inventory.view'),
  validateQuery(listInventoryQuerySchema),
  getInventory
);

// Aggregate stats for dashboard / warehouse view
router.get(
  '/inventory/stats',
  authenticate, authorize('inventory.view'),
  getInventoryStats
);

// All items at or below reorder_point
router.get(
  '/inventory/low-stock',
  authenticate, authorize('inventory.view'),
  getLowStockItems
);

router.get(
  '/inventory/restock-orders',
  authenticate, authorize('inventory.view'),
  getRestockOrders
);

// Single inventory item (must come AFTER static routes like /stats, /low-stock)
router.get(
  '/inventory/:id',
  authenticate, authorize('inventory.view'),
  validateUUIDParams,
  getInventoryItem
);

// Stock movement history for one item
router.get(
  '/inventory/:id/movements',
  authenticate, authorize('inventory.view'),
  validateUUIDParams,
  getStockMovements
);

// ── WRITE ───────────────────────────────────────────────────────────────────

// Create new inventory record (or upsert via unique idx)
router.post(
  '/inventory',
  authenticate, authorize('inventory.create'),
  validateRequest(createInventorySchema),
  createInventoryItem
);

// Transfer stock between warehouses (simple, no order created)
router.post(
  '/inventory/transfer',
  authenticate, authorize('inventory.update'),
  validateRequest(transferInventorySchema),
  transferInventory
);

// Adjust stock (add / remove / set / damaged)
router.post(
  '/inventory/:id/adjust',
  authenticate, authorize('inventory.update'),
  validateUUIDParams,
  validateRequest(adjustInventorySchema),
  adjustStock
);

// Update metadata (thresholds, unit_cost)
router.put(
  '/inventory/:id',
  authenticate, authorize('inventory.update'),
  validateUUIDParams,
  validateRequest(updateInventorySchema),
  updateInventoryItem
);

export default router;
  