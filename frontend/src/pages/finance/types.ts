// Page State
export interface FinancePageState {
  activeTab?: FinanceTab;
}

// Tab Types
export type FinanceTab = 'overview' | 'invoices' | 'refunds' | 'disputes';

// Dashboard Data
export interface FinanceDashboardData {
  outstandingInvoices: number;
  refundsProcessed: number;
  disputes: number;
  payoutStatus: string;
  invoices: Invoice[];
  refunds: Refund[];
  totalRevenue: number;
  monthlyRevenue: number;
  pendingPayouts: number;
}

// Invoice Types
export interface Invoice {
  id: string;
  invoiceNumber: string;
  carrier: string;
  carrierId: string;
  amount: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  lineItems: InvoiceLineItem[];
  notes?: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  shipmentId?: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

// Refund Types
export interface Refund {
  id: string;
  orderId: string;
  returnId: string;
  amount: number;
  status: RefundStatus;
  method: RefundMethod;
  processedDate?: string;
  requestedDate: string;
  customerName: string;
  reason: string;
}

export type RefundStatus = 'pending' | 'processing' | 'completed' | 'rejected';
export type RefundMethod = 'original_payment' | 'store_credit' | 'bank_transfer';

// Dispute Types
export interface Dispute {
  id: string;
  invoiceId: string;
  carrier: string;
  amount: number;
  reason: string;
  status: DisputeStatus;
  createdDate: string;
  resolvedDate?: string;
  resolution?: string;
}

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'escalated';

// Filters
export interface FinanceFilters {
  status?: string[];
  carrier?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  amountRange?: {
    min: number;
    max: number;
  };
}

// Stats
export interface FinanceStats {
  totalRevenue: number;
  paidInvoices: number;
  outstandingAmount: number;
  refundsIssued: number;
  activeDisputes: number;
  paymentSuccess: number;
}
