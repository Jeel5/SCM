import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Package, Plus, Clock } from 'lucide-react';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Card, Button } from '@/components/ui';
import { formatNumber, cn } from '@/lib/utils';
import type { Warehouse } from '@/types';
import { WarehouseCard } from './components/WarehouseCard';
import { WarehouseDetailsModal } from './components/WarehouseDetailsModal';
import { AddWarehouseModal } from './components/AddWarehouseModal';
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
  const { warehouses, isLoading } = useWarehouses();
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  // Calculate stats
  const totalCapacity = warehouses.reduce((sum, w) => sum + w.capacity, 0);
  const avgUtilization = warehouses.length
    ? warehouses.reduce((sum, w) => sum + w.utilizationPercentage, 0) / warehouses.length
    : 0;
  const activeWarehouses = warehouses.filter((w) => w.status === 'active').length;

  // Calculate map center based on warehouse locations
  const mapCenter = warehouses.length > 0
    ? {
        longitude: warehouses.reduce((sum, w) => sum + w.location.lng, 0) / warehouses.length,
        latitude: warehouses.reduce((sum, w) => sum + w.location.lat, 0) / warehouses.length,
        zoom: warehouses.length === 1 ? 10 : 4,
      }
    : { longitude: 78.9629, latitude: 20.5937, zoom: 4 }; // Default to India if no warehouses

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Warehouses</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage warehouse locations and capacity</p>
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

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {warehouses.map((warehouse, index) => (
            <WarehouseCard
              key={warehouse.id}
              warehouse={warehouse}
              index={index}
              totalInRow={3}
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
              initialViewState={mapCenter}
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
