// Finance routes - invoices, refunds, disputes, financial summaries
import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/rbac.js';
import { injectOrgContext } from '../middlewares/multiTenant.js';
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  getRefunds,
  processRefund,
  getDisputes,
  resolveDispute,
  getFinancialSummary,
} from '../controllers/financeController.js';

const router = express.Router();

// Invoices
router.get('/finance/invoices', authenticate, injectOrgContext, requirePermission('finance.view'), getInvoices);
router.get('/finance/invoices/:id', authenticate, injectOrgContext, requirePermission('finance.view'), getInvoiceById);
router.post('/finance/invoices', authenticate, injectOrgContext, requirePermission('settings.organization'), createInvoice);
router.patch('/finance/invoices/:id', authenticate, injectOrgContext, requirePermission('settings.organization'), updateInvoice);

// Refunds
router.get('/finance/refunds', authenticate, injectOrgContext, requirePermission('finance.view'), getRefunds);
router.post('/finance/refunds/:id/process', authenticate, injectOrgContext, requirePermission('settings.organization'), processRefund);

// Disputes
router.get('/finance/disputes', authenticate, injectOrgContext, requirePermission('finance.view'), getDisputes);
router.post('/finance/disputes/:id/resolve', authenticate, injectOrgContext, requirePermission('settings.organization'), resolveDispute);

// Summary
router.get('/finance/summary', authenticate, injectOrgContext, requirePermission('finance.view'), getFinancialSummary);

export default router;
