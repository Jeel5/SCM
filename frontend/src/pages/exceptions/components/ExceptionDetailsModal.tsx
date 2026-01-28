import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Modal, SeverityBadge, StatusBadge, Button } from '@/components/ui';
import { formatDate, cn } from '@/lib/utils';
import type { Exception } from '@/types';

export function ExceptionDetailsModal({
  exception,
  isOpen,
  onClose,
}: {
  exception: Exception | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!exception) return null;

  const severityColors = {
    low: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    medium: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300',
    high: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300',
    critical: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Exception Details" size="lg">
      <div className="space-y-6">
        <div className={cn('p-4 rounded-xl border', severityColors[exception.severity])}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6" />
              <div>
                <h3 className="font-semibold capitalize">
                  {exception.type.replace('_', ' ')} Exception
                </h3>
                <p className="text-sm mt-1">{exception.description}</p>
              </div>
            </div>
            <SeverityBadge severity={exception.severity} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
            <div className="mt-1">
              <StatusBadge status={exception.status} />
            </div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
            <p className="font-medium text-gray-900 dark:text-white">{formatDate(exception.createdAt)}</p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400">Order ID</p>
            <p className="font-medium text-gray-900 dark:text-white">{exception.orderId}</p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400">Shipment ID</p>
            <p className="font-medium text-gray-900 dark:text-white">{exception.shipmentId || 'N/A'}</p>
          </div>
        </div>

        {exception.resolution && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Resolution</span>
            </div>
            <p className="text-green-700 dark:text-green-300">{exception.resolution}</p>
            {exception.resolvedAt && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                Resolved: {formatDate(exception.resolvedAt)}
              </p>
            )}
          </div>
        )}

        {exception.status !== 'resolved' && (
          <div className="flex items-center gap-3">
            <Button variant="primary" className="flex-1">
              Mark as Resolved
            </Button>
            <Button variant="outline" className="flex-1">
              Add Note
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
