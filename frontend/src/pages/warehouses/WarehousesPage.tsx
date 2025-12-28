import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  MapPin,
  Package,
  Plus,
  Eye,
  Edit,
  MoreHorizontal,
  Boxes,
  Truck,
  Clock,
} from 'lucide-react';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Card,
  Button,
  Badge,
  Modal,
  Input,
  Select,
  Progress,
  Dropdown,
} from '@/components/ui';
import { formatNumber, cn } from '@/lib/utils';
import { mockApi } from '@/api/mockData';
import type { Warehouse } from '@/types';

// OpenStreetMap style - free, no token required
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

// Warehouse Card Component
function WarehouseCard({
  warehouse,
  onViewDetails,
}: {
  warehouse: Warehouse;
  onViewDetails: () => void;
}) {
  const utilizationColor =
    warehouse.utilizationPercentage >= 90
      ? 'text-red-600'
      : warehouse.utilizationPercentage >= 70
        ? 'text-yellow-600'
        : 'text-green-600';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-12 w-12 rounded-xl flex items-center justify-center',
                warehouse.status === 'active'
                  ? 'bg-green-100 text-green-600'
                  : warehouse.status === 'maintenance'
                    ? 'bg-yellow-100 text-yellow-600'
                    : 'bg-gray-100 text-gray-600'
              )}
            >
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{warehouse.name}</h3>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <MapPin className="h-3 w-3" />
                {warehouse.address.city}, {warehouse.address.country}
              </div>
            </div>
          </div>
          <Dropdown
            trigger={
              <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <MoreHorizontal className="h-4 w-4 text-gray-500" />
              </button>
            }
            items={[
              { label: 'View Details', value: 'view', icon: <Eye className="h-4 w-4" /> },
              { label: 'Edit', value: 'edit', icon: <Edit className="h-4 w-4" /> },
            ]}
            onSelect={(value) => {
              if (value === 'view') onViewDetails();
            }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-4 grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Capacity</p>
          <p className="text-lg font-semibold text-gray-900">{formatNumber(warehouse.capacity)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Utilization</p>
          <p className={cn('text-lg font-semibold', utilizationColor)}>
            {warehouse.utilizationPercentage}%
          </p>
        </div>
      </div>

      {/* Utilization Bar */}
      <div className="px-4 pb-4">
        <Progress
          value={warehouse.utilizationPercentage}
          variant={
            warehouse.utilizationPercentage >= 90
              ? 'error'
              : warehouse.utilizationPercentage >= 70
                ? 'warning'
                : 'success'
          }
        />
      </div>

      {/* Footer Stats */}
      <div className="p-4 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <Boxes className="h-4 w-4" />
            {formatNumber(warehouse.inventoryCount)} items
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <Truck className="h-4 w-4" />
            {warehouse.zones} zones
          </div>
        </div>
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
      </div>
    </motion.div>
  );
}

