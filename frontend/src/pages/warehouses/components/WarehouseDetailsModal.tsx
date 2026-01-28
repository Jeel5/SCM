import { Building2, Package, Boxes } from 'lucide-react';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import { Modal, Badge, Progress } from '@/components/ui';
import { formatNumber } from '@/lib/utils';
import type { Warehouse } from '@/types';

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

export function WarehouseDetailsModal({
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
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
              <Package className="h-4 w-4" />
              <span className="text-sm font-medium">Total Capacity</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(warehouse.capacity)}</p>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
              <Boxes className="h-4 w-4" />
              <span className="text-sm font-medium">Items Stored</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(warehouse.inventoryCount)}</p>
          </div>
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
              <Building2 className="h-4 w-4" />
              <span className="text-sm font-medium">Utilization</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{warehouse.utilizationPercentage}%</p>
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
