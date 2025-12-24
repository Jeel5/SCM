import express from 'express';
import { listWarehouses, listCarriers, listProducts } from '../controllers/mdmController.js';

const router = express.Router();

router.get('/mdm/warehouses', listWarehouses);
router.get('/mdm/carriers', listCarriers);
router.get('/mdm/products', listProducts);

export default router;
