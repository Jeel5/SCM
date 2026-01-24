import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropdownItem {
  label: string;
  value: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  onSelect: (value: string) => void;
  align?: 'left' | 'right';
  className?: string;
  onOpenChange?: (isOpen: boolean) => void;
}

export function Dropdown({ trigger, items, onSelect, align = 'left', className, onOpenChange }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        onOpenChange?.(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onOpenChange]);

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onOpenChange?.(newState);
  };

  return (
    <div ref={dropdownRef} className={cn('relative inline-block', className)}>
      <div onClick={handleToggle} className="cursor-pointer">
        {trigger}
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              'absolute z-[9999] mt-2 min-w-[180px] rounded-xl border shadow-2xl overflow-hidden',
              align === 'left' ? 'left-0' : 'right-0'
            )}
            style={{ 
              backgroundColor: 'var(--dropdown-bg, #ffffff)',
              borderColor: 'var(--dropdown-border, #e5e7eb)',
              zIndex: 9999,
            }}
          >
            <div className="py-1">
              {items.map((item, index) => (
                <motion.button
                  key={item.value}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => {
                    if (!item.disabled) {
                      onSelect(item.value);
                      setIsOpen(false);
                      onOpenChange?.(false);
                    }
                  }}
                  disabled={item.disabled}
                  className={cn(
                    'w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors',
                    item.disabled
                      ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : item.danger
                      ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  )}
                >
                  {item.icon && <span className="text-gray-400 dark:text-gray-500">{item.icon}</span>}
                  {item.label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Simple Select Dropdown
interface SelectDropdownProps {
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SelectDropdown({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  className,
}: SelectDropdownProps) {
  const selectedOption = options.find((o) => o.value === value);

  return (
    <Dropdown
      trigger={
        <div
          className={cn(
            'flex items-center justify-between h-10 px-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm hover:border-gray-300 dark:hover:border-gray-500 transition-colors',
            className
          )}
        >
          <span className={selectedOption ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>
      }
      items={options.map((o) => ({ label: o.label, value: o.value }))}
      onSelect={onChange}
    />
  );
}
