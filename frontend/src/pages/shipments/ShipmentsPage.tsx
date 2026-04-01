import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Truck,
  Package,
  Download,
  Upload,
  Eye,
  Navigation,
  CheckCircle2,
} from 'lucide-react';
import { exportToCSV } from '@/lib/export';
import { importApi } from '@/api/services';
import { useSocketEvent } from '@/hooks';
import {
  Card,
  Button,
  DataTable,
  StatusBadge,
  Tabs,
  useToast,
} from '@/components/ui';
import { formatDate, formatRelativeTime, cn } from '@/lib/utils';
import { ShipmentDetailsModal } from './components';
import { useShipments } from './hooks';
import type { Shipment } from '@/types';

export function ShipmentsPage() {
  const [page, setPage] = useState(1);
  const [activeImportJobId, setActiveImportJobId] = useState<string | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const { success, error } = useToast();
  const importRef = useRef<HTMLInputElement | null>(null);

  const pageSize = 10;
  const shipmentFilters = activeTab === 'all' ? undefined : { status: activeTab };
  const { shipments, totalShipments, stats, isLoading, refetch } = useShipments(page, pageSize, shipmentFilters);

  const formatAddressForRoute = (address?: Shipment['origin'] | Shipment['destination'] | null) => {
    if (!address) return 'N/A';
    const city = address.city?.trim();
    const state = address.state?.trim();
    if (city && state) return `${city}, ${state}`;
    return city || state || 'N/A';
  };

  const handleExport = () => {
    const exportData = shipments.map(shipment => ({
      tracking_number: shipment.trackingNumber,
      carrier: shipment.carrierName,
      status: shipment.status,
      origin: formatAddressForRoute(shipment.origin),
      destination: formatAddressForRoute(shipment.destination),
      weight: shipment.weight,
      cost: shipment.cost,
      estimated_delivery: shipment.estimatedDelivery,
      created_at: shipment.createdAt,
    }));
    exportToCSV(exportData, `shipments_${new Date().toISOString().split('T')[0]}`);
    success('Shipments exported successfully!');
  };

  const handleImportCsv = async (file: File) => {
    try {
      const resp = await importApi.upload(file, 'shipments');
      setActiveImportJobId(resp.jobId);
      success('Shipments import started', `Job queued (${resp.totalRows} rows). Job ID: ${resp.jobId}`);
    } catch (e: any) {
      error('Import failed', e?.message || 'Could not read CSV file');
    }
  };

  useSocketEvent<{
    jobId: string;
    importType: string;
    done: number;
    total: number;
  }>('import:progress', (evt) => {
    if (evt.importType !== 'shipments') return;
    if (activeImportJobId && evt.jobId !== activeImportJobId) return;

    if (evt.done === evt.total || evt.done % 100 === 0) {
      refetch();
    }
  });

  useSocketEvent<{
    jobId: string;
    importType: string;
    total: number;
    created: number;
    failed: number;
    errors?: Array<{ row: number; message: string }>;
    errorMessage?: string;
  }>('import:complete', (evt) => {
    if (evt.importType !== 'shipments') return;
    if (activeImportJobId && evt.jobId !== activeImportJobId) return;

    if (evt.created > 0) {
      const errorPreview = evt.failed && evt.errors?.length
        ? ` | Failed rows: ${evt.errors.slice(0, 3).map((e) => `${e.row}: ${e.message}`).join(' | ')}`
        : '';
      success(
        'Shipments import completed',
        `${evt.created}/${evt.total} created${evt.failed ? `, ${evt.failed} failed` : ''}${errorPreview}`
      );
    } else {
      error('Shipments import failed', evt.errorMessage || `0/${evt.total} created. Check import errors in job logs.`);
    }

    setActiveImportJobId(null);
    refetch();
  });

  // Count shipments per status for tab badges
  const statusCounts = shipments.reduce<Record<string, number>>((acc, shipment) => {
    acc[shipment.status] = (acc[shipment.status] || 0) + 1;
    return acc;
  }, {});

  const tabs = [
    { id: 'all', label: 'All Shipments', count: stats.totalShipments },
    { id: 'in_transit', label: 'In Transit', count: stats.inTransit },
    { id: 'out_for_delivery', label: 'Out for Delivery', count: stats.outForDelivery },
    { id: 'delivered', label: 'Delivered', count: stats.delivered },
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
          <span className="text-gray-700 dark:text-gray-200">{formatAddressForRoute(shipment.origin)}</span>
          <span className="text-gray-400 dark:text-gray-500">→</span>
          <span className="text-gray-700 dark:text-gray-200">{formatAddressForRoute(shipment.destination)}</span>
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
          <Button variant="outline" leftIcon={<Upload className="h-4 w-4" />} onClick={() => importRef.current?.click()}>
            Import
          </Button>
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={handleExport}>
            Export
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Shipments', value: stats.totalShipments, icon: Package, color: 'bg-blue-100 text-blue-600' },
          { label: 'In Transit', value: stats.inTransit, icon: Truck, color: 'bg-yellow-100 text-yellow-600' },
          { label: 'Out for Delivery', value: stats.outForDelivery, icon: Navigation, color: 'bg-purple-100 text-purple-600' },
          { label: 'Delivered', value: stats.delivered, icon: CheckCircle2, color: 'bg-green-100 text-green-600' },
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
        <div className="p-2 sm:p-4 border-b border-gray-100 dark:border-gray-700">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={(tabId) => {
              setActiveTab(tabId);
              setPage(1);
            }}
          />
        </div>

        <DataTable
          columns={columns}
          data={shipments}
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
