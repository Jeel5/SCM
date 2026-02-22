import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Package, Plus, Clock, ArrowRightLeft, Eye, MapPin } from 'lucide-react';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Card, Button, Badge, DataTable, Tabs, PermissionGate } from '@/components/ui';
import { formatNumber, cn } from '@/lib/utils';
import type { Warehouse } from '@/types';
import { WarehouseCard } from './components/WarehouseCard';
import { WarehouseDetailsModal } from './components/WarehouseDetailsModal';
import { AddWarehouseModal } from './components/AddWarehouseModal';
import { TransferOrderModal } from './components/TransferOrderModal';
import { useWarehouses } from './hooks/useWarehouses';

const MAP_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster' as const,
      source: 'osm',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

// Main Warehouses Page
export function WarehousesPage() {
  const { warehouses, isLoading, refetch } = useWarehouses();
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this warehouse?')) return;

    setIsDeleting(true);
    try {
      const { warehousesApi } = await import('@/api/services');
      await warehousesApi.deleteWarehouse(id);
      setIsDetailsOpen(false);
      setSelectedWarehouse(null);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to delete warehouse');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter warehouses based on tab
  const filteredWarehouses = warehouses.filter((w) =>
    activeTab === 'all' || w.status === activeTab
  );

  const tabs = [
    { id: 'all', label: 'All Warehouses', count: warehouses.length },
    { id: 'active', label: 'Active', count: warehouses.filter((w) => w.status === 'active').length },
    { id: 'maintenance', label: 'Maintenance', count: warehouses.filter((w) => w.status === 'maintenance').length },
    { id: 'inactive', label: 'Inactive', count: warehouses.filter((w) => w.status === 'inactive').length },
  ];

  // Calculate stats
  const totalCapacity = warehouses.reduce((sum, w) => sum + w.capacity, 0);
  const avgUtilization = warehouses.length
    ? warehouses.reduce((sum, w) => sum + w.utilizationPercentage, 0) / warehouses.length
    : 0;
  const activeWarehouses = warehouses.filter((w) => w.status === 'active').length;

  // Calculate map center based on warehouse locations
  const warehousesWithCoords = warehouses.filter((w) => w.location?.lng && w.location?.lat);
  const mapCenter = warehousesWithCoords.length > 0
    ? {
      longitude: warehousesWithCoords.reduce((sum, w) => sum + w.location.lng, 0) / warehousesWithCoords.length,
      latitude: warehousesWithCoords.reduce((sum, w) => sum + w.location.lat, 0) / warehousesWithCoords.length,
      zoom: warehousesWithCoords.length === 1 ? 10 : 4,
    }
    : { longitude: 78.9629, latitude: 20.5937, zoom: 4 }; // Default to India if no warehouses

  const columns = [
    {
      key: 'warehouse',
      header: 'Warehouse',
      sortable: true,
      render: (warehouse: Warehouse) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{warehouse.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{warehouse.address.city}, {warehouse.address.state}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'capacity',
      header: 'Capacity',
      sortable: true,
      render: (warehouse: Warehouse) => (
        <span className="font-medium dark:text-gray-200">{formatNumber(warehouse.capacity)}</span>
      ),
    },
    {
      key: 'inventory',
      header: 'Inventory',
      sortable: true,
      render: (warehouse: Warehouse) => (
        <span className="dark:text-gray-300">{formatNumber(warehouse.inventoryCount)}</span>
      ),
    },
    {
      key: 'utilization',
      header: 'Utilization',
      sortable: true,
      render: (warehouse: Warehouse) => (
        <div className="flex items-center gap-2">
          <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                warehouse.utilizationPercentage >= 90 ? 'bg-red-500' :
                  warehouse.utilizationPercentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
              )}
              style={{ width: `${warehouse.utilizationPercentage}%` }}
            />
          </div>
          <span className="text-sm font-medium">{warehouse.utilizationPercentage}%</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (warehouse: Warehouse) => (
        <Badge
          variant={
            warehouse.status === 'active'
              ? 'success'
              : warehouse.status === 'maintenance'
                ? 'warning'
                : 'default'
          }
          className="capitalize"
        >
          {warehouse.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      render: (warehouse: Warehouse) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedWarehouse(warehouse);
            setIsDetailsOpen(true);
          }}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <Eye className="h-4 w-4 text-gray-500 dark:text-gray-400" />
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Warehouses</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">Manage warehouse locations and inventory</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant={showMap ? 'outline' : 'secondary'}
            onClick={() => setShowMap(!showMap)}
          >
            {showMap ? 'Hide Map' : 'Show Map'}
          </Button>
          <PermissionGate permission="warehouses.update">
            <Button variant="secondary" leftIcon={<ArrowRightLeft className="h-4 w-4" />} onClick={() => setIsTransferOpen(true)}>
              Transfer
            </Button>
          </PermissionGate>
          <PermissionGate permission="warehouses.update">
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsAddOpen(true)}>
              Add Warehouse
            </Button>
          </PermissionGate>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Warehouses',
            value: warehouses.length,
            icon: Building2,
            color: 'bg-blue-100 text-blue-600',
          },
          {
            label: 'Total Capacity',
            value: formatNumber(totalCapacity),
            icon: Package,
            color: 'bg-green-100 text-green-600',
          },
          {
            label: 'Avg. Utilization',
            value: `${avgUtilization.toFixed(1)}%`,
            icon: Building2,
            color: 'bg-purple-100 text-purple-600',
          },
          {
            label: 'Active',
            value: `${activeWarehouses} / ${warehouses.length}`,
            icon: Clock,
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
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Map View */}
      {showMap && (
        <Card>
          <div className="h-125 rounded-xl overflow-hidden">
            <Map
              initialViewState={mapCenter}
              style={{ width: '100%', height: '500px' }}
              mapStyle={MAP_STYLE}
            >
              <NavigationControl position="bottom-right" />
              {warehousesWithCoords.map((warehouse) => (
                <Marker
                  key={warehouse.id}
                  longitude={warehouse.location.lng}
                  latitude={warehouse.location.lat}
                  anchor="bottom"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setSelectedWarehouse(warehouse);
                    setIsDetailsOpen(true);
                  }}
                >
                  <div
                    className={cn(
                      'h-8 w-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center cursor-pointer hover:scale-110 transition-transform',
                      warehouse.status === 'active' ? 'bg-green-500' :
                        warehouse.status === 'maintenance' ? 'bg-yellow-500' : 'bg-gray-500'
                    )}
                  >
                    <Building2 className="h-4 w-4 text-white" />
                  </div>
                </Marker>
              ))}
            </Map>
          </div>
        </Card>
      )}

      {/* Data Table */}
      <Card padding="none">
        <div className="p-2 sm:p-4 border-b border-gray-100 dark:border-gray-700">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>
        <DataTable
          columns={columns}
          data={filteredWarehouses}
          isLoading={isLoading}
          searchPlaceholder="Search warehouses by name, code, or location..."
          onRowClick={(warehouse) => {
            setSelectedWarehouse(warehouse);
            setIsDetailsOpen(true);
          }}
          emptyMessage="No warehouses found"
          className="border-0 rounded-none"
        />
      </Card>

      {/* Modals */}
      <WarehouseDetailsModal
        warehouse={selectedWarehouse}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedWarehouse(null);
        }}
        onEdit={() => {
          setIsDetailsOpen(false);
          setIsAddOpen(true);
        }}
        onDelete={() => selectedWarehouse && handleDelete(selectedWarehouse.id)}
      />

      <AddWarehouseModal
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          if (selectedWarehouse) {
            // If we were editing, optionally clear selected warehouse, or keep it to show details updated
            // We'll clear it for simplicity on close if not successful
          }
        }}
        onSuccess={() => {
          refetch();
          if (selectedWarehouse) {
            // Re-open details if we were editing?
            setSelectedWarehouse(null);
          }
        }}
        initialData={selectedWarehouse}
      />

      <TransferOrderModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        onSuccess={() => {
          refetch();
          setIsTransferOpen(false);
        }}
      />
    </div>
  );
}
