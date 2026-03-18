import { useState, useEffect } from 'react';
import {
  RotateCcw,
  Package,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Truck,
} from 'lucide-react';
import {
  Modal,
  StatusBadge,
  Badge,
  Button,
} from '@/components/ui';
import { formatDate, formatCurrency } from '@/lib/utils';
import { returnsApi } from '@/api/services';
import { useToast } from '@/components/ui/Toast';
import type { Return } from '@/types';

export function ReturnDetailsModal({
  returnItem,
  isOpen,
  onClose,
  onStatusChange,
}: {
  returnItem: Return | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: () => void;
}) {
  const [isActing, setIsActing] = useState(false);
  const [detail, setDetail] = useState<Return | null>(null);
  const { addToast } = useToast();

  // Fetch full detail (with items) when modal opens
  useEffect(() => {
    if (isOpen && returnItem?.id) {
      setDetail(null);
      returnsApi.getReturn(returnItem.id)
        .then((res: any) => setDetail(res.data ?? res))
        .catch(() => setDetail(returnItem)); // fallback to list data
    }
  }, [isOpen, returnItem?.id]);

  if (!returnItem) return null;

  const displayItem = detail || returnItem;

  const handleStatusUpdate = async (status: string) => {
    setIsActing(true);
    try {
      await returnsApi.updateReturn(returnItem.id, { status } as any);
      addToast(`Return ${status === 'approved' ? 'approved' : 'rejected'} successfully`, 'success');
      onStatusChange?.();
    } catch (err: any) {
      addToast(err?.message || `Failed to update return`, 'error');
    } finally {
      setIsActing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Return ${displayItem.id}`} size="lg">
      <div className="space-y-6">
        {/* Status Header */}
        <div className="p-4 bg-linear-to-r from-purple-50 to-pink-50 dark:from-gray-800 dark:to-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-white dark:bg-gray-900 flex items-center justify-center shadow-sm">
                <RotateCcw className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white capitalize">
                  {displayItem.reason.replace('_', ' ')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Requested: {formatDate(displayItem.requestedAt || displayItem.createdAt)}
                </p>
              </div>
            </div>
            <StatusBadge status={displayItem.status} />
          </div>
        </div>

        {/* Return Flow */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Order</p>
            <p className="font-medium text-gray-900 dark:text-white">{displayItem.orderId}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Return Type</p>
            <p className="font-medium text-gray-900 dark:text-white capitalize">{displayItem.type || 'refund'}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Refund Amount</p>
            <p className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(displayItem.refundAmount || 0)}</p>
          </div>
        </div>

        {/* Items */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Return Items</h4>
          <div className="space-y-2">
            {(displayItem.items ?? []).length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No items recorded</p>
            ) : (displayItem.items ?? []).map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{item.productName || item.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Qty: {item.quantity}</p>
                  </div>
                </div>
                <Badge variant={item.condition === 'good' ? 'success' : 'warning'} className="capitalize">
                  {item.condition || 'unknown'}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {displayItem.notes && (
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Notes</h4>
            <p className="text-gray-600 dark:text-gray-300">{displayItem.notes}</p>
          </div>
        )}

        {/* Tracking */}
        {displayItem.trackingNumber && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
              <Truck className="h-5 w-5" />
              <span className="font-medium">Return Shipment</span>
            </div>
            <p className="text-blue-700 dark:text-blue-300">Tracking: {displayItem.trackingNumber}</p>
          </div>
        )}

        {/* Actions */}
        {(displayItem.status === 'pending' || displayItem.status === 'requested') && (
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              className="flex-1"
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
              isLoading={isActing}
              onClick={() => handleStatusUpdate('approved')}
            >
              Approve Return
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
              leftIcon={<XCircle className="h-4 w-4" />}
              isLoading={isActing}
              onClick={() => handleStatusUpdate('rejected')}
            >
              Reject Return
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
