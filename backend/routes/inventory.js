import express from 'express';
import { getInventory, getInventoryItem, adjustStock, getStockMovements } from '../controllers/inventoryController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.get('/inventory', authenticate, getInventory);
router.get('/inventory/:id', authenticate, getInventoryItem);
router.post('/inventory/:id/adjust', authenticate, adjustStock);
router.get('/inventory/:id/movements', authenticate, getStockMovements);

export default router;
