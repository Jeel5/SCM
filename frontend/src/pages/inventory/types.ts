import type { InventoryItem, Warehouse } from '@/types';

export interface InventoryDetailsModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
}

export interface StockLevelIndicatorProps {
  item: InventoryItem;
}

export interface InventoryStatsProps {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  warehouses: Warehouse[];
}

export interface InventoryPageTab {
  id: string;
  label: string;
  count?: number;
}
