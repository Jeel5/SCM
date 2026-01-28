import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  RotateCcw,
  Package,
  CheckCircle2,
  XCircle,
  Eye,
  Plus,
  Download,
} from 'lucide-react';
import {
  Card,
  Button,
  DataTable,
  StatusBadge,
  Badge,
  Tabs,
} from '@/components/ui';
import { formatCurrency, formatRelativeTime, cn } from '@/lib/utils';
import type { Return } from '@/types';
import { ReturnDetailsModal, CreateReturnModal } from './components';
import { useReturns } from './hooks';

export function ReturnsPage() {
  const [page, setPage] = useState(1);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const pageSize = 10;
  const { returns, totalReturns, isLoading } = useReturns(page, pageSize);

  // Count returns per status for tab badges
  const statusCounts = returns.reduce<Record<string, number>>((acc, returnItem) => {
    acc[returnItem.status] = (acc[returnItem.status] || 0) + 1;
    return acc;
  }, {});

  // Filter list by active tab
  const filteredReturns = returns.filter((returnItem) => activeTab === 'all' || returnItem.status === activeTab);

  const tabs = [
    { id: 'all', label: 'All Returns', count: returns.length },
    { id: 'pending', label: 'Pending', count: statusCounts.pending || 0 },
    { id: 'approved', label: 'Approved', count: statusCounts.approved || 0 },
    { id: 'rejected', label: 'Rejected', count: statusCounts.rejected || 0 },
    { id: 'completed', label: 'Completed', count: statusCounts.completed || 0 },
  ];

  const columns = [
    {
      key: 'return',
      header: 'Return ID',
      sortable: true,
      render: (returnItem: Return) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <RotateCcw className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{returnItem.id}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{formatRelativeTime(returnItem.createdAt)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'order',
      header: 'Order',
      render: (returnItem: Return) => (
        <span className="font-medium text-gray-700 dark:text-gray-200">{returnItem.orderId}</span>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (returnItem: Return) => (
        <span className="text-gray-700 dark:text-gray-200">{returnItem.customerName}</span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (returnItem: Return) => (
        <Badge variant="outline" className="capitalize">
          {returnItem.reason.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (returnItem: Return) => <StatusBadge status={returnItem.status} />,
    },
    {
      key: 'amount',
      header: 'Refund Amount',
      sortable: true,
      render: (returnItem: Return) => (
        <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(returnItem.refundAmount || 0)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      render: (returnItem: Return) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedReturn(returnItem);
            setIsDetailsOpen(true);
          }}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <Eye className="h-4 w-4 text-gray-500" />
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Returns</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage product returns and refunds</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />}>
            Export
          </Button>
          <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsCreateOpen(true)}>
            New Return
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Returns', value: totalReturns, icon: RotateCcw, color: 'bg-purple-100 text-purple-600' },
          { label: 'Pending', value: returns.filter((r) => r.status === 'pending').length, icon: Package, color: 'bg-yellow-100 text-yellow-600' },
          { label: 'Approved', value: returns.filter((r) => r.status === 'approved').length, icon: CheckCircle2, color: 'bg-green-100 text-green-600' },
          { label: 'Rejected', value: returns.filter((r) => r.status === 'rejected').length, icon: XCircle, color: 'bg-red-100 text-red-600' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', stat.color)}>
                <stat.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Data Table */}
      <Card padding="none">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        <DataTable
          columns={columns}
          data={filteredReturns}
          isLoading={isLoading}
          searchPlaceholder="Search by return or order ID..."
          pagination={{
            page,
            pageSize,
            total: totalReturns,
            onPageChange: setPage,
          }}
          onRowClick={(returnItem) => {
            setSelectedReturn(returnItem);
            setIsDetailsOpen(true);
          }}
          emptyMessage="No returns found"
          className="border-0 rounded-none"
        />
      </Card>

      {/* Modals */}
      <ReturnDetailsModal
        returnItem={selectedReturn}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedReturn(null);
        }}
      />
      <CreateReturnModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
}
