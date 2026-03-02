// Channel Partners routes — Sales Channels & Suppliers
import express from 'express';
import {
  listChannels, getChannel, createChannel, updateChannel, deleteChannel,
  listSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier,
} from '../controllers/partnersController.js';
import { authenticate } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/rbac.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import {
  createChannelSchema, updateChannelSchema, listChannelsQuerySchema,
  createSupplierSchema, updateSupplierSchema, listSuppliersQuerySchema,
} from '../validators/partnerSchemas.js';

const router = express.Router();

// ─── Sales Channels ─────────────────────────────────────
router.get('/channels',     authenticate, requirePermission('channels.view'), validateQuery(listChannelsQuerySchema), listChannels);
router.get('/channels/:id', authenticate, requirePermission('channels.view'), getChannel);
router.post('/channels',    authenticate, requirePermission('channels.manage'), validateRequest(createChannelSchema), createChannel);
router.put('/channels/:id', authenticate, requirePermission('channels.manage'), validateRequest(updateChannelSchema), updateChannel);
router.delete('/channels/:id', authenticate, requirePermission('channels.manage'), deleteChannel);

// ─── Suppliers ───────────────────────────────────────────
router.get('/suppliers',     authenticate, requirePermission('suppliers.view'), validateQuery(listSuppliersQuerySchema), listSuppliers);
router.get('/suppliers/:id', authenticate, requirePermission('suppliers.view'), getSupplier);
router.post('/suppliers',    authenticate, requirePermission('suppliers.manage'), validateRequest(createSupplierSchema), createSupplier);
router.put('/suppliers/:id', authenticate, requirePermission('suppliers.manage'), validateRequest(updateSupplierSchema), updateSupplier);
router.delete('/suppliers/:id', authenticate, requirePermission('suppliers.manage'), deleteSupplier);

export default router;
