export interface WarehouseCardProps {
  warehouse: any;
  onViewDetails: () => void;
}

export interface WarehouseDetailsModalProps {
  warehouse: any | null;
  isOpen: boolean;
  onClose: () => void;
}

export interface AddWarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
}
