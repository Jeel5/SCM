export interface Organization {
  id: string;
  code: string;
  name: string;
  email: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  timezone?: string;
  currency?: string;
  logoUrl?: string;
  subscriptionTier?: 'starter' | 'standard' | 'enterprise';
  isActive: boolean;
  isDeleted?: boolean;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  createdAt: string;
  updatedAt?: string;
  stats?: {
    activeUsers: number;
    activeWarehouses: number;
    totalOrders: number;
    totalShipments: number;
  };
}
