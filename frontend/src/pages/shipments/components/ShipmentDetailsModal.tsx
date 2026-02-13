import { useState } from 'react';
import { Truck, Navigation } from 'lucide-react';
import { Modal, StatusBadge, Tabs } from '@/components/ui';
import { formatDate } from '@/lib/utils';
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
  const [activeTab, setActiveTab] = useState('timeline');

  if (!shipment) return null;

  const tabs = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'map', label: 'Track on Map' },
    { id: 'details', label: 'Details' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Shipment ${shipment.trackingNumber}`} size="lg">
      <div className="space-y-6">
        {/* Status Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Truck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{shipment.carrierName}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Est. Delivery: {formatDate(shipment.estimatedDelivery)}
              </p>
            </div>
          </div>
          <StatusBadge status={shipment.status} />
        </div>

        {/* Route Info */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">From</p>
            <p className="font-medium text-gray-900 dark:text-white">{shipment.origin.city}</p>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <div className="h-0.5 w-16 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <Navigation className="h-4 w-4 text-indigo-500" />
              <div className="h-0.5 w-16 bg-gradient-to-r from-indigo-500 to-purple-500" />
              <div className="h-2 w-2 rounded-full bg-purple-500" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">To</p>
            <p className="font-medium text-gray-900 dark:text-white">{shipment.destination.city}</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {/* Tab Content */}
        {activeTab === 'timeline' && (
          <div className="mt-4">
            <ShipmentTimeline events={shipment.events} />
          </div>
        )}

        {activeTab === 'map' && (
          <div className="mt-4">
            <ShipmentMap shipment={shipment} />
          </div>
        )}

        {activeTab === 'details' && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Order ID</p>
              <p className="font-medium text-gray-900 dark:text-white">{shipment.orderId}</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Weight</p>
              <p className="font-medium text-gray-900 dark:text-white">{shipment.weight.toFixed(2)} kg</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">SLA Deadline</p>
              <p className="font-medium text-gray-900 dark:text-white">{formatDate(shipment.slaDeadline)}</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Shipping Cost</p>
              <p className="font-medium text-gray-900 dark:text-white">₹{shipment.cost.toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
