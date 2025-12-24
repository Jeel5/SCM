import express from 'express';
import { listShipments, getShipmentTimeline } from '../controllers/shipmentsController.js';

const router = express.Router();

router.get('/shipments', listShipments);
router.get('/shipments/:id/timeline', getShipmentTimeline);

export default router;
