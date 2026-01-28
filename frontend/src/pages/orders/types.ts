import type { Order } from '@/types';

export interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface OrderStatsProps {
  orders: Order[];
  totalOrders: number;
}

export interface OrdersPageTab {
  id: string;
  label: string;
  count?: number;
}
