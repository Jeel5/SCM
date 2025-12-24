import express from 'express';
import { listReturns } from '../controllers/returnsController.js';

const router = express.Router();

router.get('/returns', listReturns);

export default router;
