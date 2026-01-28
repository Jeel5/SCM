import type { SLAPolicy, SLAViolation } from '@/types';

// Page State
export interface SLAPageState {
  activeTab: SLATab;
  page: number;
  pageSize: number;
}

// Tab Types
export type SLATab = 'overview' | 'policies' | 'violations';

export interface SLATabConfig {
  id: SLATab;
  label: string;
  count?: number;
}

// Dashboard Data
export interface SLADashboardData {
  totalPolicies: number;
  activePolicies: number;
  totalViolations: number;
  complianceRate: number;
  avgDeliveryTime: number;
  penaltiesPaid: number;
  performanceByCarrier: CarrierPerformance[];
  violationsTrend: ViolationTrendData[];
}

export interface CarrierPerformance {
  carrierId: string;
  carrierName: string;
  totalShipments: number;
  violations: number;
  complianceRate: number;
  avgDeliveryTime: number;
  penaltiesIncurred: number;
}

export interface ViolationTrendData {
  date: string;
  violations: number;
  penalties: number;
}

// Policy Form Data
export interface SLAPolicyFormData {
  name: string;
  serviceType: string;
  region: string;
  targetDeliveryHours: number;
  penaltyAmount: number;
  isActive: boolean;
  carrierIds?: string[];
  gracePeriodHours?: number;
}

// Violation Details
export interface ViolationDetailsProps {
  violation: SLAViolation;
  onResolve?: () => void;
  onWaive?: () => void;
}

// Filters
export interface SLAFilters {
  serviceType?: string[];
  region?: string[];
  isActive?: boolean;
  violationStatus?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}
