import { useState } from 'react';
import { motion } from 'framer-motion';
import { Truck, Star, Clock, Package, Plus, Eye } from 'lucide-react';
import { Card, Button, Badge, Progress, DataTable, Tabs } from '@/components/ui';
import { formatNumber, cn } from '@/lib/utils';
import type { Carrier } from '@/types';
import { RatingStars } from './components/RatingStars';
import { CarrierCard } from './components/CarrierCard';
import { CarrierDetailsModal } from './components/CarrierDetailsModal';
import { AddCarrierModal } from './components/AddCarrierModal';
import { useCarriers } from './hooks/useCarriers';

// Main Carriers Page
export function CarriersPage() {
  const { carriers, isLoading } = useCarriers();
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [activeTab, setActiveTab] = useState('all');

  const tabs = [
    { id: 'all', label: 'All Carriers', count: carriers.length },
    { id: 'active', label: 'Active', count: carriers.filter((c) => c.status === 'active').length },
    { id: 'inactive', label: 'Inactive', count: carriers.filter((c) => c.status === 'inactive').length },
    { id: 'suspended', label: 'Suspended', count: carriers.filter((c) => c.status === 'suspended').length },
  ];

  // Calculate stats
  const avgOnTime = carriers.length
    ? carriers.reduce((sum, c) => sum + c.onTimeDeliveryRate, 0) / carriers.length
    : 0;
  const totalActiveShipments = carriers.reduce((sum, c) => sum + c.activeShipments, 0);

  const columns = [
    {
      key: 'carrier',
      header: 'Carrier',
      sortable: true,
      render: (carrier: Carrier) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Truck className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{carrier.name}</p>
            <RatingStars rating={carrier.rating} />
          </div>
        </div>
      ),
    },
    {
      key: 'onTime',
      header: 'On-Time',
      sortable: true,
      render: (carrier: Carrier) => (
        <div className="flex items-center gap-2">
          <Progress value={carrier.onTimeDeliveryRate} size="sm" className="w-20" />
          <span className="text-sm font-medium">{carrier.onTimeDeliveryRate}%</span>
        </div>
      ),
    },
    {
      key: 'shipments',
      header: 'Active Shipments',
      sortable: true,
      render: (carrier: Carrier) => (
        <span className="font-medium">{formatNumber(carrier.activeShipments)}</span>
      ),
    },
    {
      key: 'avgTime',
      header: 'Avg. Time',
      render: (carrier: Carrier) => <span>{carrier.averageDeliveryTime}h</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (carrier: Carrier) => (
        <Badge
          variant={
            carrier.status === 'active'
              ? 'success'
              : carrier.status === 'suspended'
                ? 'error'
                : 'warning'
          }
          className="capitalize"
        >
          {carrier.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      render: (carrier: Carrier) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCarrier(carrier);
            setIsDetailsOpen(true);
          }}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
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
          <h1 className="text-2xl font-bold text-gray-900">Carriers</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage shipping carriers and track performance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-gray-200 p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                viewMode === 'grid'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                viewMode === 'table'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Table
            </button>
          </div>
          <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsAddOpen(true)}>
            Add Carrier
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Carriers',
            value: carriers.length,
            icon: Truck,
            color: 'bg-blue-100 text-blue-600',
          },
          {
            label: 'Active Shipments',
            value: formatNumber(totalActiveShipments),
            icon: Package,
            color: 'bg-green-100 text-green-600',
          },
          {
            label: 'Avg On-Time',
            value: `${avgOnTime.toFixed(1)}%`,
            icon: Clock,
            color: 'bg-purple-100 text-purple-600',
          },
          {
            label: 'Top Performer',
            value: carriers.length
              ? carriers.sort((a, b) => b.rating - a.rating)[0]?.name || 'N/A'
              : 'N/A',
            icon: Star,
            color: 'bg-yellow-100 text-yellow-600',
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
            <p className="text-2xl font-bold text-gray-900 dark:text-white truncate">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : viewMode === 'grid' ? (
        <>
          <div className="border-b border-gray-200 dark:border-gray-700">
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {carriers
              .filter((c) => activeTab === 'all' || c.status === activeTab)
              .map((carrier, index) => (
                <CarrierCard
                  key={carrier.id}
                  carrier={carrier}
                  index={index}
                  totalInRow={3}
                  onViewDetails={() => {
                    setSelectedCarrier(carrier);
                    setIsDetailsOpen(true);
                  }}
                />
              ))}
          </div>
        </>
      ) : (
        <Card padding="none">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          </div>
          <DataTable
            columns={columns}
            data={carriers.filter((c) => activeTab === 'all' || c.status === activeTab)}
            isLoading={isLoading}
            searchPlaceholder="Search carriers..."
            onRowClick={(carrier) => {
              setSelectedCarrier(carrier);
              setIsDetailsOpen(true);
            }}
            emptyMessage="No carriers found"
            className="border-0 rounded-none"
          />
        </Card>
      )}

      {/* Modals */}
      <CarrierDetailsModal
        carrier={selectedCarrier}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedCarrier(null);
        }}
      />

      <AddCarrierModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </div>
  );
}
