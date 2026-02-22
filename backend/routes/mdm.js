// Master Data Management routes - warehouses, carriers, products, policies
import express from 'express';
import { 
  listWarehouses, getWarehouse, createWarehouse, updateWarehouse, deleteWarehouse,
  getWarehouseStats, getWarehouseInventory,
  listCarriers, getCarrier, createCarrier,
  listProducts, createProduct, updateProduct, deleteProduct,
  listSlaPolicies, listRateCards
} from '../controllers/mdmController.js';
import { authenticate } from '../middlewares/auth.js';
import { injectOrgContext } from '../middlewares/multiTenant.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import { 
  createWarehouseSchema, 
  updateWarehouseSchema, 
  listWarehousesQuerySchema, 
  warehouseInventoryQuerySchema 
} from '../validators/warehouseSchemas.js';

const router = express.Router();

// Warehouses
router.get('/warehouses', authenticate, injectOrgContext, validateQuery(listWarehousesQuerySchema), listWarehouses);
router.get('/warehouses/:id', authenticate, injectOrgContext, getWarehouse);
router.post('/warehouses', authenticate, injectOrgContext, validateRequest(createWarehouseSchema), createWarehouse);
router.put('/warehouses/:id', authenticate, injectOrgContext, validateRequest(updateWarehouseSchema), updateWarehouse);
router.delete('/warehouses/:id', authenticate, injectOrgContext, deleteWarehouse);
router.get('/warehouses/:id/stats', authenticate, injectOrgContext, getWarehouseStats);
router.get('/warehouses/:id/inventory', authenticate, injectOrgContext, validateQuery(warehouseInventoryQuerySchema), getWarehouseInventory);

// Carriers
// GET /carriers and GET /carriers/:id are public - needed by simulation/demo site and external carrier portals
router.get('/carriers', listCarriers);
router.get('/carriers/:id', getCarrier);
router.post('/carriers', authenticate, createCarrier);
router.get('/carriers/:carrierId/rates', authenticate, listRateCards);

// Products
router.get('/products', authenticate, injectOrgContext, listProducts);
router.post('/products', authenticate, injectOrgContext, createProduct);
router.put('/products/:id', authenticate, injectOrgContext, updateProduct);
router.delete('/products/:id', authenticate, injectOrgContext, deleteProduct);

// SLA Policies
router.get('/sla-policies', authenticate, listSlaPolicies);

export default router;
