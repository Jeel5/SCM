import type { Carrier } from '@/types';

export interface CarrierCardProps {
  carrier: Carrier;
  onViewDetails: () => void;
  index?: number;
  totalInRow?: number;
}

export interface CarrierDetailsModalProps {
  carrier: Carrier | null;
  isOpen: boolean;
  onClose: () => void;
}

export interface AddCarrierModalProps {
  isOpen: boolean;
  onClose: () => void;
}
