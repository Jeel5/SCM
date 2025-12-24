import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

// Tailwind class merger utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

// Format number with commas
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

// Format percentage
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// Format date
export function formatDate(date: string | Date, formatStr: string = 'MMM dd, yyyy'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatStr);
}

// Format datetime
export function formatDateTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'MMM dd, yyyy HH:mm');
}

// Format relative time
export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true });
}

// Generate random ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Truncate text
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Status color mapping
export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    // Order statuses
    created: 'bg-gray-100 text-gray-800',
    confirmed: 'bg-blue-100 text-blue-800',
    allocated: 'bg-indigo-100 text-indigo-800',
    processing: 'bg-yellow-100 text-yellow-800',
    shipped: 'bg-purple-100 text-purple-800',
    in_transit: 'bg-orange-100 text-orange-800',
    out_for_delivery: 'bg-cyan-100 text-cyan-800',
    delivered: 'bg-green-100 text-green-800',
    returned: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
    
    // Shipment statuses
    pending: 'bg-gray-100 text-gray-800',
    picked_up: 'bg-blue-100 text-blue-800',
    at_hub: 'bg-indigo-100 text-indigo-800',
    failed_delivery: 'bg-red-100 text-red-800',
    
    // SLA statuses
    on_track: 'bg-green-100 text-green-800',
    at_risk: 'bg-yellow-100 text-yellow-800',
    breached: 'bg-red-100 text-red-800',
    
    // Exception statuses
    open: 'bg-red-100 text-red-800',
    investigating: 'bg-yellow-100 text-yellow-800',
    pending_resolution: 'bg-orange-100 text-orange-800',
    resolved: 'bg-green-100 text-green-800',
    escalated: 'bg-purple-100 text-purple-800',
    closed: 'bg-gray-100 text-gray-800',
    
    // Return statuses
    requested: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    pickup_scheduled: 'bg-indigo-100 text-indigo-800',
    received: 'bg-cyan-100 text-cyan-800',
    inspected: 'bg-purple-100 text-purple-800',
    refunded: 'bg-green-100 text-green-800',
    replaced: 'bg-teal-100 text-teal-800',
    
    // General
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    suspended: 'bg-red-100 text-red-800',
    maintenance: 'bg-yellow-100 text-yellow-800',
  };
  
  return colorMap[status] || 'bg-gray-100 text-gray-800';
}

// Priority color mapping
export function getPriorityColor(priority: string): string {
  const colorMap: Record<string, string> = {
    express: 'bg-red-100 text-red-800 border-red-200',
    standard: 'bg-blue-100 text-blue-800 border-blue-200',
    bulk: 'bg-gray-100 text-gray-800 border-gray-200',
    low: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
  };
  
  return colorMap[priority] || 'bg-gray-100 text-gray-800 border-gray-200';
}

// Debounce function
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Role display names
export function getRoleDisplayName(role: string): string {
  const roleNames: Record<string, string> = {
    admin: 'Administrator',
    operations_manager: 'Operations Manager',
    warehouse_manager: 'Warehouse Manager',
    carrier_partner: 'Carrier Partner',
    finance: 'Finance & Accounts',
    customer_support: 'Customer Support',
  };
  
  return roleNames[role] || role;
}

// Check role permissions
export function hasPermission(userRole: string, requiredRoles: string[]): boolean {
  if (requiredRoles.length === 0) return true;
  return requiredRoles.includes(userRole);
}

// Storage utilities
export const storage = {
  get: <T>(key: string): T | null => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },
  set: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      console.error('Failed to save to localStorage');
    }
  },
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {
      console.error('Failed to remove from localStorage');
    }
  },
};

// Calculate change percentage
export function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// Format status text (snake_case to Title Case)
export function formatStatusText(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
