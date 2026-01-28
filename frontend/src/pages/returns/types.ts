import type { Return } from '@/types';

// Component Props
export interface ReturnDetailsModalProps {
  returnItem: Return | null;
  isOpen: boolean;
  onClose: () => void;
}

export interface CreateReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Page State
export interface ReturnsPageState {
  page: number;
  pageSize: number;
  activeTab: ReturnTab;
  selectedReturn: Return | null;
  isDetailsOpen: boolean;
  isCreateOpen: boolean;
}

// Tab Types
export type ReturnTab = 'all' | 'pending' | 'approved' | 'rejected' | 'completed';

export interface ReturnTabConfig {
  id: ReturnTab;
  label: string;
  count: number;
}

// Form Data
export interface CreateReturnFormData {
  orderId: string;
  reason: ReturnReason;
  items: ReturnItemData[];
  comments?: string;
  requestPickup: boolean;
  pickupAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

export interface ReturnItemData {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  reason?: string;
}

export type ReturnReason = 'defective' | 'wrong_item' | 'damaged' | 'not_as_described' | 'changed_mind' | 'other';

// Filters
export interface ReturnFilters {
  status?: string[];
  reason?: ReturnReason[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
  minAmount?: number;
  maxAmount?: number;
}
