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

// All routes require superadmin authentication
router.use(authenticate);
router.use(authorize('companies:read')); // Superadmin only

// Get global statistics
router.get('/super-admin/stats', getGlobalStats);

// Company CRUD operations
router.get('/companies', getAllCompanies);
router.get('/companies/:id', getCompanyById);
router.post('/companies', authorize('companies:create'), createCompany);
router.put('/companies/:id', authorize('companies:update'), updateCompany);
router.delete('/companies/:id', authorize('companies:delete'), deleteCompany);

// Company users
router.get('/companies/:id/users', getCompanyUsers);

export default router;
