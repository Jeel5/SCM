import { useState } from 'react';
import { motion } from 'framer-motion';
import { Truck, Star, Clock, Package, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { Card, Button, Badge, Progress, DataTable, Tabs, PermissionGate } from '@/components/ui';
import { formatNumber, cn } from '@/lib/utils';
import type { Carrier } from '@/types';
import { RatingStars } from './components/RatingStars';
import { CarrierCard } from './components/CarrierCard';
import { CarrierDetailsModal } from './components/CarrierDetailsModal';
import { AddCarrierModal } from './components/AddCarrierModal';
import { EditCarrierModal } from './components/EditCarrierModal';
import { useCarriers } from './hooks/useCarriers';
import { carriersApi } from '@/api/services';
import { toast } from '@/stores/toastStore';

// Main Carriers Page
export function CarriersPage() {
  const { carriers, isLoading, refetch } = useCarriers();
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [activeTab, setActiveTab] = useState('all');

  const handleEdit = (carrier: Carrier) => {
    setSelectedCarrier(carrier);
    setIsDetailsOpen(false);
    setIsEditOpen(true);
  };

  const handleDelete = async (carrier: Carrier) => {
    if (!confirm(`Are you sure you want to deactivate "${carrier.name}"? This carrier will no longer be available for new shipments.`)) return;
    try {
      await carriersApi.deleteCarrier(carrier.id);
      toast.success('Carrier deactivated successfully');
      setIsDetailsOpen(false);
      setSelectedCarrier(null);
      refetch();
    } catch (error: any) {
      if (!error.response) {
        toast.error('Failed to deactivate carrier', error.message);
      }
    }
  };

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
          <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{carrier.name}</p>
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
        <span className="font-medium dark:text-gray-200">{formatNumber(carrier.activeShipments)}</span>
      ),
    },
    {
      key: 'avgTime',
      header: 'Avg. Time',
      render: (carrier: Carrier) => <span className="dark:text-gray-300">{carrier.averageDeliveryTime}h</span>,
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
      width: '120px',
      render: (carrier: Carrier) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCarrier(carrier);
              setIsDetailsOpen(true);
            }}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="View Details"
          >
            <Eye className="h-4 w-4 text-gray-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(carrier);
            }}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Edit"
          >
            <Edit className="h-4 w-4 text-gray-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(carrier);
            }}
            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Deactivate"
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </button>
        </div>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Carriers</h1>
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
          <PermissionGate permission="settings.organization">
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsAddOpen(true)}>
              Add Carrier
            </Button>
          </PermissionGate>
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
                  onEdit={() => handleEdit(carrier)}
                  onDelete={() => handleDelete(carrier)}
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
        onEdit={() => selectedCarrier && handleEdit(selectedCarrier)}
        onDelete={() => selectedCarrier && handleDelete(selectedCarrier)}
      />

      <AddCarrierModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} onSuccess={refetch} />

      <EditCarrierModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedCarrier(null);
        }}
        onSuccess={refetch}
        carrier={selectedCarrier}
      />
    </div>
  );
}
