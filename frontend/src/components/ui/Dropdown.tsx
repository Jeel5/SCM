import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  side?: 'top' | 'bottom';
  className?: string;
  onOpenChange?: (isOpen: boolean) => void;
}

export function Dropdown({ trigger, items, onSelect, align = 'left', side = 'bottom', className, onOpenChange }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const [resolvedSide, setResolvedSide] = useState<'top' | 'bottom'>(side);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = () => {
    const triggerEl = triggerRef.current;
    const menuEl = menuRef.current;
    if (!triggerEl || !menuEl) return;

    const triggerRect = triggerEl.getBoundingClientRect();
    const menuRect = menuEl.getBoundingClientRect();
    const spacing = 8;

    const menuWidth = Math.max(menuRect.width || 180, 180);
    const menuHeight = Math.max(menuRect.height || 40, 40);

    const hasRoomAbove = triggerRect.top >= menuHeight + spacing;
    const hasRoomBelow = window.innerHeight - triggerRect.bottom >= menuHeight + spacing;

    let nextSide: 'top' | 'bottom' = side;
    if (side === 'top' && !hasRoomAbove && hasRoomBelow) nextSide = 'bottom';
    if (side === 'bottom' && !hasRoomBelow && hasRoomAbove) nextSide = 'top';

    let left = align === 'right' ? triggerRect.right - menuWidth : triggerRect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

    let top = nextSide === 'bottom'
      ? triggerRect.bottom + spacing
      : triggerRect.top - menuHeight - spacing;
    top = Math.max(8, Math.min(top, window.innerHeight - menuHeight - 8));

    setResolvedSide(nextSide);
    setMenuStyle({ top, left, minWidth: Math.max(triggerRect.width, 180) });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideTrigger = dropdownRef.current?.contains(target);
      const clickedInsideMenu = menuRef.current?.contains(target);

      if (!clickedInsideTrigger && !clickedInsideMenu) {
        setIsOpen(false);
        onOpenChange?.(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onOpenChange]);

  useEffect(() => {
    if (!isOpen) return;

    const update = () => updateMenuPosition();
    update();

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isOpen, align, side]);

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onOpenChange?.(newState);
  };

  return (
    <div ref={dropdownRef} className={cn('relative inline-block', className)}>
      <div ref={triggerRef} onClick={handleToggle} className="cursor-pointer">
        {trigger}
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: resolvedSide === 'bottom' ? -6 : 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: resolvedSide === 'bottom' ? -6 : 6, scale: 0.96 }}
              transition={{ duration: 0.14 }}
              className="fixed z-10000 rounded-xl border shadow-2xl overflow-hidden"
              style={{
                top: menuStyle?.top,
                left: menuStyle?.left,
                minWidth: menuStyle?.minWidth,
                backgroundColor: 'var(--dropdown-bg, #ffffff)',
                borderColor: 'var(--dropdown-border, #e5e7eb)',
              }}
            >
              <div className="py-1">
                {items.map((item, index) => (
                  <motion.button
                    key={item.value}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
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
        </AnimatePresence>,
        document.body
      )}
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
