import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, Search, Calendar } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import { cn } from '@/lib/utils';

interface FilterOption {
  label: string;
  value: string;
}

interface FilterConfig {
  id: string;
  label: string;
  type: 'select' | 'multiselect' | 'date' | 'daterange' | 'search';
  options?: FilterOption[];
  placeholder?: string;
}

interface FilterPanelProps {
  filters: FilterConfig[];
  values: Record<string, unknown>;
  onChange: (filterId: string, value: unknown) => void;
  onReset: () => void;
  onApply: () => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

export function FilterPanel({
  filters,
  values,
  onChange,
  onReset,
  onApply,
  isOpen = true,
  onToggle,
}: FilterPanelProps) {
  const [localValues, setLocalValues] = useState(values);

  const handleChange = (filterId: string, value: unknown) => {
    setLocalValues(prev => ({ ...prev, [filterId]: value }));
    onChange(filterId, value);
  };

  const handleReset = () => {
    setLocalValues({});
    onReset();
  };

  const hasActiveFilters = Object.keys(localValues).some(
    key => localValues[key] !== undefined && localValues[key] !== '' && localValues[key] !== null
  );

  return (
    <div className="relative">
      {/* Toggle Button */}
      {onToggle && (
        <Button
          variant="outline"
          onClick={onToggle}
          className="mb-4"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {hasActiveFilters && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
              {Object.keys(localValues).filter(k => localValues[k]).length}
            </span>
          )}
        </Button>
      )}

      {/* Filter Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filters.map((filter) => (
                <FilterField
                  key={filter.id}
                  filter={filter}
                  value={localValues[filter.id]}
                  onChange={(value) => handleChange(filter.id, value)}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="ghost"
                onClick={handleReset}
                disabled={!hasActiveFilters}
                className="text-gray-600 dark:text-gray-400"
              >
                <X className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button
                onClick={onApply}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                Apply Filters
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FilterFieldProps {
  filter: FilterConfig;
  value: unknown;
  onChange: (value: unknown) => void;
}

function FilterField({ filter, value, onChange }: FilterFieldProps) {
  switch (filter.type) {
    case 'search':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {filter.label}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder={filter.placeholder || 'Search...'}
              value={(value as string) || ''}
              onChange={(e) => onChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      );

    case 'select':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {filter.label}
          </label>
          <Select
            value={(value as string) || ''}
            onValueChange={onChange}
            placeholder={filter.placeholder || 'Select...'}
          >
            {filter.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      );

    case 'multiselect':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {filter.label}
          </label>
          <MultiSelect
            options={filter.options || []}
            selected={(value as string[]) || []}
            onChange={onChange}
            placeholder={filter.placeholder}
          />
        </div>
      );

    case 'date':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {filter.label}
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="date"
              value={(value as string) || ''}
              onChange={(e) => onChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      );

    case 'daterange':
      return (
        <DateRangeFilter
          label={filter.label}
          value={value as { start?: string; end?: string }}
          onChange={onChange}
        />
      );

    default:
      return null;
  }
}

// Multi-select component
interface MultiSelectProps {
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

function MultiSelect({ options, selected, onChange, placeholder }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full px-3 py-2 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md",
          "focus:outline-none focus:ring-2 focus:ring-blue-500"
        )}
      >
        {selected.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {selected.slice(0, 2).map(val => (
              <span key={val} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                {options.find(o => o.value === val)?.label}
              </span>
            ))}
            {selected.length > 2 && (
              <span className="text-xs text-gray-500">+{selected.length - 2} more</span>
            )}
          </span>
        ) : (
          <span className="text-gray-400">{placeholder || 'Select options...'}</span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto"
          >
            {options.map((option) => (
              <label
                key={option.value}
                className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option.value)}
                  onChange={() => toggleOption(option.value)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
              </label>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Date range filter
interface DateRangeFilterProps {
  label: string;
  value?: { start?: string; end?: string };
  onChange: (value: { start?: string; end?: string }) => void;
}

function DateRangeFilter({ label, value = {}, onChange }: DateRangeFilterProps) {
  return (
    <div className="col-span-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="date"
            value={value.start || ''}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
            className="pl-10"
            placeholder="Start date"
          />
        </div>
        <span className="text-gray-400">to</span>
        <div className="flex-1 relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="date"
            value={value.end || ''}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
            className="pl-10"
            placeholder="End date"
          />
        </div>
      </div>
    </div>
  );
}
