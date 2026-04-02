// Finance routes - invoices, refunds, disputes, financial summaries
import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/rbac.js';
import { validateRequest, validateQuery } from '../validators/index.js';
import {
  listInvoicesQuerySchema,
  listRefundsQuerySchema,
  listDisputesQuerySchema,
  financialSummaryQuerySchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  approveInvoiceSchema,
  markInvoicePaidSchema,
  processRefundSchema,
  resolveDisputeSchema,
} from '../validators/financeSchemas.js';
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  approveInvoice,
  markInvoicePaid,
  getRefunds,
  processRefund,
  getDisputes,
  resolveDispute,
  getFinancialSummary,
} from '../controllers/financeController.js';

const router = express.Router();

// Invoices
router.get('/finance/invoices', authenticate, requirePermission('finance.view'), validateQuery(listInvoicesQuerySchema), getInvoices);
router.get('/finance/invoices/:id', authenticate, requirePermission('finance.view'), getInvoiceById);
router.post('/finance/invoices', authenticate, requirePermission('settings.organization'), validateRequest(createInvoiceSchema), createInvoice);
router.patch('/finance/invoices/:id', authenticate, requirePermission('settings.organization'), validateRequest(updateInvoiceSchema), updateInvoice);
router.post('/finance/invoices/:id/approve', authenticate, requirePermission('settings.organization'), validateRequest(approveInvoiceSchema), approveInvoice);
router.post('/finance/invoices/:id/pay', authenticate, requirePermission('settings.organization'), validateRequest(markInvoicePaidSchema), markInvoicePaid);

// Refunds
router.get('/finance/refunds', authenticate, requirePermission('finance.view'), validateQuery(listRefundsQuerySchema), getRefunds);
router.post('/finance/refunds/:id/process', authenticate, requirePermission('settings.organization'), validateRequest(processRefundSchema), processRefund);

// Disputes
router.get('/finance/disputes', authenticate, requirePermission('finance.view'), validateQuery(listDisputesQuerySchema), getDisputes);
router.post('/finance/disputes/:id/resolve', authenticate, requirePermission('settings.organization'), validateRequest(resolveDisputeSchema), resolveDispute);

// Summary
router.get('/finance/summary', authenticate, requirePermission('finance.view'), validateQuery(financialSummaryQuerySchema), getFinancialSummary);

export default router;
