import { Boxes, AlertTriangle, Edit, ArrowUpDown } from 'lucide-react';
import { Modal, Button, Badge, Progress } from '@/components/ui';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { InventoryItem } from '@/types';

interface InventoryDetailsModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function InventoryDetailsModal({ item, isOpen, onClose }: InventoryDetailsModalProps) {
  if (!item) return null;

  const stockPercentage = (item.quantity / item.maxQuantity) * 100;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Inventory Details" size="lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-white dark:bg-gray-900 flex items-center justify-center shadow-sm">
              <Boxes className="h-8 w-8 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{item.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {item.sku}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={item.category === 'electronics' ? 'info' : 'default'}>
                  {item.category}
                </Badge>
                <Badge variant="outline">{item.unit}</Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(item.quantity)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">in stock</p>
          </div>
        </div>

        {/* Stock Level Visual */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Stock Level</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {formatNumber(item.quantity)} / {formatNumber(item.maxQuantity)}
            </span>
          </div>
          <Progress value={stockPercentage} size="lg" showLabel />
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500 dark:text-gray-400">
            <span>Min: {formatNumber(item.minQuantity)}</span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-yellow-500" />
              Reorder: {formatNumber(item.reorderPoint)}
            </span>
            <span>Max: {formatNumber(item.maxQuantity)}</span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Unit Cost</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">{formatCurrency(item.unitCost)}</p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Value</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">
              {formatCurrency(item.quantity * item.unitCost)}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Warehouse</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{item.warehouseName}</p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Location</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{item.location}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button variant="primary" className="flex-1" leftIcon={<ArrowUpDown className="h-4 w-4" />}>
            Adjust Stock
          </Button>
          <Button variant="outline" className="flex-1" leftIcon={<Edit className="h-4 w-4" />}>
            Edit Item
          </Button>
        </div>
      </div>
    </Modal>
  );
}
