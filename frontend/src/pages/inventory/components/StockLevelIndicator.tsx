import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { InventoryItem } from '@/types';

interface StockLevelIndicatorProps {
  item: InventoryItem;
}

export function StockLevelIndicator({ item }: StockLevelIndicatorProps) {
  const percentage = (item.quantity / item.maxQuantity) * 100;
  let color = 'bg-green-500';
  let status = 'Healthy';

  if (item.quantity <= item.reorderPoint) {
    color = 'bg-red-500';
    status = 'Critical';
  } else if (percentage <= 30) {
    color = 'bg-yellow-500';
    status = 'Low';
  } else if (percentage >= 90) {
    color = 'bg-blue-500';
    status = 'Overstocked';
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={cn(
          'font-medium',
          status === 'Critical' && 'text-red-600 dark:text-red-400',
          status === 'Low' && 'text-yellow-600 dark:text-yellow-400',
          status === 'Healthy' && 'text-green-600 dark:text-green-400',
          status === 'Overstocked' && 'text-blue-600 dark:text-blue-400'
        )}>
          {status}
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
