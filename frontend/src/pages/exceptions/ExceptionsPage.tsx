import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, AlertCircle, Clock, CheckCircle2, Eye, Download, RefreshCw } from 'lucide-react';
import { Card, Button, DataTable, StatusBadge, SeverityBadge, Tabs } from '@/components/ui';
import { formatRelativeTime, cn } from '@/lib/utils';
import type { Exception } from '@/types';
import { ExceptionDetailsModal } from './components/ExceptionDetailsModal';
import { useExceptions } from './hooks/useExceptions';

// Main Exceptions Page
export function ExceptionsPage() {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { exceptions, totalExceptions, isLoading } = useExceptions(page, pageSize);
  const [selectedException, setSelectedException] = useState<Exception | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Calculate stats
  const criticalCount = exceptions.filter((e) => e.severity === 'critical').length;
  const openCount = exceptions.filter((e) => e.status === 'open').length;
  const resolvedCount = exceptions.filter((e) => e.status === 'resolved').length;

  // Count exceptions per status for tab badges
  const statusCounts = exceptions.reduce<Record<string, number>>((acc, exception) => {
    acc[exception.status] = (acc[exception.status] || 0) + 1;
    return acc;
  }, {});

  // Filter list by active tab
  const filteredExceptions = exceptions.filter((exception) => activeTab === 'all' || exception.status === activeTab);

  const tabs = [
    { id: 'all', label: 'All Exceptions', count: exceptions.length },
    { id: 'open', label: 'Open', count: statusCounts.open || 0 },
    { id: 'in_progress', label: 'In Progress', count: statusCounts.in_progress || 0 },
    { id: 'resolved', label: 'Resolved', count: statusCounts.resolved || 0 },
  ];

  const columns = [
    {
      key: 'exception',
      header: 'Exception',
      render: (exception: Exception) => (
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'h-10 w-10 rounded-lg flex items-center justify-center',
              exception.severity === 'critical'
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : exception.severity === 'high'
                  ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                  : exception.severity === 'medium'
                    ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white capitalize">
              {exception.type.replace('_', ' ')}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
              {exception.description}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (exception: Exception) => <SeverityBadge severity={exception.severity} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (exception: Exception) => <StatusBadge status={exception.status} />,
    },
    {
      key: 'orderId',
      header: 'Order',
      render: (exception: Exception) => (
        <span className="text-gray-700 dark:text-gray-200">{exception.orderId}</span>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      sortable: true,
      render: (exception: Exception) => (
        <span className="text-gray-500 dark:text-gray-400">{formatRelativeTime(exception.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      render: (exception: Exception) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedException(exception);
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Exceptions</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Monitor and resolve logistics exceptions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />}>
            Export
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Exceptions',
            value: totalExceptions,
            icon: AlertTriangle,
            color: 'bg-blue-100 text-blue-600',
          },
          {
            label: 'Critical',
            value: criticalCount,
            icon: AlertCircle,
            color: 'bg-red-100 text-red-600',
          },
          {
            label: 'Open',
            value: openCount,
            icon: Clock,
            color: 'bg-yellow-100 text-yellow-600',
          },
          {
            label: 'Resolved',
            value: resolvedCount,
            icon: CheckCircle2,
            color: 'bg-green-100 text-green-600',
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
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

      {/* Critical Alerts Banner */}
      {criticalCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="font-semibold text-red-800 dark:text-red-300">
                {criticalCount} Critical Exception{criticalCount > 1 ? 's' : ''} Require Immediate Attention
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">Please review and resolve these issues as soon as possible.</p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            className="bg-red-600 hover:bg-red-700 shadow-none"
            onClick={() => setActiveTab('open')}
          >
            View Critical
          </Button>
        </motion.div>
      )}

      {/* Data Table */}
      <Card padding="none">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        <DataTable
          columns={columns}
          data={filteredExceptions}
          isLoading={isLoading}
          searchPlaceholder="Search exceptions..."
          pagination={{
            page,
            pageSize,
            total: totalExceptions,
            onPageChange: setPage,
          }}
          onRowClick={(exception) => {
            setSelectedException(exception);
            setIsDetailsOpen(true);
          }}
          emptyMessage="No exceptions found"
          className="border-0 rounded-none"
        />
      </Card>

      {/* Details Modal */}
      <ExceptionDetailsModal
        exception={selectedException}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedException(null);
        }}
      />
    </div>
  );
}
