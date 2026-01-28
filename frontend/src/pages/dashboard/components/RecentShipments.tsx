import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Truck, ArrowRight, MapPin, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, StatusBadge, Button } from '@/components/ui';
import { formatRelativeTime } from '@/lib/utils';
import type { Shipment } from '@/types';

export interface RecentShipmentsProps {
  shipments: Shipment[];
}

export function RecentShipments({ shipments }: RecentShipmentsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle subtitle="Real-time tracking">Active Shipments</CardTitle>
        <Link to="/shipments">
          <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {shipments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                <Truck className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">No active shipments</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Shipments will appear here when available</p>
            </div>
          ) : (
            shipments.slice(0, 5).map((shipment, index) => (
            <motion.div
              key={shipment.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
            >
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{shipment.trackingNumber}</p>
                  <StatusBadge status={shipment.status} />
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{shipment.carrierName}</span>
                  <span>•</span>
                  <Clock className="h-3 w-3" />
                  <span>{formatRelativeTime(shipment.updatedAt)}</span>
                </div>
              </div>
            </motion.div>
          ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
