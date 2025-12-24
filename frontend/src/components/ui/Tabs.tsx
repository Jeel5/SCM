// Tabs component
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = 'default',
  size = 'md',
  fullWidth = false,
  className,
}: TabsProps) {
  const sizes = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-base px-5 py-2.5',
  };

  return (
    <div
      className={cn(
        'flex gap-1',
        variant === 'default' && 'p-1 bg-gray-100 rounded-xl',
        variant === 'underline' && 'border-b border-gray-200',
        fullWidth && 'w-full',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <motion.button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex items-center gap-2 font-medium transition-colors',
              sizes[size],
              fullWidth && 'flex-1 justify-center',
              variant === 'default' && [
                'rounded-lg',
                isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700',
              ],
              variant === 'pills' && [
                'rounded-full',
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
              ],
              variant === 'underline' && [
                'pb-3 -mb-px',
                isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700',
              ]
            )}
          >
            {variant === 'default' && isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-white rounded-lg shadow-sm"
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              />
            )}
            {variant === 'underline' && isActive && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-200 text-gray-600'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

// Tab Panel for content
interface TabPanelProps {
  children: React.ReactNode;
  tabId: string;
  activeTab: string;
  className?: string;
}

export function TabPanel({ children, tabId, activeTab, className }: TabPanelProps) {
  return (
    <AnimatePresence mode="wait">
      {tabId === activeTab && (
        <motion.div
          key={tabId}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
