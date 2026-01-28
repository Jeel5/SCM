import { motion } from 'framer-motion';
import { CheckCircle2, Circle, MapPin, Clock } from 'lucide-react';
import { StatusBadge } from '@/components/ui';
import { formatDate, cn } from '@/lib/utils';
import type { ShipmentEvent } from '@/types';

export function ShipmentTimeline({ events }: { events: ShipmentEvent[] }) {
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="relative">
      {sortedEvents.map((event, index) => (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="flex gap-4 pb-6 last:pb-0"
        >
          {/* Timeline line */}
          <div className="relative flex flex-col items-center">
            <div
              className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
                index === 0
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              )}
            >
              {index === 0 ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </div>
            {index < sortedEvents.length - 1 && (
              <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 mt-2" />
            )}
          </div>

          {/* Event content */}
          <div className="flex-1 pt-1">
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-900 dark:text-white">{event.description}</p>
              <StatusBadge status={event.status} />
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {event.location}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(event.timestamp, 'MMM dd, yyyy HH:mm')}
              </span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
