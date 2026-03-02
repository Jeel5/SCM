import { useState, useEffect } from 'react';
import { Building2, Package, Boxes, Thermometer, ShieldCheck } from 'lucide-react';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import { Modal, Badge, Progress, Button } from '@/components/ui';
import { formatNumber } from '@/lib/utils';
import type { Warehouse } from '@/types';
import { useWarehouseInventory } from '../hooks/useWarehouseInventory';

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
  onEdit,
  onDelete,
}: {
  warehouse: Warehouse | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { inventory, totalItems, isLoading } = useWarehouseInventory(warehouse?.id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { setConfirmDelete(false); }, [warehouse?.id]);

  if (!warehouse) return null;

  const lng = warehouse.location?.lng || 78.9629;
  const lat = warehouse.location?.lat || 20.5937;
  const hasCoords = !!(warehouse.location?.lng && warehouse.location?.lat);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={warehouse.name} size="full">
      <div className="space-y-6">
        {/* Map */}
        <div className="h-48 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <Map
            initialViewState={{
              longitude: lng,
              latitude: lat,
              zoom: hasCoords ? 12 : 4,
            }}
            style={{ width: '100%', height: '100%' }}
            mapStyle={MAP_STYLE}
          >
            <NavigationControl position="bottom-right" />
            {hasCoords && (
              <Marker
                longitude={lng}
                latitude={lat}
                anchor="bottom"
              >
                <div className="h-8 w-8 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-white" />
                </div>
              </Marker>
            )}
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
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Location Details</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Address</p>
              <p className="text-gray-900 dark:text-white">{warehouse.address.street}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">City</p>
              <p className="text-gray-900 dark:text-white">{warehouse.address.city}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">State</p>
              <p className="text-gray-900 dark:text-white">{warehouse.address.state}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Postal Code</p>
              <p className="text-gray-900 dark:text-white">{warehouse.address.postalCode || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Country</p>
              <p className="text-gray-900 dark:text-white">{warehouse.address.country}</p>
            </div>
          </div>
        </div>

        {/* Zones */}
        {warehouse.zones > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Warehouse Zones: {warehouse.zones}</h4>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: warehouse.zones }, (_, i) => (
                <div
                  key={i}
                  className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-600 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 dark:text-white">Zone {i + 1}</span>
                    <Badge variant="default" className="capitalize">
                      Storage
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <Progress value={((i * 17 + 7) % 80) + 20} size="sm" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Contact Information</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Email</p>
              <p className="text-gray-900 dark:text-white">{warehouse.contactEmail}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Phone</p>
              <p className="text-gray-900 dark:text-white">{warehouse.contactPhone || '—'}</p>
            </div>
          </div>
        </div>

        {/* SCM Operational Fields */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Operational Details</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {warehouse.gstin && (
              <div>
                <p className="text-gray-500 dark:text-gray-400">GSTIN</p>
                <p className="font-mono text-gray-900 dark:text-white">{warehouse.gstin}</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Thermometer className={`h-4 w-4 ${warehouse.hasColdStorage ? 'text-blue-500' : 'text-gray-400'}`} />
              <div>
                <p className="text-gray-500 dark:text-gray-400">Cold Storage</p>
                <p className="text-gray-900 dark:text-white">
                  {warehouse.hasColdStorage
                    ? warehouse.temperatureMinCelsius != null && warehouse.temperatureMaxCelsius != null
                      ? `${warehouse.temperatureMinCelsius}°C to ${warehouse.temperatureMaxCelsius}°C`
                      : 'Yes'
                    : 'No'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className={`h-4 w-4 ${warehouse.customsBondedWarehouse ? 'text-green-500' : 'text-gray-400'}`} />
              <div>
                <p className="text-gray-500 dark:text-gray-400">Customs Bonded</p>
                <p className="text-gray-900 dark:text-white">{warehouse.customsBondedWarehouse ? 'Yes' : 'No'}</p>
              </div>
            </div>
            {warehouse.certifications?.length > 0 && (
              <div className="col-span-2">
                <p className="text-gray-500 dark:text-gray-400 mb-1">Certifications</p>
                <div className="flex flex-wrap gap-1">
                  {warehouse.certifications.map((cert) => (
                    <span key={cert} className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">{cert}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Inventory Preview */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900 dark:text-white">Inventory Items ({totalItems})</h4>
          </div>

          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              ))}
            </div>
          ) : inventory.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {inventory.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{item.productName}</p>
                      <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-white">{formatNumber(item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No inventory items found in this warehouse.</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
        {confirmDelete ? (
          <>
            <span className="self-center text-sm text-gray-600 dark:text-gray-400 mr-auto">Delete <strong>{warehouse.name}</strong>? This cannot be undone.</span>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => { setConfirmDelete(false); onDelete?.(); }}>
              Yes, Delete
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setConfirmDelete(true)}>
              Delete Warehouse
            </Button>
            <Button variant="primary" onClick={onEdit}>
              Edit Warehouse
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
