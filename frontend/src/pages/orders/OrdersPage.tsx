import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Download,
  Eye,
  Edit,
  ShoppingCart,
} from 'lucide-react';
import {
  Card,
  Button,
  DataTable,
  StatusBadge,
  PriorityBadge,
  Modal,
  Input,
  Select,
  Tabs,
  Badge,
} from '@/components/ui';
import { formatCurrency, formatDate, formatRelativeTime, cn } from '@/lib/utils';
import { ordersApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import type { Order, OrderStatus } from '@/types';

// Order Details Modal
function OrderDetailsModal({ order, isOpen, onClose }: { order: Order | null; isOpen: boolean; onClose: () => void }) {
  if (!order) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Order ${order.orderNumber}`} size="lg">
      <div className="space-y-6">
        {/* Status Section */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
            <StatusBadge status={order.status} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Priority</p>
            <PriorityBadge priority={order.priority} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
            <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(order.totalAmount)}</p>
          </div>
        </div>

        {/* Customer Info */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Customer Information</h4>
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
              <p className="font-medium text-gray-900 dark:text-white">{order.customerName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
              <p className="font-medium text-gray-900 dark:text-white">{order.customerEmail}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
              <p className="font-medium text-gray-900 dark:text-white">{order.customerPhone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
              <p className="font-medium text-gray-900 dark:text-white">{formatDate(order.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Shipping Address</h4>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <p className="text-gray-700 dark:text-gray-300">
              {order.shippingAddress.street}<br />
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />
              {order.shippingAddress.country}
            </p>
          </div>
        </div>

        {/* Order Items */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Order Items</h4>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{item.productName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {item.sku}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.unitPrice)} x {item.quantity}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{formatCurrency(item.unitPrice * item.quantity)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="outline" className="flex-1">
            <Edit className="h-4 w-4 mr-2" />
            Edit Order
          </Button>
          <Button variant="primary" className="flex-1">
            Create Shipment
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Create Order Modal
function CreateOrderModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Order" size="lg">
      <form className="space-y-6">
        {/* Customer Section */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Customer Information</h4>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Customer Name" placeholder="Enter customer name" />
            <Input label="Email" type="email" placeholder="customer@example.com" />
            <Input label="Phone" placeholder="+1 (555) 000-0000" />
            <Select
              label="Priority"
              options={[
                { value: 'standard', label: 'Standard' },
                { value: 'express', label: 'Express' },
                { value: 'bulk', label: 'Bulk' },
              ]}
            />
          </div>
        </div>

        {/* Shipping Address */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Shipping Address</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Street Address" placeholder="123 Main St" />
            </div>
            <Input label="City" placeholder="New York" />
            <Input label="State" placeholder="NY" />
            <Input label="Postal Code" placeholder="10001" />
            <Select
              label="Country"
              options={[
                { value: 'USA', label: 'United States' },
                { value: 'CAN', label: 'Canada' },
                { value: 'UK', label: 'United Kingdom' },
              ]}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1">
            Create Order
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Order Stats Card
function OrderStats({ orders, totalOrders }: { orders: Order[]; totalOrders: number }) {
  const statusCounts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {} as Record<OrderStatus, number>);

  const stats = [
    { label: 'Total Orders', value: totalOrders, color: 'text-gray-900' },
    { label: 'Processing', value: statusCounts['processing'] || 0, color: 'text-yellow-600' },
    { label: 'Shipped', value: statusCounts['shipped'] || 0, color: 'text-purple-600' },
    { label: 'Delivered', value: statusCounts['delivered'] || 0, color: 'text-green-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
          <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
        </motion.div>
      ))}
    </div>
  );
}

// Main Orders Page
export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const pageSize = 10;

  const tabs = [
    { id: 'all', label: 'All Orders', count: totalOrders },
    { id: 'processing', label: 'Processing' },
    { id: 'shipped', label: 'Shipped' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'returned', label: 'Returned' },
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

  useEffect(() => {
    const fetchOrders = async () => {
      const useMockApi = localStorage.getItem('useMockApi') === 'true';
      setIsLoading(true);
      try {
        const response = useMockApi 
          ? await mockApi.getOrders(page, pageSize)
          : await ordersApi.getOrders(page, pageSize);
        setOrders(response.data);
        setTotalOrders(response.total);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
        setOrders([]);
        setTotalOrders(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [page]);

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
          data={orders}
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
