// Master Data Management routes - warehouses, carriers, products, policies
import express from 'express';
import { 
  listWarehouses, getWarehouse, createWarehouse,
  listCarriers, getCarrier, createCarrier,
  listProducts, createProduct,
  listSlaPolicies, listRateCards
} from '../controllers/mdmController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Warehouses
router.get('/warehouses', authenticate, listWarehouses);
router.get('/warehouses/:id', authenticate, getWarehouse);
router.post('/warehouses', authenticate, createWarehouse);

// Carriers (public endpoint for webhook credentials - no auth needed)
router.get('/carriers', listCarriers); // Public - demo needs this
router.get('/carriers/:id', getCarrier); // Public - carrier portal needs webhook_secret
router.post('/carriers', authenticate, createCarrier);
router.get('/carriers/:carrierId/rates', authenticate, listRateCards);

// Products
router.get('/products', authenticate, listProducts);
router.post('/products', authenticate, createProduct);

// SLA Policies
router.get('/sla-policies', authenticate, listSlaPolicies);

export default router;
