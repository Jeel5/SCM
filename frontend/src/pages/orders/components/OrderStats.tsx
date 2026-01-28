import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types';

interface OrderStatsProps {
  orders: Order[];
  totalOrders: number;
}

export function OrderStats({ orders, totalOrders }: OrderStatsProps) {
  const statusCounts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {} as Record<OrderStatus, number>);

  const stats = [
    { label: 'Total Orders', value: totalOrders, color: 'text-gray-900' },
    { label: 'Processing', value: statusCounts['processing'] || 0, color: 'text-yellow-600' },
    { label: 'Shipped', value: statusCounts['shipped'] || 0, color: 'text-purple-600' },
    { label: 'Delivered', value: statusCounts['delivered'] || 0, color: 'text-green-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
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
