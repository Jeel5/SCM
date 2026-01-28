import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Truck,
  Package,
  Download,
  RefreshCw,
  Eye,
  Navigation,
  CheckCircle2,
} from 'lucide-react';
import {
  Card,
  Button,
  DataTable,
  StatusBadge,
  Tabs,
} from '@/components/ui';
import { formatDate, formatRelativeTime, cn } from '@/lib/utils';
import { ShipmentDetailsModal } from './components';
import { useShipments } from './hooks';
import type { Shipment } from '@/types';

export function ShipmentsPage() {
  const [page, setPage] = useState(1);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const pageSize = 10;
  const { shipments, totalShipments, isLoading } = useShipments(page, pageSize);

  // Count shipments per status for tab badges
  const statusCounts = shipments.reduce<Record<string, number>>((acc, shipment) => {
    acc[shipment.status] = (acc[shipment.status] || 0) + 1;
    return acc;
  }, {});

  // Filter list by active tab
  const filteredShipments = shipments.filter((shipment) => activeTab === 'all' || shipment.status === activeTab);

  const tabs = [
    { id: 'all', label: 'All Shipments', count: shipments.length },
    { id: 'in_transit', label: 'In Transit', count: statusCounts.in_transit || 0 },
    { id: 'out_for_delivery', label: 'Out for Delivery', count: statusCounts.out_for_delivery || 0 },
    { id: 'delivered', label: 'Delivered', count: statusCounts.delivered || 0 },
    { id: 'failed_delivery', label: 'Failed', count: statusCounts.failed_delivery || 0 },
  ];

  const columns = [
    {
      key: 'tracking',
      header: 'Tracking',
      sortable: true,
      render: (shipment: Shipment) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{shipment.trackingNumber}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{formatRelativeTime(shipment.updatedAt)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'carrier',
      header: 'Carrier',
      render: (shipment: Shipment) => (
        <span className="font-medium text-gray-700 dark:text-gray-200">{shipment.carrierName}</span>
      ),
    },
    {
      key: 'route',
      header: 'Route',
      render: (shipment: Shipment) => (
        <div className="flex items-center gap-2">
          <span className="text-gray-700 dark:text-gray-200">{shipment.origin.city}</span>
          <span className="text-gray-400 dark:text-gray-500">→</span>
          <span className="text-gray-700 dark:text-gray-200">{shipment.destination.city}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (shipment: Shipment) => <StatusBadge status={shipment.status} />,
    },
    {
      key: 'eta',
      header: 'Est. Delivery',
      sortable: true,
      render: (shipment: Shipment) => (
        <span className="text-gray-700 dark:text-gray-200">{formatDate(shipment.estimatedDelivery)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      render: (shipment: Shipment) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedShipment(shipment);
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shipments</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track and manage all shipments in real-time</p>
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
          { label: 'Total Shipments', value: totalShipments, icon: Package, color: 'bg-blue-100 text-blue-600' },
          { label: 'In Transit', value: shipments.filter((s) => s.status === 'in_transit').length, icon: Truck, color: 'bg-yellow-100 text-yellow-600' },
          { label: 'Out for Delivery', value: shipments.filter((s) => s.status === 'out_for_delivery').length, icon: Navigation, color: 'bg-purple-100 text-purple-600' },
          { label: 'Delivered', value: shipments.filter((s) => s.status === 'delivered').length, icon: CheckCircle2, color: 'bg-green-100 text-green-600' },
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
          data={filteredShipments}
          isLoading={isLoading}
          searchPlaceholder="Search by tracking number..."
          pagination={{
            page,
            pageSize,
            total: totalShipments,
            onPageChange: setPage,
          }}
          onRowClick={(shipment) => {
            setSelectedShipment(shipment);
            setIsDetailsOpen(true);
          }}
          emptyMessage="No shipments found"
          className="border-0 rounded-none"
        />
      </Card>

      {/* Details Modal */}
      <ShipmentDetailsModal
        shipment={selectedShipment}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedShipment(null);
        }}
      />
    </div>
  );
}
