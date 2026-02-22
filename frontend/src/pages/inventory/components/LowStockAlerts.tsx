import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Package, ArrowRight } from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui';
import { inventoryApi } from '@/api/services';
import { formatNumber } from '@/lib/utils';
import type { InventoryItem } from '@/types';

interface LowStockAlertsProps {
  onViewAll?: () => void;
  warehouseId?: string;
}

export function LowStockAlerts({ onViewAll, warehouseId }: LowStockAlertsProps) {
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchLowStockItems = async () => {
      try {
        setLoading(true);
        const response = await inventoryApi.getLowStockItems(warehouseId);
        setLowStockItems(response.data);
      } catch (error) {
        console.error('Failed to fetch low stock items:', error);
        setLowStockItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLowStockItems();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchLowStockItems, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [warehouseId]);

  if (loading) {
    return (
      <Card className="bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800">
        <div className="animate-pulse flex items-center gap-3">
          <div className="h-10 w-10 bg-yellow-200 dark:bg-yellow-800 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-yellow-200 dark:bg-yellow-800 rounded w-1/3" />
            <div className="h-3 bg-yellow-200 dark:bg-yellow-800 rounded w-1/2" />
          </div>
        </div>
      </Card>
    );
  }

  if (dismissed || lowStockItems.length === 0) {
    return null;
  }

  const criticalItems = lowStockItems.filter(item => item.quantity === 0);
  const warningItems = lowStockItems.filter(item => item.quantity > 0);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
      >
        <Card className="bg-linear-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 border-yellow-300 dark:border-yellow-700">
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <div className="h-12 w-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    Low Stock Alert
                    <Badge variant="warning" className="font-normal">
                      {lowStockItems.length} {lowStockItems.length === 1 ? 'item' : 'items'}
                    </Badge>
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {criticalItems.length > 0 && (
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        {criticalItems.length} out of stock
                      </span>
                    )}
                    {criticalItems.length > 0 && warningItems.length > 0 && <span>, </span>}
                    {warningItems.length > 0 && (
                      <span>
                        {warningItems.length} below reorder point
                      </span>
                    )}
                  </p>
                </div>

                <button
                  onClick={() => setDismissed(true)}
                  className="p-1 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Show first 3 items */}
              <div className="space-y-2 mb-3">
                {lowStockItems.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg border border-yellow-200/50 dark:border-yellow-700/50"
                  >
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.productName || item.sku || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {item.sku} • {item.warehouseName}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${
                        item.quantity === 0 
                          ? 'text-red-600 dark:text-red-400' 
                          : 'text-yellow-600 dark:text-yellow-400'
                      }`}>
                        {item.quantity === 0 ? 'Out of Stock' : `${formatNumber(item.quantity)} left`}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Reorder: {formatNumber(item.reorderPoint)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {lowStockItems.length > 3 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  And {lowStockItems.length - 3} more {lowStockItems.length - 3 === 1 ? 'item' : 'items'}...
                </p>
              )}

              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onViewAll}
                  className="bg-white dark:bg-gray-800"
                >
                  View All Low Stock Items
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
