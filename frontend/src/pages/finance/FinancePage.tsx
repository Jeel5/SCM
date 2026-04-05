import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, CreditCard, TrendingUp, AlertTriangle, Download, Upload, Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, DataTable, PermissionGate, Modal, Input, Select, Tabs, useToast } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { carriersApi, financeApi } from '@/api/services';
import { downloadApiFile, notifyError } from '@/lib/apiErrors';
import { useFinance } from './hooks/useFinance';
import type { FinanceTab } from './types';

export function FinancePage() {
  const { data, isLoading, refetch } = useFinance();
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<{
    id: string;
    orderNumber: string;
    returnId: string;
    amount: number;
    status: string;
    requestedAt: string;
    processedAt: string;
    customerName: string;
    reason: string;
    restockingFee: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [carriers, setCarriers] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [form, setForm] = useState({
    invoice_number: '',
    carrier_id: '',
    billing_period_start: '',
    billing_period_end: '',
    total_shipments: '0',
    base_amount: '0',
    penalties: '0',
    adjustments: '0',
    final_amount: '0',
    status: 'pending',
  });

  const resetForm = () => {
    setForm({
      invoice_number: '',
      carrier_id: '',
      billing_period_start: '',
      billing_period_end: '',
      total_shipments: '0',
      base_amount: '0',
      penalties: '0',
      adjustments: '0',
      final_amount: '0',
      status: 'pending',
    });
  };

  const openAddRecord = async () => {
    try {
      const res = await carriersApi.getCarriers({ limit: 200 });
      setCarriers((res.data || []).map((c: any) => ({ id: c.id, name: c.name, code: c.code })));
      setIsAddOpen(true);
    } catch {
      error('Could not load carriers', 'Please refresh and try again');
    }
  };

  const handleCreateInvoice = async () => {
    if (!form.invoice_number || !form.carrier_id || !form.billing_period_start || !form.billing_period_end) {
      error('Missing required fields', 'Invoice number, carrier and billing period are required');
      return;
    }

    setIsSubmitting(true);
    try {
      await financeApi.createInvoice({
        invoice_number: form.invoice_number,
        carrier_id: form.carrier_id,
        billing_period_start: new Date(form.billing_period_start).toISOString(),
        billing_period_end: new Date(form.billing_period_end).toISOString(),
        total_shipments: Number(form.total_shipments) || 0,
        base_amount: Number(form.base_amount) || 0,
        penalties: Number(form.penalties) || 0,
        adjustments: Number(form.adjustments) || 0,
        final_amount: Number(form.final_amount) || 0,
        status: form.status as 'pending' | 'approved' | 'disputed' | 'paid' | 'cancelled',
      });
      success('Record added', 'Invoice created successfully');
      setIsAddOpen(false);
      resetForm();
      refetch();
    } catch (e: any) {
      error('Failed to add record', e?.response?.data?.error || e?.message || 'Please check input data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveInvoice = async (invoiceId: string) => {
    setIsSubmitting(true);
    try {
      await financeApi.approveInvoice(invoiceId);
      success('Invoice approved', 'Carrier invoice moved to approved status');
      refetch();
    } catch (e: any) {
      error('Approval failed', e?.response?.data?.error || e?.message || 'Could not approve invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    const paymentMethod = window.prompt('Payment method (e.g. bank_transfer, upi, card):', 'bank_transfer') || '';
    if (!paymentMethod.trim()) return;

    setIsSubmitting(true);
    try {
      await financeApi.markInvoicePaid(invoiceId, {
        payment_method: paymentMethod.trim(),
        payment_date: new Date().toISOString(),
      });
      success('Invoice paid', 'Carrier payment has been recorded');
      refetch();
    } catch (e: any) {
      error('Payment update failed', e?.response?.data?.error || e?.message || 'Could not mark invoice as paid');
    } finally {
      setIsSubmitting(false);
    }
  };

  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return [] as Record<string, string>[];
    const headers = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const cells = line.split(',').map((c) => c.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = (cells[i] || '').replace(/^"|"$/g, '');
      });
      return row;
    });
  };

  const handleCsvUpload = async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) {
      error('CSV is empty', 'Please upload a valid CSV file with header row');
      return;
    }

    let carrierLookup = new Map<string, string>();
    try {
      const res = await carriersApi.getCarriers({ limit: 200 });
      carrierLookup = new Map(
        (res.data || []).flatMap((carrier: any) => {
          const entries: Array<[string, string]> = [[String(carrier.id).trim().toLowerCase(), carrier.id]];
          if (carrier.name) entries.push([String(carrier.name).trim().toLowerCase(), carrier.id]);
          if (carrier.code) entries.push([String(carrier.code).trim().toLowerCase(), carrier.id]);
          return entries;
        })
      );
    } catch {
      error('Could not load carriers', 'Unable to validate carrier references for CSV import');
      return;
    }

    const resolveCarrierId = (row: Record<string, string>) => {
      const candidates = [row.carrier_id, row.carrier_name, row.carrier_code]
        .map((value) => value?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value));

      for (const candidate of candidates) {
        const matchedCarrierId = carrierLookup.get(candidate);
        if (matchedCarrierId) return matchedCarrierId;
      }

      return '';
    };

    setIsSubmitting(true);
    let created = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const carrierId = resolveCarrierId(row);
        if (!carrierId) {
          throw new Error('Carrier id, carrier name, or carrier code is required');
        }

        await financeApi.createInvoice({
          invoice_number: row.invoice_number,
          carrier_id: carrierId,
          billing_period_start: new Date(row.billing_period_start).toISOString(),
          billing_period_end: new Date(row.billing_period_end).toISOString(),
          total_shipments: Number(row.total_shipments) || 0,
          base_amount: Number(row.base_amount) || 0,
          penalties: Number(row.penalties) || 0,
          adjustments: Number(row.adjustments) || 0,
          final_amount: Number(row.final_amount) || 0,
          status: (row.status as any) || 'pending',
        });
        created += 1;
      } catch {
        failed += 1;
      }
    }

    setIsSubmitting(false);
    if (created > 0) {
      success('CSV import completed', `${created} invoices imported${failed ? `, ${failed} failed` : ''}`);
      refetch();
    } else {
      error('CSV import failed', 'No records were imported. Include carrier_id, carrier_name, or carrier_code in the CSV.');
    }
  };

  const handleExport = async () => {
    try {
      await downloadApiFile(
        '/analytics/export?type=orders&range=month',
        `finance-export-${new Date().toISOString().slice(0, 10)}.csv`,
      );
    } catch (err) {
      notifyError('Export failed', err, 'Could not export finance data');
    }
  };

  const summaryCards = data
    ? [
        {
          label: 'Outstanding Invoices',
          value: formatCurrency(data.outstandingInvoices),
          icon: CreditCard,
          color: 'bg-blue-100 text-blue-600',
          note: `${data.invoices?.length || 0} invoices pending`,
        },
        {
          label: 'Refunded Amount',
          value: formatCurrency(data.refundsProcessed),
          icon: DollarSign,
          color: 'bg-green-100 text-green-600',
          note: `${data.refunds?.length || 0} refunds this month`,
        },
        {
          label: 'Disputes',
          value: `${data.disputes} open`,
          icon: AlertTriangle,
          color: 'bg-yellow-100 text-yellow-700',
          note: data.disputes === 0 ? 'All clear' : 'Needs attention',
        },
        {
          label: 'Payout Status',
          value: data.payoutStatus || 'No payouts scheduled',
          icon: TrendingUp,
          color: 'bg-purple-100 text-purple-600',
          note: 'Next payout in 3 days',
        },
      ]
    : [];

  const invoiceColumns = [
    { key: 'invoiceNumber', header: 'Invoice #' },
    { key: 'carrier', header: 'Carrier' },
    {
      key: 'amount',
      header: 'Amount',
      render: (inv: { amount: number }) => formatCurrency(inv.amount),
    },
    {
      key: 'status',
      header: 'Status',
      render: (inv: { status: string }) => (
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            inv.status === 'paid'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : inv.status === 'pending'
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          {inv.status}
        </span>
      ),
    },
    { key: 'dueDate', header: 'Due Date' },
    {
      key: 'actions',
      header: 'Actions',
      render: (inv: { id: string; status: string }) => (
        <div className="flex gap-2">
          {inv.status === 'pending' && (
            <Button size="sm" variant="outline" onClick={() => handleApproveInvoice(inv.id)} disabled={isSubmitting}>
              Approve
            </Button>
          )}
          {inv.status === 'approved' && (
            <Button size="sm" variant="primary" onClick={() => handleMarkPaid(inv.id)} disabled={isSubmitting}>
              Mark Paid
            </Button>
          )}
          {inv.status !== 'pending' && inv.status !== 'approved' && (
            <span className="text-xs text-gray-500">No action</span>
          )}
        </div>
      ),
    },
  ];

  const refundColumns = [
    { key: 'orderNumber', header: 'Order #' },
    {
      key: 'amount',
      header: 'Amount',
      render: (ref: { amount: number }) => formatCurrency(ref.amount),
    },
    {
      key: 'status',
      header: 'Status',
      render: (ref: { status: string }) => (
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            ref.status === 'refunded'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : ref.status === 'rejected'
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : ref.status === 'inspected' || ref.status === 'approved'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
          }`}
        >
          {ref.status === 'refunded'
            ? 'Refunded'
            : ref.status === 'inspected' || ref.status === 'approved'
              ? 'Ready'
              : ref.status === 'rejected'
                ? 'Rejected'
                : 'Pending'}
        </span>
      ),
    },
    { key: 'processedAt', header: 'Processed' },
  ];

  const disputeColumns = [
    { key: 'invoiceNumber', header: 'Invoice #' },
    { key: 'carrier', header: 'Carrier' },
    {
      key: 'amount',
      header: 'Amount',
      render: (inv: { amount: number }) => formatCurrency(inv.amount),
    },
    {
      key: 'status',
      header: 'Status',
      render: (inv: { status: string }) => (
        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {inv.status}
        </span>
      ),
    },
    { key: 'createdAt', header: 'Created' },
  ];

  const financeTabs: Array<{ id: FinanceTab; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'invoices', label: 'Invoices', count: data?.invoices?.length || 0 },
    { id: 'refunds', label: 'Refunds', count: data?.refunds?.length || 0 },
    { id: 'disputes', label: 'Disputes', count: data?.disputeRecords?.length || 0 },
  ];

  const hasAnyRecords = Boolean(
    data?.invoices?.length || data?.refunds?.length || data?.disputeRecords?.length
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Loading finance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Finance</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Reconcile payouts, refunds, and invoices</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={handleExport}>
            Export
          </Button>
          <PermissionGate permission="settings.organization">
            <Button variant="outline" leftIcon={<Upload className="h-4 w-4" />} onClick={() => fileInputRef.current?.click()}>
              Upload CSV
            </Button>
          </PermissionGate>
          <PermissionGate permission="settings.organization">
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openAddRecord}>
              Add Record
            </Button>
          </PermissionGate>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm text-gray-500 dark:text-gray-400">{card.label}</CardTitle>
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${card.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{card.note}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Tabs tabs={financeTabs} activeTab={activeTab} onChange={(tab) => setActiveTab(tab as FinanceTab)} variant="underline" />

      {activeTab === 'overview' && (
        <>
          {hasAnyRecords ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  {data?.invoices?.length ? (
                    <ul className="space-y-3">
                      {data.invoices.slice(0, 3).map((invoice) => (
                        <li key={invoice.id} className="flex items-center justify-between gap-4 text-sm">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{invoice.invoiceNumber}</p>
                            <p className="text-gray-500 dark:text-gray-400">{invoice.carrier}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(invoice.amount)}</p>
                            <p className="text-gray-500 dark:text-gray-400">{invoice.status}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No invoices yet</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Refunds</CardTitle>
                </CardHeader>
                <CardContent>
                  {data?.refunds?.length ? (
                    <ul className="space-y-3">
                      {data.refunds.slice(0, 3).map((refund) => (
                        <li key={refund.id} className="flex items-center justify-between gap-4 text-sm">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{refund.orderNumber}</p>
                            <p className="text-gray-500 dark:text-gray-400">{refund.requestedAt}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(refund.amount)}</p>
                            <p className="text-gray-500 dark:text-gray-400">
                              {refund.status === 'refunded'
                                ? 'Refunded'
                                : refund.status === 'inspected' || refund.status === 'approved'
                                  ? 'Ready'
                                  : refund.status === 'rejected'
                                    ? 'Rejected'
                                    : 'Pending'}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No refunds yet</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Disputes</CardTitle>
                </CardHeader>
                <CardContent>
                  {data?.disputeRecords?.length ? (
                    <ul className="space-y-3">
                      {data.disputeRecords.slice(0, 3).map((dispute) => (
                        <li key={dispute.id} className="flex items-center justify-between gap-4 text-sm">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{dispute.invoiceNumber}</p>
                            <p className="text-gray-500 dark:text-gray-400">{dispute.carrier}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(dispute.amount)}</p>
                            <p className="text-gray-500 dark:text-gray-400">{dispute.status}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No disputes yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No records found</CardTitle>
              </CardHeader>
              <CardContent className="text-gray-600 dark:text-gray-400">
                <p>No financial records are available for this workspace yet.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {activeTab === 'invoices' && (
        <Card padding="none">
          <DataTable
            columns={invoiceColumns}
            data={data?.invoices || []}
            isLoading={false}
            searchPlaceholder="Search invoices..."
            emptyMessage="No invoices found"
          />
        </Card>
      )}

      {activeTab === 'refunds' && (
        <Card padding="none">
          <DataTable
            columns={refundColumns}
            data={data?.refunds || []}
            isLoading={false}
            searchPlaceholder="Search refunds..."
            emptyMessage="No refunds found"
            onRowClick={(refund) => setSelectedRefund(refund)}
          />
        </Card>
      )}

      {activeTab === 'disputes' && (
        <Card padding="none">
          <DataTable
            columns={disputeColumns}
            data={data?.disputeRecords || []}
            isLoading={false}
            searchPlaceholder="Search disputes..."
            emptyMessage="No disputes found"
          />
        </Card>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleCsvUpload(file);
          e.currentTarget.value = '';
        }}
      />

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Finance Record" size="lg">
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Invoice Basics</p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Invoice Number"
                value={form.invoice_number}
                onChange={(e) => setForm((p) => ({ ...p, invoice_number: e.target.value }))}
                placeholder="INV-2026-001"
              />
              <Select
                label="Carrier"
                value={form.carrier_id}
                onChange={(e) => setForm((p) => ({ ...p, carrier_id: e.target.value }))}
                options={[
                  { value: '', label: 'Select carrier' },
                  ...carriers.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Billing Start"
                type="date"
                value={form.billing_period_start}
                onChange={(e) => setForm((p) => ({ ...p, billing_period_start: e.target.value }))}
              />
              <Input
                label="Billing End"
                type="date"
                value={form.billing_period_end}
                onChange={(e) => setForm((p) => ({ ...p, billing_period_end: e.target.value }))}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Amounts & Status</p>
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Total Shipments"
                type="number"
                min="0"
                value={form.total_shipments}
                onChange={(e) => setForm((p) => ({ ...p, total_shipments: e.target.value }))}
              />
              <Input
                label="Base Amount"
                type="number"
                min="0"
                step="0.01"
                value={form.base_amount}
                onChange={(e) => setForm((p) => ({ ...p, base_amount: e.target.value }))}
              />
              <Input
                label="Final Amount"
                type="number"
                min="0"
                step="0.01"
                value={form.final_amount}
                onChange={(e) => setForm((p) => ({ ...p, final_amount: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Penalties"
                type="number"
                min="0"
                step="0.01"
                value={form.penalties}
                onChange={(e) => setForm((p) => ({ ...p, penalties: e.target.value }))}
              />
              <Input
                label="Adjustments"
                type="number"
                step="0.01"
                value={form.adjustments}
                onChange={(e) => setForm((p) => ({ ...p, adjustments: e.target.value }))}
              />
              <Select
                label="Status"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                options={[
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'disputed', label: 'Disputed' },
                  { value: 'paid', label: 'Paid' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
              />
            </div>
          </div>

          <div className="text-xs text-gray-500">
            CSV columns supported: `invoice_number,carrier_id,carrier_name,carrier_code,billing_period_start,billing_period_end,total_shipments,base_amount,penalties,adjustments,final_amount,status`
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateInvoice} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Record'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(selectedRefund)}
        onClose={() => setSelectedRefund(null)}
        title={selectedRefund ? `Refund ${selectedRefund.orderNumber}` : 'Refund details'}
        size="lg"
      >
        {selectedRefund && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                <p className="text-gray-500 dark:text-gray-400">Customer</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedRefund.customerName}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                <p className="text-gray-500 dark:text-gray-400">Status</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {selectedRefund.status === 'refunded'
                    ? 'Refunded'
                    : selectedRefund.status === 'inspected' || selectedRefund.status === 'approved'
                      ? 'Ready'
                      : selectedRefund.status === 'rejected'
                        ? 'Rejected'
                        : 'Pending'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                <p className="text-gray-500 dark:text-gray-400">Requested</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedRefund.requestedAt}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                <p className="text-gray-500 dark:text-gray-400">Processed</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedRefund.processedAt}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                <p className="text-gray-500 dark:text-gray-400">Refund Amount</p>
                <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(selectedRefund.amount)}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                <p className="text-gray-500 dark:text-gray-400">Restocking Fee</p>
                <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(selectedRefund.restockingFee)}</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-sm space-y-2">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Reason</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedRefund.reason}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Return Ref</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedRefund.returnId}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default FinancePage;
