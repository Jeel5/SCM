import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Download, Upload, Eye } from 'lucide-react';
import { exportToCSV } from '@/lib/export';
import { readCsvFile } from '@/lib/csvImport';
import { ordersApi } from '@/api/services';
import { useToast } from '@/components/ui';
import {
  Card,
  Button,
  DataTable,
  StatusBadge,
  PriorityBadge,
  Tabs,
  PermissionGate,
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
  const { success, error } = useToast();
  const importRef = useRef<HTMLInputElement | null>(null);

  const pageSize = 10;
  const { orders, totalOrders, isLoading, refetch } = useOrders(page, pageSize);

  const handleExport = () => {
    const exportData = filteredOrders.map(order => ({
      order_number: order.orderNumber,
      customer_name: order.customerName,
      customer_email: order.customerEmail,
      status: order.status,
      priority: order.priority,
      items_count: order.items?.length || 0,
      total_amount: order.totalAmount,
      created_at: order.createdAt,
      estimated_delivery: order.estimatedDelivery || 'N/A',
    }));
    exportToCSV(exportData, `orders_${new Date().toISOString().split('T')[0]}`);
    success('Orders exported successfully!');
  };

  const handleImportCsv = async (file: File) => {
    try {
      const rows = await readCsvFile(file);
      if (!rows.length) {
        error('CSV is empty', 'Please upload a valid CSV file with headers');
        return;
      }

      let created = 0;
      let failed = 0;
      for (const row of rows) {
        try {
          await ordersApi.createOrder({
            customer_name: row.customer_name,
            customer_email: row.customer_email,
            customer_phone: row.customer_phone || null,
            priority: row.priority || 'standard',
            shipping_address: {
              street: row.street || 'N/A',
              city: row.city || 'N/A',
              state: row.state || 'N/A',
              postal_code: row.postal_code || '',
              country: row.country || 'India',
            },
            items: [
              {
                sku: row.sku,
                product_name: row.product_name || row.sku,
                quantity: Number(row.quantity) || 1,
                unit_price: Number(row.unit_price) || 0,
              },
            ],
          } as any);
          created += 1;
        } catch {
          failed += 1;
        }
      }
      if (created > 0) {
        success('Orders import completed', `${created} created${failed ? `, ${failed} failed` : ''}`);
        refetch();
      } else {
        error('Orders import failed', 'No rows were imported. Check CSV column names and values.');
      }
    } catch (e: any) {
      error('Import failed', e?.message || 'Could not read CSV file');
    }
  };

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
      sortable: true,
      render: (order: Order) => (
        <Badge variant="default" className="whitespace-nowrap">
          {order.items?.length || 0} <span className="hidden sm:inline">item(s)</span><span className="sm:hidden">items</span>
        </Badge>
      ),
    },
    {
      key: 'totalAmount',
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
          <Eye className="h-4 w-4 text-gray-500 dark:text-gray-400" />
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Orders</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">Manage and track all customer orders</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="outline" leftIcon={<Upload className="h-4 w-4" />} onClick={() => importRef.current?.click()}>
            Import
          </Button>
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={handleExport}>
            Export
          </Button>
          <PermissionGate permission="orders.create">
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsCreateOpen(true)}>
              New Order
            </Button>
          </PermissionGate>
        </div>
      </motion.div>

      {/* Stats */}
      <OrderStats orders={orders} totalOrders={totalOrders} />

      {/* Tabs */}
      <Card padding="none">
        <div className="p-2 sm:p-4 border-b border-gray-100 dark:border-gray-700">
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
        onUpdate={() => {
          setIsDetailsOpen(false);
          setSelectedOrder(null);
          refetch();
        }}
      />
      <CreateOrderModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSuccess={refetch} />
      <input
        ref={importRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportCsv(file);
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
}
