// Master Data Management routes - warehouses, carriers, products, policies
import express from 'express';
import { 
  listWarehouses, getWarehouse, createWarehouse, updateWarehouse, deleteWarehouse,
  getWarehouseStats, getWarehouseInventory,
  listCarriers, getCarrier, createCarrier, updateCarrier, deleteCarrier,
  listProducts, createProduct, updateProduct, deleteProduct,
  listSlaPolicies, listRateCards
} from '../controllers/mdmController.js';
import { authenticate } from '../middlewares/auth.js';
import { requirePermission, authorize } from '../middlewares/rbac.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import { 
  createWarehouseSchema, 
  updateWarehouseSchema, 
  listWarehousesQuerySchema, 
  warehouseInventoryQuerySchema 
} from '../validators/warehouseSchemas.js';
import {
  createCarrierSchema,
  updateCarrierSchema,
  createProductSchema,
  updateProductSchema
} from '../validators/mdmSchemas.js';
import { validateUUIDParams } from '../middlewares/validateParams.js';

const router = express.Router();

// Warehouses
router.get('/warehouses', authenticate, requirePermission('warehouses.view'), validateQuery(listWarehousesQuerySchema), listWarehouses);
router.get('/warehouses/:id', authenticate, requirePermission('warehouses.view'), validateUUIDParams, getWarehouse);
router.post('/warehouses', authenticate, requirePermission('warehouses.manage'), validateRequest(createWarehouseSchema), createWarehouse);
router.put('/warehouses/:id', authenticate, requirePermission('warehouses.update'), validateUUIDParams, validateRequest(updateWarehouseSchema), updateWarehouse);
router.delete('/warehouses/:id', authenticate, requirePermission('warehouses.manage'), validateUUIDParams, deleteWarehouse);
router.get('/warehouses/:id/stats', authenticate, requirePermission('warehouses.view'), validateUUIDParams, getWarehouseStats);
router.get('/warehouses/:id/inventory', authenticate, requirePermission('warehouses.view'), validateUUIDParams, validateQuery(warehouseInventoryQuerySchema), getWarehouseInventory);

// Carriers
// Carrier master data is tenant-scoped and must never be exposed publicly.
router.get('/carriers', authenticate, requirePermission('carriers.view'), listCarriers);
router.get('/carriers/:id', authenticate, requirePermission('carriers.view'), validateUUIDParams, getCarrier);
router.post('/carriers', authenticate, requirePermission('carriers.manage'), validateRequest(createCarrierSchema), createCarrier);
router.put('/carriers/:id', authenticate, requirePermission('carriers.manage'), validateUUIDParams, validateRequest(updateCarrierSchema), updateCarrier);
router.delete('/carriers/:id', authenticate, requirePermission('carriers.manage'), validateUUIDParams, deleteCarrier);
router.get('/carriers/:carrierId/rates', authenticate, requirePermission('carriers.view'), listRateCards);

// Products
router.get('/products', authenticate, requirePermission('inventory.view'), listProducts);
router.post('/products', authenticate, requirePermission('inventory.manage'), validateRequest(createProductSchema), createProduct);
router.put('/products/:id', authenticate, requirePermission('inventory.manage'), validateUUIDParams, validateRequest(updateProductSchema), updateProduct);
router.delete('/products/:id', authenticate, requirePermission('inventory.manage'), validateUUIDParams, deleteProduct);

// SLA Policies (org-level templates; violations are in sla.js)
router.get('/sla-policies', authenticate, authorize('sla:read'), listSlaPolicies);

export default router;
