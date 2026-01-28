// Inventory routes - all require authentication and inventory permissions
import express from 'express';
import { getInventory, getInventoryItem, adjustStock, getStockMovements } from '../controllers/inventoryController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import { 
  adjustInventorySchema,
  listInventoryQuerySchema 
} from '../validators/inventorySchemas.js';

const router = express.Router();

router.get('/inventory', authenticate, authorize('inventory:read'), validateQuery(listInventoryQuerySchema), getInventory);
router.get('/inventory/:id', authenticate, authorize('inventory:read'), getInventoryItem);
router.post('/inventory/:id/adjust', authenticate, authorize('inventory:update'), validateRequest(adjustInventorySchema), adjustStock);
router.get('/inventory/:id/movements', authenticate, authorize('inventory:read'), getStockMovements);

export default router;
