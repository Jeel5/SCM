import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, CreditCard, TrendingUp, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, DataTable } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { mockApi } from '@/api/mockData';

interface FinanceData {
  outstandingInvoices: number;
  refundsProcessed: number;
  disputes: number;
  payoutStatus: string;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    carrier: string;
    amount: number;
    status: string;
    dueDate: string;
  }>;
  refunds: Array<{
    id: string;
    orderNumber: string;
    amount: number;
    status: string;
    processedAt: string;
  }>;
}

export function FinancePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const useMock = localStorage.getItem('useMockApi') === 'true';

      try {
        if (useMock) {
          const response = await mockApi.getFinanceData();
          setData(response.data);
        } else {
          // Real API would go here - for now show empty state
          setData({
            outstandingInvoices: 0,
            refundsProcessed: 0,
            disputes: 0,
            payoutStatus: 'No payouts scheduled',
            invoices: [],
            refunds: [],
          });
        }
      } catch (error) {
        console.error('Failed to fetch finance data:', error);
        setData({
          outstandingInvoices: 0,
          refundsProcessed: 0,
          disputes: 0,
          payoutStatus: 'No payouts scheduled',
          invoices: [],
          refunds: [],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

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
      render: (inv: any) => formatCurrency(inv.amount),
    },
    {
      key: 'status',
      header: 'Status',
      render: (inv: any) => (
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            inv.status === 'paid'
              ? 'bg-green-100 text-green-700'
              : inv.status === 'pending'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-700'
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
      render: (ref: any) => formatCurrency(ref.amount),
    },
    {
      key: 'status',
      header: 'Status',
      render: (ref: any) => (
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            ref.status === 'processed'
              ? 'bg-green-100 text-green-700'
              : 'bg-yellow-100 text-yellow-700'
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
          <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />}>
            Export
          </Button>
          <Button variant="primary">Add Record</Button>
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
                <Button variant="primary">Upload CSV</Button>
                <Button variant="outline">Configure Integration</Button>
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );
}

export default FinancePage;
