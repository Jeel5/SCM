import { motion } from 'framer-motion';
import { Boxes, TrendingUp, AlertTriangle, Package } from 'lucide-react';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import type { Warehouse } from '@/types';

interface InventoryStatsProps {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  warehouses: Warehouse[];
}

export function InventoryStats({ totalItems, totalValue, lowStockItems, warehouses }: InventoryStatsProps) {
  const stats = [
    {
      label: 'Total Items',
      value: formatNumber(totalItems),
      icon: Boxes,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Total Value',
      value: formatCurrency(totalValue),
      icon: TrendingUp,
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Low Stock',
      value: lowStockItems,
      icon: AlertTriangle,
      color: 'bg-yellow-100 text-yellow-600',
    },
    {
      label: 'Warehouses',
      value: warehouses.length,
      icon: Package,
      color: 'bg-purple-100 text-purple-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', stat.color)}>
              <stat.icon className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
