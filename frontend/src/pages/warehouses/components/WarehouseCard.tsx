import { motion } from 'framer-motion';
import { Building2, MapPin, MoreHorizontal, Eye, Edit, Boxes, Truck } from 'lucide-react';
import { Badge, Progress, Dropdown } from '@/components/ui';
import { formatNumber, cn } from '@/lib/utils';
import type { Warehouse } from '@/types';

export function WarehouseCard({
  warehouse,
  onViewDetails,
}: {
  warehouse: Warehouse;
  onViewDetails: () => void;
}) {
  const utilizationColor =
    warehouse.utilizationPercentage >= 90
      ? 'text-red-600'
      : warehouse.utilizationPercentage >= 70
        ? 'text-yellow-600'
        : 'text-green-600';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-12 w-12 rounded-xl flex items-center justify-center',
                warehouse.status === 'active'
                  ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                  : warehouse.status === 'maintenance'
                    ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
              )}
            >
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{warehouse.name}</h3>
              <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                <MapPin className="h-3 w-3" />
                {warehouse.address.city}, {warehouse.address.country}
              </div>
            </div>
          </div>
          <Dropdown
            trigger={
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <MoreHorizontal className="h-4 w-4 text-gray-500" />
              </button>
            }
            items={[
              { label: 'View Details', value: 'view', icon: <Eye className="h-4 w-4" /> },
              { label: 'Edit', value: 'edit', icon: <Edit className="h-4 w-4" /> },
            ]}
            onSelect={(value) => {
              if (value === 'view') onViewDetails();
            }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-4 grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Capacity</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatNumber(warehouse.capacity)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Utilization</p>
          <p className={cn('text-lg font-semibold', utilizationColor)}>
            {warehouse.utilizationPercentage}%
          </p>
        </div>
      </div>

      {/* Utilization Bar */}
      <div className="px-4 pb-4">
        <Progress
          value={warehouse.utilizationPercentage}
          variant={
            warehouse.utilizationPercentage >= 90
              ? 'error'
              : warehouse.utilizationPercentage >= 70
                ? 'warning'
                : 'success'
          }
        />
      </div>

      {/* Footer Stats */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
            <Boxes className="h-4 w-4" />
            {formatNumber(warehouse.inventoryCount)} items
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
            <Truck className="h-4 w-4" />
            {warehouse.zones} zones
          </div>
        </div>
        <Badge
          variant={
            warehouse.status === 'active'
              ? 'success'
              : warehouse.status === 'maintenance'
                ? 'warning'
                : 'default'
          }
          className="capitalize"
        >
          {warehouse.status}
        </Badge>
      </div>
    </motion.div>
  );
}
