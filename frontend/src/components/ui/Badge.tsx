import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  pulse = false,
  className,
}: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    error: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
    info: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
    outline: 'bg-transparent text-gray-600 border-gray-300 dark:text-gray-400 dark:border-gray-600',
  };

  const dotColors = {
    default: 'bg-gray-400',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    purple: 'bg-purple-500',
    outline: 'bg-gray-400',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span
              className={cn(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                dotColors[variant]
              )}
            />
          )}
          <span
            className={cn(
              'relative inline-flex rounded-full h-2 w-2',
              dotColors[variant]
            )}
          />
        </span>
      )}
      {children}
    </motion.span>
  );
}

// Status Badge component for common status displays
interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getVariant = (status: string): BadgeProps['variant'] => {
    const statusVariants: Record<string, BadgeProps['variant']> = {
      // Order/Shipment statuses
      created: 'default',
      confirmed: 'info',
      allocated: 'info',
      processing: 'warning',
      shipped: 'purple',
      pending: 'default',
      picked_up: 'info',
      in_transit: 'warning',
      at_hub: 'info',
      out_for_delivery: 'purple',
      delivered: 'success',
      failed_delivery: 'error',
      returned: 'error',
      cancelled: 'default',
      
      // SLA statuses
      on_track: 'success',
      at_risk: 'warning',
      breached: 'error',
      
      // Exception statuses
      open: 'error',
      investigating: 'warning',
      pending_resolution: 'warning',
      resolved: 'success',
      escalated: 'purple',
      closed: 'default',
      
      // Return statuses
      requested: 'info',
      approved: 'success',
      rejected: 'error',
      pickup_scheduled: 'info',
      received: 'info',
      inspected: 'purple',
      refunded: 'success',
      replaced: 'success',
      
      // General
      active: 'success',
      inactive: 'default',
      suspended: 'error',
      maintenance: 'warning',
    };

    return statusVariants[status] || 'default';
  };

  const formatStatus = (status: string): string => {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const needsPulse = ['in_transit', 'out_for_delivery', 'processing', 'investigating'].includes(status);

  return (
    <Badge
      variant={getVariant(status)}
      dot
      pulse={needsPulse}
      className={className}
    >
      {formatStatus(status)}
    </Badge>
  );
}

// Priority Badge
interface PriorityBadgeProps {
  priority: 'express' | 'standard' | 'bulk' | string;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const getVariant = (priority: string): BadgeProps['variant'] => {
    switch (priority) {
      case 'express':
        return 'error';
      case 'standard':
        return 'info';
      case 'bulk':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Badge variant={getVariant(priority)} size="sm" className={className}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  );
}

// Severity Badge
interface SeverityBadgeProps {
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const getVariant = (severity: string): BadgeProps['variant'] => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Badge variant={getVariant(severity)} dot pulse={severity === 'critical'} className={className}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </Badge>
  );
}
