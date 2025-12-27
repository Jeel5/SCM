import express from 'express';
import { listShipments, getShipment, getShipmentTimeline, createShipment, updateShipmentStatus } from '../controllers/shipmentsController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.get('/shipments', authenticate, listShipments);
router.get('/shipments/:id', authenticate, getShipment);
router.get('/shipments/:id/timeline', authenticate, getShipmentTimeline);
router.post('/shipments', authenticate, createShipment);
router.patch('/shipments/:id/status', authenticate, updateShipmentStatus);

export default router;
