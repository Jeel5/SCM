// Companies Routes - superadmin company management endpoints
import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';
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

// Get global statistics (superadmin only)
router.get('/super-admin/stats', authenticate, authorize('companies:read'), getGlobalStats);

// Company CRUD operations (superadmin only)
router.get('/companies', authenticate, authorize('companies:read'), getAllCompanies);
router.get('/companies/:id', authenticate, authorize('companies:read'), getCompanyById);
router.post('/companies', authenticate, authorize('companies:create'), createCompany);
router.put('/companies/:id', authenticate, authorize('companies:update'), updateCompany);
router.delete('/companies/:id', authenticate, authorize('companies:delete'), deleteCompany);

// Company users (superadmin only)
router.get('/companies/:id/users', authenticate, authorize('companies:read'), getCompanyUsers);

export default router;
