import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy' | 'away';
  className?: string;
}

export function Avatar({ src, alt, name, size = 'md', status, className }: AvatarProps) {
  const sizes = {
    xs: 'h-6 w-6 text-xs',
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg',
  };

  const statusSizes = {
    xs: 'h-1.5 w-1.5',
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
    xl: 'h-4 w-4',
  };

  const statusColors = {
    online: 'bg-emerald-500',
    offline: 'bg-gray-400',
    busy: 'bg-red-500',
    away: 'bg-amber-500',
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <div className={cn('relative inline-block', className)}>
      {src ? (
        <motion.img
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          src={src}
          alt={alt || name}
          className={cn(
            'rounded-full object-cover ring-2 ring-white',
            sizes[size]
          )}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn(
            'rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-medium text-white ring-2 ring-white',
            sizes[size]
          )}
        >
          {getInitials(name)}
        </motion.div>
      )}
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-white',
            statusSizes[size],
            statusColors[status]
          )}
        />
      )}
    </div>
  );
}

// Avatar Group
interface AvatarGroupProps {
  avatars: Array<{
    src?: string;
    name?: string;
    alt?: string;
  }>;
  max?: number;
  size?: AvatarProps['size'];
  className?: string;
}

export function AvatarGroup({ avatars, max = 4, size = 'md', className }: AvatarGroupProps) {
  const displayAvatars = avatars.slice(0, max);
  const remaining = avatars.length - max;

  const spacings = {
    xs: '-space-x-2',
    sm: '-space-x-2.5',
    md: '-space-x-3',
    lg: '-space-x-4',
    xl: '-space-x-5',
  };

  return (
    <div className={cn('flex items-center', spacings[size], className)}>
      {displayAvatars.map((avatar, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          style={{ zIndex: displayAvatars.length - index }}
        >
          <Avatar {...avatar} size={size} />
        </motion.div>
      ))}
      {remaining > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: max * 0.05 }}
          className={cn(
            'rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-medium text-gray-600 dark:text-gray-300 ring-2 ring-white dark:ring-gray-800',
            size === 'xs' && 'h-6 w-6 text-[10px]',
            size === 'sm' && 'h-8 w-8 text-xs',
            size === 'md' && 'h-10 w-10 text-xs',
            size === 'lg' && 'h-12 w-12 text-sm',
            size === 'xl' && 'h-16 w-16 text-base'
          )}
        >
          +{remaining}
        </motion.div>
      )}
    </div>
  );
}
