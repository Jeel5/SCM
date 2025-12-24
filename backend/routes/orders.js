import express from 'express';
import { listOrders } from '../controllers/ordersController.js';

const router = express.Router();

router.get('/orders', listOrders);

export default router;
