// Organization routes (superadmin only)
import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  listOrganizationsQuerySchema
} from '../validators/organizationSchemas.js';
import {
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization
} from '../controllers/organizationController.js';

const router = express.Router();

// List organizations with filters (superadmin only)
router.get('/', authenticate, authorize('superadmin'), validateQuery(listOrganizationsQuerySchema), listOrganizations);

// Get single organization (superadmin only)
router.get('/:id', authenticate, authorize('superadmin'), getOrganization);

// Create organization with admin user (superadmin only)
router.post('/', authenticate, authorize('superadmin'), validateRequest(createOrganizationSchema), createOrganization);

// Update organization (superadmin only)
router.put('/:id', authenticate, authorize('superadmin'), validateRequest(updateOrganizationSchema), updateOrganization);

// Delete (deactivate) organization (superadmin only)
router.delete('/:id', authenticate, authorize('superadmin'), deleteOrganization);

export default router;
