import express from 'express';
import { listSlaPolicies, getEta } from '../controllers/slaController.js';

const router = express.Router();

router.get('/sla', listSlaPolicies);
router.get('/eta', getEta);

export default router;
