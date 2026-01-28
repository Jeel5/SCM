import express from 'express';
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
router.get('/finance/invoices', getInvoices);
router.get('/finance/invoices/:id', getInvoiceById);
router.post('/finance/invoices', createInvoice);
router.patch('/finance/invoices/:id', updateInvoice);

// Refunds
router.get('/finance/refunds', getRefunds);
router.post('/finance/refunds/:id/process', processRefund);

// Disputes
router.get('/finance/disputes', getDisputes);
router.post('/finance/disputes/:id/resolve', resolveDispute);

// Summary
router.get('/finance/summary', getFinancialSummary);

export default router;
