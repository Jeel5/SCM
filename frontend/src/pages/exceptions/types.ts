import type { Exception } from '@/types';

// Component Props
export interface ExceptionDetailsModalProps {
  exception: Exception | null;
  isOpen: boolean;
  onClose: () => void;
}

// Page State
export interface ExceptionsPageState {
  page: number;
  pageSize: number;
  activeTab: ExceptionTab;
  selectedException: Exception | null;
  isDetailsOpen: boolean;
}

// Tab Types
export type ExceptionTab = 'all' | 'open' | 'in_progress' | 'resolved';

export interface ExceptionTabConfig {
  id: ExceptionTab;
  label: string;
  count: number;
}

// Filters
export interface ExceptionFilters {
  status?: string[];
  severity?: ExceptionSeverity[];
  type?: ExceptionType[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
}

export type ExceptionSeverity = 'critical' | 'high' | 'medium' | 'low';

export type ExceptionType = 
  | 'delivery_delay' 
  | 'damage_report' 
  | 'lost_package' 
  | 'address_issue' 
  | 'payment_failed'
  | 'inventory_shortage'
  | 'carrier_issue'
  | 'system_error'
  | 'other';

// Stats
export interface ExceptionStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  critical: number;
  avgResolutionTime: number;
}
