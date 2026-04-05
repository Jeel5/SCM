import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { InventoryItem } from '@/types';
import { getInventoryStockStatus } from '../utils/stockStatus';

interface StockLevelIndicatorProps {
  item: InventoryItem;
}

export function StockLevelIndicator({ item }: StockLevelIndicatorProps) {
  const stockStatus = getInventoryStockStatus(item);
  const { percentage, label } = stockStatus;
  const color = stockStatus.state === 'out_of_stock'
    ? 'bg-red-500'
    : stockStatus.state === 'low_stock'
      ? 'bg-yellow-500'
      : stockStatus.state === 'overstocked'
        ? 'bg-blue-500'
        : 'bg-green-500';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={cn(
          'font-medium',
          stockStatus.state === 'out_of_stock' && 'text-red-600 dark:text-red-400',
          stockStatus.state === 'low_stock' && 'text-yellow-600 dark:text-yellow-400',
          stockStatus.state === 'healthy' && 'text-green-600 dark:text-green-400',
          stockStatus.state === 'overstocked' && 'text-blue-600 dark:text-blue-400'
        )}>
          {label}
        </span>
        <span className="text-gray-500 dark:text-gray-400">{percentage.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5 }}
          className={cn('h-full rounded-full', color)}
        />
      </div>
    </div>
  );
}
