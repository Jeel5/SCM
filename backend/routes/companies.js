// Companies Routes - superadmin company management endpoints
import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { requireRoles, ROLES } from '../middlewares/rbac.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import {
  createCompanySchema,
  updateCompanySchema,
  listCompaniesQuerySchema,
} from '../validators/companySchemas.js';
import {
  getAllCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  getCompanyUsers,
  getGlobalStats,
} from '../controllers/companiesController.js';

const router = express.Router();

// All company management routes are superadmin-only
const requireSuperadmin = requireRoles(ROLES.SUPERADMIN);

// Get global statistics (superadmin only)
router.get('/super-admin/stats', authenticate, requireSuperadmin, getGlobalStats);

// Company CRUD operations (superadmin only)
router.get('/companies', authenticate, requireSuperadmin, validateQuery(listCompaniesQuerySchema), getAllCompanies);
router.get('/companies/:id', authenticate, requireSuperadmin, getCompanyById);
router.post('/companies', authenticate, requireSuperadmin, validateRequest(createCompanySchema), createCompany);
router.put('/companies/:id', authenticate, requireSuperadmin, validateRequest(updateCompanySchema), updateCompany);
router.delete('/companies/:id', authenticate, requireSuperadmin, deleteCompany);

// Company users (superadmin only)
router.get('/companies/:id/users', authenticate, requireSuperadmin, getCompanyUsers);

export default router;
