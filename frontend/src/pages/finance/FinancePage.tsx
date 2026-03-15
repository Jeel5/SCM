import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, CreditCard, TrendingUp, AlertTriangle, Download, RefreshCw, Upload, Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, DataTable, PermissionGate, Modal, Input, Select, useToast } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { carriersApi, financeApi } from '@/api/services';
import { useFinance } from './hooks/useFinance';

export function FinancePage() {
  const { data, isLoading, refetch } = useFinance();
  const { success, error } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [carriers, setCarriers] = useState<Array<{ id: string; name: string }>>([]);
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
      setCarriers((res.data || []).map((c: any) => ({ id: c.id, name: c.name })));
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

    setIsSubmitting(true);
    let created = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        await financeApi.createInvoice({
          invoice_number: row.invoice_number,
          carrier_id: row.carrier_id,
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
      error('CSV import failed', 'No records were imported. Check required columns and values.');
    }
  };

  const handleExport = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const resp = await fetch(`${apiBase}/analytics/export?type=orders&range=month`, {
        credentials: 'include',
      });
      if (!resp.ok) throw new Error('Export failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
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
          label: 'Refunds Processed',
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
            ref.status === 'processed'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
          }`}
        >
          {ref.status}
        </span>
      ),
    },
    { key: 'processedAt', header: 'Processed' },
  ];

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
          <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={refetch}>
            Refresh
          </Button>
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

      {/* Invoices Table */}
      {data?.invoices && data.invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={invoiceColumns}
              data={data.invoices}
              isLoading={false}
              emptyMessage="No invoices found"
            />
          </CardContent>
        </Card>
      )}

      {/* Refunds Table */}
      {data?.refunds && data.refunds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Refunds</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={refundColumns}
              data={data.refunds}
              isLoading={false}
              emptyMessage="No refunds found"
            />
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {(!data?.invoices || data.invoices.length === 0) &&
        (!data?.refunds || data.refunds.length === 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Connect Finance Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-600">
              <p>
                This workspace does not have finance data yet. Connect your billing system or upload
                CSV exports to see payouts, invoices, and refunds here.
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Upload payout CSVs from Stripe, Razorpay, or your PSP</li>
                <li>Import refund reports to reconcile with returns</li>
                <li>Track disputes and chargebacks alongside shipments</li>
              </ul>
              <div className="flex gap-3 pt-2">
                <Button variant="primary" onClick={() => fileInputRef.current?.click()}>Upload CSV</Button>
                <Button variant="outline">Configure Integration</Button>
              </div>
            </CardContent>
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
        <div className="space-y-4">
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

          <div className="text-xs text-gray-500">
            CSV columns supported: `invoice_number,carrier_id,billing_period_start,billing_period_end,total_shipments,base_amount,penalties,adjustments,final_amount,status`
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateInvoice} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Record'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default FinancePage;
