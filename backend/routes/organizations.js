// Organization routes (superadmin only)
import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  listOrganizationsQuerySchema,
  listGlobalUsersQuerySchema,
  orgAuditQuerySchema,
  orgBillingQuerySchema,
  impersonationStartSchema,
  createIncidentBannerSchema,
  updateIncidentBannerSchema,
} from '../validators/organizationSchemas.js';
import {
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  suspendOrganization,
  reactivateOrganization,
  getOrganizationUsers,
  getGlobalStats,
  getGlobalUsers,
  getOrganizationAuditLogs,
  getOrganizationBillingSummary,
  startImpersonation,
  stopImpersonation,
  getActiveIncidentBanner,
  listIncidentBanners,
  createIncidentBanner,
  updateIncidentBanner,
} from '../controllers/organizationController.js';

const router = express.Router();

// List organizations with filters (superadmin only)
router.get('/', authenticate, authorize('superadmin'), validateQuery(listOrganizationsQuerySchema), listOrganizations);

// Global platform stats for superadmin dashboard
router.get('/stats/global', authenticate, authorize('superadmin'), getGlobalStats);

// Global users list for superadmin
router.get('/users/global', authenticate, authorize('superadmin'), validateQuery(listGlobalUsersQuerySchema), getGlobalUsers);

// Impersonation controls
router.post('/impersonation/start', authenticate, authorize('superadmin'), validateRequest(impersonationStartSchema), startImpersonation);
router.post('/impersonation/stop', authenticate, stopImpersonation);

// Incident banners
router.get('/incidents/banner/active', authenticate, getActiveIncidentBanner);
router.get('/incidents/banner', authenticate, authorize('superadmin'), listIncidentBanners);
router.post('/incidents/banner', authenticate, authorize('superadmin'), validateRequest(createIncidentBannerSchema), createIncidentBanner);
router.patch('/incidents/banner/:id', authenticate, authorize('superadmin'), validateRequest(updateIncidentBannerSchema), updateIncidentBanner);

// Get single organization (superadmin only)
router.get('/:id', authenticate, authorize('superadmin'), getOrganization);

// Create organization with admin user (superadmin only)
router.post('/', authenticate, authorize('superadmin'), validateRequest(createOrganizationSchema), createOrganization);

// Update organization (superadmin only)
router.put('/:id', authenticate, authorize('superadmin'), validateRequest(updateOrganizationSchema), updateOrganization);

// Delete (deactivate) organization (superadmin only)
router.delete('/:id', authenticate, authorize('superadmin'), deleteOrganization);

// Get users of an organization
router.get('/:id/users', authenticate, authorize('superadmin'), getOrganizationUsers);

// Organization audit timeline
router.get('/:id/audit', authenticate, authorize('superadmin'), validateQuery(orgAuditQuerySchema), getOrganizationAuditLogs);

// Organization billing summary
router.get('/:id/billing', authenticate, authorize('superadmin'), validateQuery(orgBillingQuerySchema), getOrganizationBillingSummary);

// Suspend / reactivate tenant
router.post('/:id/suspend', authenticate, authorize('superadmin'), suspendOrganization);
router.post('/:id/reactivate', authenticate, authorize('superadmin'), reactivateOrganization);

export default router;