// Warehouse Details Modal
function WarehouseDetailsModal({
  warehouse,
  isOpen,
  onClose,
}: {
  warehouse: Warehouse | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!warehouse) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={warehouse.name} size="xl">
      <div className="space-y-6">
        {/* Map */}
        <div className="h-48 rounded-xl overflow-hidden border border-gray-200">
          <Map
            initialViewState={{
              longitude: warehouse.location.lng,
              latitude: warehouse.location.lat,
              zoom: 12,
            }}
            style={{ width: '100%', height: '100%' }}
            mapStyle={MAP_STYLE}
          >
            <NavigationControl position="bottom-right" />
            <Marker
              longitude={warehouse.location.lng}
              latitude={warehouse.location.lat}
              anchor="bottom"
            >
              <div className="h-8 w-8 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                <Building2 className="h-4 w-4 text-white" />
              </div>
            </Marker>
          </Map>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-xl">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Package className="h-4 w-4" />
              <span className="text-sm font-medium">Total Capacity</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(warehouse.capacity)}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-xl">
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <Boxes className="h-4 w-4" />
              <span className="text-sm font-medium">Items Stored</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(warehouse.inventoryCount)}</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-xl">
            <div className="flex items-center gap-2 text-purple-600 mb-2">
              <Building2 className="h-4 w-4" />
              <span className="text-sm font-medium">Utilization</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{warehouse.utilizationPercentage}%</p>
          </div>
        </div>

        {/* Location Details */}
        <div className="p-4 bg-gray-50 rounded-xl">
          <h4 className="font-medium text-gray-900 mb-3">Location Details</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Address</p>
              <p className="text-gray-900">{warehouse.address.street}</p>
            </div>
            <div>
              <p className="text-gray-500">City</p>
              <p className="text-gray-900">{warehouse.address.city}</p>
            </div>
            <div>
              <p className="text-gray-500">State</p>
              <p className="text-gray-900">{warehouse.address.state}</p>
            </div>
            <div>
              <p className="text-gray-500">Country</p>
              <p className="text-gray-900">{warehouse.address.country}</p>
            </div>
          </div>
        </div>

        {/* Zones */}
        {warehouse.zones > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Warehouse Zones: {warehouse.zones}</h4>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: warehouse.zones }, (_, i) => (
                <div
                  key={i}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-200 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">Zone {i + 1}</span>
                    <Badge variant="default" className="capitalize">
                      Storage
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <Progress value={((i * 17 + 7) % 80) + 20} size="sm" />
                    <p className="text-xs text-gray-500">Active</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        <div className="p-4 bg-gray-50 rounded-xl">
          <h4 className="font-medium text-gray-900 mb-3">Contact Information</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Manager ID</p>
              <p className="text-gray-900">{warehouse.managerId || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500">Phone</p>
              <p className="text-gray-900">{warehouse.contactPhone}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500">Email</p>
              <p className="text-gray-900">{warehouse.contactEmail}</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Add Warehouse Modal
function AddWarehouseModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Warehouse" size="lg">
      <form className="space-y-4">
        <Input label="Warehouse Name" placeholder="Enter warehouse name" required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Address" placeholder="Street address" required />
          <Input label="City" placeholder="City" required />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input label="State" placeholder="State" required />
          <Input label="Zip Code" placeholder="Zip" required />
          <Select
            label="Country"
            options={[
              { value: 'US', label: 'United States' },
              { value: 'CA', label: 'Canada' },
              { value: 'UK', label: 'United Kingdom' },
              { value: 'DE', label: 'Germany' },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Capacity" type="number" placeholder="Total capacity" required />
          <Select
            label="Status"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Manager Name" placeholder="Warehouse manager" required />
          <Input label="Manager Email" type="email" placeholder="Email" required />
        </div>
        <div className="flex items-center gap-3 pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1">
            Add Warehouse
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Main Warehouses Page
export function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  useEffect(() => {
    const fetchWarehouses = async () => {
      setIsLoading(true);
      try {
        const response = await mockApi.getWarehouses();
        setWarehouses(response.data);
      } catch (error) {
        console.error('Failed to fetch warehouses:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWarehouses();
  }, []);

  // Calculate stats
  const totalCapacity = warehouses.reduce((sum, w) => sum + w.capacity, 0);
  const avgUtilization = warehouses.length
    ? warehouses.reduce((sum, w) => sum + w.utilizationPercentage, 0) / warehouses.length
    : 0;
  const activeWarehouses = warehouses.filter((w) => w.status === 'active').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Warehouses</h1>
          <p className="text-gray-500 mt-1">Manage warehouse locations and capacity</p>
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
              onClick={() => setViewMode('map')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                viewMode === 'map'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Map
            </button>
          </div>
          <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsAddOpen(true)}>
            Add Warehouse
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
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

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {warehouses.map((warehouse) => (
            <WarehouseCard
              key={warehouse.id}
              warehouse={warehouse}
              onViewDetails={() => {
                setSelectedWarehouse(warehouse);
                setIsDetailsOpen(true);
              }}
            />
          ))}
        </div>
      ) : (
        <Card>
          <div className="h-125 rounded-xl overflow-hidden">
            <Map
              initialViewState={{
                longitude: 78.9629,
                latitude: 20.5937,
                zoom: 4,
              }}
              style={{ width: '100%', height: '500px' }}
              mapStyle={MAP_STYLE}
            >
              <NavigationControl position="bottom-right" />
              {warehouses.map((warehouse) => (
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

      {/* Modals */}
      <WarehouseDetailsModal
        warehouse={selectedWarehouse}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedWarehouse(null);
        }}
      />

      <AddWarehouseModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </div>
  );
}
