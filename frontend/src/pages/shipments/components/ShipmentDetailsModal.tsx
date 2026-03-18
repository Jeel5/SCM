import { useState } from 'react';
import { Truck, Navigation, Package, MapPin, Calendar, DollarSign, Weight } from 'lucide-react';
import { Modal, StatusBadge, Tabs } from '@/components/ui';
import { formatDate, formatCurrency } from '@/lib/utils';
import { ShipmentTimeline } from './ShipmentTimeline';
import { ShipmentMap } from './ShipmentMap';
import type { Shipment } from '@/types';

export function ShipmentDetailsModal({
  shipment,
  isOpen,
  onClose,
}: {
  shipment: Shipment | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState('map');

  if (!shipment) return null;

  const tabs = [
    { id: 'map', label: 'Live Tracking' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'details', label: 'Details' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Shipment ${shipment.trackingNumber}`} size="4xl">
      <div className="space-y-6">
        {/* Status Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-linear-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Truck className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Carrier</p>
              <p className="font-bold text-gray-900 dark:text-white text-lg">{shipment.carrierName}</p>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Status</p>
              <StatusBadge status={shipment.status} className="text-base px-4 py-2" />
            </div>
          </div>
          <div className="flex items-center justify-end">
            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400">Shipping Cost</p>
              <p className="font-bold text-gray-900 dark:text-white text-2xl">{formatCurrency(shipment.cost)}</p>
            </div>
          </div>
        </div>

        {/* Route Info */}
        <div className="relative p-5 bg-linear-to-r from-green-50 to-blue-50 dark:from-gray-800 dark:to-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-green-600 dark:text-green-400" />
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Origin</p>
              </div>
              <p className="font-bold text-gray-900 dark:text-white text-lg">{shipment.origin.city}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{shipment.origin.state}, {shipment.origin.country}</p>
            </div>
            
            <div className="flex items-center justify-center">
              <div className="flex flex-col items-center">
                <div className="relative w-full h-12 flex items-center justify-center">
                  <div className="absolute left-0 right-0 h-1 bg-linear-to-r from-green-500 via-blue-500 to-purple-500 rounded-full"></div>
                  <div className="relative z-10 flex items-center justify-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500 ring-4 ring-white dark:ring-gray-800"></div>
                    <Navigation className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-pulse" />
                    <div className="h-3 w-3 rounded-full bg-purple-500 ring-4 ring-white dark:ring-gray-800"></div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">In Transit</p>
              </div>
            </div>
            
            <div className="text-center md:text-right">
              <div className="inline-flex items-center gap-2 mb-2 md:justify-end w-full">
                <MapPin className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Destination</p>
              </div>
              <p className="font-bold text-gray-900 dark:text-white text-lg">{shipment.destination.city}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{shipment.destination.state}, {shipment.destination.country}</p>
            </div>
          </div>
          
          {/* ETA */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Estimated Delivery:</span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">{formatDate(shipment.estimatedDelivery)}</span>
          </div>
        </div>

        {/* Tabs */}
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {/* Tab Content */}
        <div className="min-h-96">
          {activeTab === 'map' && (
            <div className="h-125">
              <ShipmentMap shipment={shipment} />
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="max-h-125 overflow-y-auto pr-2">
              {shipment.events && shipment.events.length > 0 ? (
                <ShipmentTimeline events={shipment.events} />
              ) : (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No tracking events yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Package Information</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Order ID:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white font-mono">{shipment.orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Weight:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{shipment.weight.toFixed(2)} kg</span>
                  </div>
                  {shipment.dimensions && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Dimensions:</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {shipment.dimensions.length} × {shipment.dimensions.width} × {shipment.dimensions.height} cm
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Financial Details</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Shipping Cost:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(shipment.cost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Carrier ID:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white font-mono">{shipment.carrierId}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Timeline</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Created:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(shipment.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Last Updated:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(shipment.updatedAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">SLA Deadline:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(shipment.slaDeadline)}</span>
                  </div>
                  {shipment.actualDelivery && (
                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-sm text-green-600 dark:text-green-400 font-medium">Delivered:</span>
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">{formatDate(shipment.actualDelivery)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-400">Tracking Number</p>
                </div>
                <p className="text-2xl font-bold font-mono text-blue-900 dark:text-blue-300 break-all">{shipment.trackingNumber}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
