export interface CarrierCardProps {
  carrier: any;
  onViewDetails: () => void;
  index?: number;
  totalInRow?: number;
}

export interface CarrierDetailsModalProps {
  carrier: any | null;
  isOpen: boolean;
  onClose: () => void;
}

export interface AddCarrierModalProps {
  isOpen: boolean;
  onClose: () => void;
}
