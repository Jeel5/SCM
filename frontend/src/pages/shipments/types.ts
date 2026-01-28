import type { Shipment } from '@/types';

// Component Props
export interface ShipmentDetailsModalProps {
  shipment: Shipment | null;
  isOpen: boolean;
  onClose: () => void;
}

export interface ShipmentTimelineProps {
  shipment: Shipment;
}

export interface ShipmentMapProps {
  origin: {
    city: string;
    state: string;
    country: string;
    lat: number;
    lng: number;
  };
  destination: {
    city: string;
    state: string;
    country: string;
    lat: number;
    lng: number;
  };
  currentLocation?: {
    lat: number;
    lng: number;
    lastUpdate: string;
  };
}

// Page State
export interface ShipmentsPageState {
  page: number;
  pageSize: number;
  activeTab: ShipmentTab;
  selectedShipment: Shipment | null;
  isDetailsOpen: boolean;
}

// Tab Types
export type ShipmentTab = 'all' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed_delivery';

export interface ShipmentTabConfig {
  id: ShipmentTab;
  label: string;
  count: number;
}

// Filters
export interface ShipmentFilters {
  status?: string[];
  carrier?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
}
