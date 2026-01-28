import type { Warehouse } from '@/types';

export interface WarehouseCardProps {
  warehouse: Warehouse;
  onViewDetails: () => void;
}

export interface WarehouseDetailsModalProps {
  warehouse: Warehouse | null;
  isOpen: boolean;
  onClose: () => void;
}

export interface AddWarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
}
