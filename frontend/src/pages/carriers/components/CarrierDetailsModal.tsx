import { Truck, CheckCircle2, XCircle, AlertTriangle, Clock, Phone, Mail, Globe } from 'lucide-react';
import { Modal, Badge } from '@/components/ui';
import { formatNumber } from '@/lib/utils';
import type { Carrier } from '@/types';
import { RatingStars } from './RatingStars';

export function CarrierDetailsModal({
  carrier,
  isOpen,
  onClose,
}: {
  carrier: Carrier | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!carrier) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={carrier.name} size="full">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-linear-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-white dark:bg-gray-900 flex items-center justify-center shadow-sm border border-gray-100 dark:border-gray-700">
              <Truck className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{carrier.name}</h3>
              <RatingStars rating={carrier.rating} />
            </div>
          </div>
          <Badge
            variant={
              carrier.status === 'active'
                ? 'success'
                : carrier.status === 'suspended'
                  ? 'error'
                  : 'default'
            }
            size="lg"
            className="capitalize"
          >
            {carrier.status}
          </Badge>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{carrier.onTimeDeliveryRate}%</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">On-Time</p>
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-center">
            <XCircle className="h-6 w-6 text-red-600 dark:text-red-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{carrier.damageRate}%</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Damage Rate</p>
          </div>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-center">
            <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{carrier.lossRate}%</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loss Rate</p>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
            <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{carrier.averageDeliveryTime}h</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Avg Time</p>
          </div>
        </div>

        {/* Shipment Stats */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
          <h4 className="font-medium text-gray-900 dark:text-white mb-4">Shipment Statistics</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">Active Shipments</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatNumber(carrier.activeShipments)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">Total Shipments</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatNumber(carrier.totalShipments)}</span>
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Available Services</h4>
          <div className="flex flex-wrap gap-2">
            {carrier.services.map((service) => (
              <Badge key={service} variant="info" className="capitalize">
                {service.replace('_', ' ')}
              </Badge>
            ))}
          </div>
        </div>

        {/* Contact Information */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
          <h4 className="font-medium text-gray-900 dark:text-white mb-4">Contact Information</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Phone</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{carrier.contactPhone}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{carrier.contactEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <Globe className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">API Endpoint</p>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">{carrier.apiEndpoint || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
