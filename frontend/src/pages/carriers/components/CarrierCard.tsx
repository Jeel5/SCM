import React from 'react';
import { motion } from 'framer-motion';
import { Truck, Eye, Edit, MoreHorizontal } from 'lucide-react';
import { Badge, Progress, Dropdown } from '@/components/ui';
import { formatNumber, cn } from '@/lib/utils';
import type { Carrier } from '@/types';
import { RatingStars } from './RatingStars';

export function CarrierCard({
  carrier,
  onViewDetails,
  index,
  totalInRow = 3,
}: {
  carrier: Carrier;
  onViewDetails: () => void;
  index?: number;
  totalInRow?: number;
}) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  // Determine if this is in the rightmost column
  const isRightmost = index !== undefined && (index % totalInRow) === (totalInRow - 1);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all duration-300"
      style={{ 
        overflow: 'visible', 
        position: 'relative',
        zIndex: isDropdownOpen ? 9999 : 'auto'
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-12 w-12 rounded-xl flex items-center justify-center',
                carrier.status === 'active'
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  : carrier.status === 'suspended'
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
              )}
            >
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{carrier.name}</h3>
              <RatingStars rating={carrier.rating} />
            </div>
          </div>
          <Dropdown
            align={isRightmost ? 'right' : 'left'}
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
              setIsDropdownOpen(false);
            }}
            onOpenChange={setIsDropdownOpen}
          />
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">On-Time Delivery</span>
          <div className="flex items-center gap-2">
            <Progress value={carrier.onTimeDeliveryRate} size="sm" className="w-24" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {carrier.onTimeDeliveryRate}%
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">Damage Rate</span>
          <div className="flex items-center gap-2">
            <Progress
              value={100 - carrier.damageRate}
              variant={carrier.damageRate > 5 ? 'error' : 'success'}
              size="sm"
              className="w-24"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {carrier.damageRate}%
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 grid grid-cols-3 gap-4 border-t border-gray-100 dark:border-gray-700">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatNumber(carrier.activeShipments)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
        </div>
        <div className="text-center border-x border-gray-200 dark:border-gray-700">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatNumber(carrier.totalShipments)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{carrier.averageDeliveryTime}h</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Avg Time</p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {carrier.services.slice(0, 2).map((service) => (
            <Badge key={service} variant="default" className="text-xs capitalize">
              {service.replace('_', ' ')}
            </Badge>
          ))}
          {carrier.services.length > 2 && (
            <Badge variant="default" className="text-xs">
              +{carrier.services.length - 2}
            </Badge>
          )}
        </div>
        <Badge
          variant={
            carrier.status === 'active'
              ? 'success'
              : carrier.status === 'suspended'
                ? 'error'
                : 'default'
          }
          className="capitalize"
        >
          {carrier.status}
        </Badge>
      </div>
    </motion.div>
  );
}
