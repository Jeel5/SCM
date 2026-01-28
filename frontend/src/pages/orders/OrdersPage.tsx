import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Download, Eye } from 'lucide-react';
import {
  Card,
  Button,
  DataTable,
  StatusBadge,
  PriorityBadge,
  Tabs,
  Badge,
} from '@/components/ui';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import type { Order } from '@/types';
import { OrderDetailsModal, CreateOrderModal, OrderStats } from './components';
import { useOrders } from './hooks';

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const pageSize = 10;
  const { orders, totalOrders, isLoading } = useOrders(page, pageSize);

  // Count orders per status for tab badges
  const statusCounts = orders.reduce<Record<string, number>>((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});

  // Filter list by active tab
  const filteredOrders = orders.filter((order) => activeTab === 'all' || order.status === activeTab);

  const tabs = [
    { id: 'all', label: 'All Orders', count: orders.length },
    { id: 'processing', label: 'Processing', count: statusCounts.processing || 0 },
    { id: 'shipped', label: 'Shipped', count: statusCounts.shipped || 0 },
    { id: 'delivered', label: 'Delivered', count: statusCounts.delivered || 0 },
    { id: 'returned', label: 'Returned', count: statusCounts.returned || 0 },
  ];

  const columns = [
    {
      key: 'orderNumber',
      header: 'Order',
      sortable: true,
      render: (order: Order) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{order.orderNumber}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{formatRelativeTime(order.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (order: Order) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{order.customerName}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{order.customerEmail}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (order: Order) => <StatusBadge status={order.status} />,
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (order: Order) => <PriorityBadge priority={order.priority} />,
    },
    {
      key: 'items',
      header: 'Items',
      render: (order: Order) => (
        <Badge variant="default">{order.items.length} item(s)</Badge>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      render: (order: Order) => (
        <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(order.totalAmount)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      render: (order: Order) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedOrder(order);
            setIsDetailsOpen(true);
          }}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <Eye className="h-4 w-4 text-gray-500" />
        </button>
      ),
    },
  ];

  const handleRowClick = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Orders</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and track all customer orders</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />}>
            Export
          </Button>
          <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsCreateOpen(true)}>
            New Order
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <OrderStats orders={orders} totalOrders={totalOrders} />

      {/* Tabs */}
      <Card padding="none">
        <div className="p-4 border-b border-gray-100">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={filteredOrders}
          isLoading={isLoading}
          searchPlaceholder="Search orders..."
          pagination={{
            page,
            pageSize,
            total: totalOrders,
            onPageChange: setPage,
          }}
          onRowClick={handleRowClick}
          emptyMessage="No orders found"
          className="border-0 rounded-none"
        />
      </Card>

      {/* Modals */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedOrder(null);
        }}
      />
      <CreateOrderModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
}
