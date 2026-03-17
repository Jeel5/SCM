import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface OrderStatsProps {
  stats: {
    totalOrders: number;
    processing: number;
    shipped: number;
    delivered: number;
    returned: number;
  };
}

export function OrderStats({ stats }: OrderStatsProps) {
  const cards = [
    { label: 'Total Orders', value: stats.totalOrders, color: 'text-gray-900 dark:text-white' },
    { label: 'Processing', value: stats.processing, color: 'text-yellow-600 dark:text-yellow-400' },
    { label: 'Shipped', value: stats.shipped, color: 'text-purple-600 dark:text-purple-400' },
    { label: 'Delivered', value: stats.delivered, color: 'text-green-600 dark:text-green-400' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((stat) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
          <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
