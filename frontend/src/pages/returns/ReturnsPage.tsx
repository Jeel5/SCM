import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  RotateCcw,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Plus,
  Download,
  ArrowRight,
  DollarSign,
  Truck,
} from 'lucide-react';
import {
  Card,
  Button,
  DataTable,
  StatusBadge,
  Badge,
  Modal,
  Input,
  Select,
  Tabs,
} from '@/components/ui';
import { formatDate, formatCurrency, formatRelativeTime, cn } from '@/lib/utils';
import { mockApi } from '@/api/mockData';
import type { Return } from '@/types';

// Return Details Modal
function ReturnDetailsModal({
  returnItem,
  isOpen,
  onClose,
}: {
  returnItem: Return | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!returnItem) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Return ${returnItem.id}`} size="lg">
      <div className="space-y-6">
        {/* Status Header */}
        <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                <RotateCcw className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 capitalize">
                  {returnItem.reason.replace('_', ' ')}
                </p>
                <p className="text-sm text-gray-500">
                  Requested: {formatDate(returnItem.requestedAt)}
                </p>
              </div>
            </div>
            <StatusBadge status={returnItem.status} />
          </div>
        </div>

        {/* Return Flow */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div className="text-center">
            <p className="text-sm text-gray-500">Order</p>
            <p className="font-medium text-gray-900">{returnItem.orderId}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400" />
          <div className="text-center">
            <p className="text-sm text-gray-500">Return Type</p>
            <p className="font-medium text-gray-900 capitalize">{returnItem.type}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400" />
          <div className="text-center">
            <p className="text-sm text-gray-500">Refund Amount</p>
            <p className="font-semibold text-green-600">{formatCurrency(returnItem.refundAmount || 0)}</p>
          </div>
        </div>

        {/* Items */}
        <div className="p-4 bg-gray-50 rounded-xl">
          <h4 className="font-medium text-gray-900 mb-3">Return Items</h4>
          <div className="space-y-2">
            {returnItem.items.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Package className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{item.productName || item.name}</p>
                    <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                  </div>
                </div>
                <Badge variant={item.condition === 'good' ? 'success' : 'warning'} className="capitalize">
                  {item.condition || 'unknown'}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {returnItem.notes && (
          <div className="p-4 bg-gray-50 rounded-xl">
            <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
            <p className="text-gray-600">{returnItem.notes}</p>
          </div>
        )}

        {/* Tracking */}
        {returnItem.trackingNumber && (
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex items-center gap-2 text-blue-700 mb-2">
              <Truck className="h-5 w-5" />
              <span className="font-medium">Return Shipment</span>
            </div>
            <p className="text-blue-700">Tracking: {returnItem.trackingNumber}</p>
          </div>
        )}

        {/* Actions */}
        {returnItem.status === 'pending' && (
          <div className="flex items-center gap-3">
            <Button variant="primary" className="flex-1" leftIcon={<CheckCircle2 className="h-4 w-4" />}>
              Approve Return
            </Button>
            <Button variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50" leftIcon={<XCircle className="h-4 w-4" />}>
              Reject Return
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// Create Return Modal
function CreateReturnModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Return Request" size="lg">
      <form className="space-y-4">
        <Input label="Order ID" placeholder="Enter order ID" required />
        <Select
          label="Return Type"
          options={[
            { value: 'refund', label: 'Refund' },
            { value: 'exchange', label: 'Exchange' },
            { value: 'store_credit', label: 'Store Credit' },
          ]}
          required
        />
        <Select
          label="Return Reason"
          options={[
            { value: 'damaged', label: 'Item Damaged' },
            { value: 'wrong_item', label: 'Wrong Item Received' },
            { value: 'not_as_described', label: 'Not as Described' },
            { value: 'changed_mind', label: 'Changed Mind' },
            { value: 'defective', label: 'Defective Product' },
            { value: 'other', label: 'Other' },
          ]}
          required
        />
        <Input label="Refund Amount" type="number" placeholder="0.00" required />
        <Input label="Notes" placeholder="Additional information about the return" />
        <div className="flex items-center gap-3 pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1">
            Create Return
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Main Returns Page
export function ReturnsPage() {
  const [returns, setReturns] = useState<Return[]>([]);
  const [totalReturns, setTotalReturns] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const pageSize = 10;

  // Calculate stats
  const pendingCount = returns.filter((r) => r.status === 'pending' || r.status === 'requested').length;
  const totalRefunded = returns
    .filter((r) => r.status === 'completed' || r.status === 'refunded')
    .reduce((sum, r) => sum + (r.refundAmount || 0), 0);

  const tabs = [
    { id: 'all', label: 'All Returns', count: totalReturns },
    { id: 'pending', label: 'Pending', count: pendingCount },
    { id: 'approved', label: 'Approved' },
    { id: 'processing', label: 'Processing' },
    { id: 'completed', label: 'Completed' },
    { id: 'rejected', label: 'Rejected' },
  ];

  const columns = [
    {
      key: 'return',
      header: 'Return',
      render: (returnItem: Return) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <RotateCcw className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{returnItem.id}</p>
            <p className="text-sm text-gray-500">{returnItem.orderId}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (returnItem: Return) => (
        <span className="text-gray-700 capitalize">{returnItem.reason.replace('_', ' ')}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (returnItem: Return) => (
        <Badge variant="default" className="capitalize">
          {returnItem.type}
        </Badge>
      ),
    },
    {
      key: 'amount',
      header: 'Refund',
      sortable: true,
      render: (returnItem: Return) => (
        <span className="font-medium text-gray-900">{formatCurrency(returnItem.refundAmount || 0)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (returnItem: Return) => <StatusBadge status={returnItem.status} />,
    },
    {
      key: 'requested',
      header: 'Requested',
      sortable: true,
      render: (returnItem: Return) => (
        <span className="text-gray-500">{formatRelativeTime(returnItem.requestedAt)}</span>
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
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Eye className="h-4 w-4 text-gray-500" />
        </button>
      ),
    },
  ];

  useEffect(() => {
    const fetchReturns = async () => {
      setIsLoading(true);
      try {
        const response = await mockApi.getReturns(page, pageSize);
        setReturns(response.data);
        setTotalReturns(response.total);
      } catch (error) {
        console.error('Failed to fetch returns:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReturns();
  }, [page]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Returns</h1>
          <p className="text-gray-500 mt-1">Manage return requests and refunds</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />}>
            Export
          </Button>
          <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsCreateOpen(true)}>
            Create Return
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Returns',
            value: totalReturns,
            icon: RotateCcw,
            color: 'bg-purple-100 text-purple-600',
          },
          {
            label: 'Pending',
            value: pendingCount,
            icon: Clock,
            color: 'bg-yellow-100 text-yellow-600',
          },
          {
            label: 'Total Refunded',
            value: formatCurrency(totalRefunded),
            icon: DollarSign,
            color: 'bg-green-100 text-green-600',
          },
          {
            label: 'Avg Processing',
            value: '2.3 days',
            icon: Clock,
            color: 'bg-blue-100 text-blue-600',
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-4 bg-white rounded-xl border border-gray-100"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', stat.color)}>
                <stat.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Data Table */}
      <Card padding="none">
        <div className="p-4 border-b border-gray-100">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        <DataTable
          columns={columns}
          data={returns}
          isLoading={isLoading}
          searchPlaceholder="Search returns..."
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
