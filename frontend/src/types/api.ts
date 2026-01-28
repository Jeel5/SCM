// Comprehensive API Response Types

/**
 * Standard API Response Structure
 * All API endpoints should return responses in this format
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Paginated API Response
 */
export interface PaginatedResponse<T = unknown> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
  message?: string;
}

/**
 * Pagination Metadata
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * API Error Response
 */
export interface ApiError {
  success: false;
  error: string;
  message?: string;
  details?: unknown;
  code?: string;
}

// ============================================
// Domain-Specific Response Types
// ============================================

// Orders
export interface OrdersResponse extends PaginatedResponse<Order> {}
export interface OrderResponse extends ApiResponse<Order> {}
export interface OrderStatsResponse extends ApiResponse<OrderStats> {}

export interface OrderStats {
  total: number;
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  totalRevenue: number;
  avgOrderValue: number;
}

// Shipments
export interface ShipmentsResponse extends PaginatedResponse<Shipment> {}
export interface ShipmentResponse extends ApiResponse<Shipment> {}
export interface ShipmentTrackingResponse extends ApiResponse<ShipmentTracking> {}

export interface ShipmentTracking {
  shipment: Shipment;
  events: ShipmentEvent[];
  currentLocation?: {
    lat: number;
    lng: number;
    lastUpdate: string;
  };
}

// Inventory
export interface InventoryResponse extends PaginatedResponse<InventoryItem> {}
export interface InventoryItemResponse extends ApiResponse<InventoryItem> {}
export interface InventoryStatsResponse extends ApiResponse<InventoryStats> {}

export interface InventoryStats {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  warehouseCount: number;
}

// Warehouses
export interface WarehousesResponse extends ApiResponse<Warehouse[]> {}
export interface WarehouseResponse extends ApiResponse<Warehouse> {}
export interface WarehouseUtilizationResponse extends ApiResponse<WarehouseUtilization[]> {}

// Carriers
export interface CarriersResponse extends ApiResponse<Carrier[]> {}
export interface CarrierResponse extends ApiResponse<Carrier> {}
export interface CarrierPerformanceResponse extends ApiResponse<CarrierPerformance[]> {}

// Returns
export interface ReturnsResponse extends PaginatedResponse<Return> {}
export interface ReturnResponse extends ApiResponse<Return> {}
export interface ReturnStatsResponse extends ApiResponse<ReturnStats> {}

export interface ReturnStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
  totalRefundAmount: number;
}

// Exceptions
export interface ExceptionsResponse extends PaginatedResponse<Exception> {}
export interface ExceptionResponse extends ApiResponse<Exception> {}
export interface ExceptionStatsResponse extends ApiResponse<ExceptionStats> {}

export interface ExceptionStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  critical: number;
  avgResolutionTime: number;
}

// SLA
export interface SLAPoliciesResponse extends PaginatedResponse<SLAPolicy> {}
export interface SLAPolicyResponse extends ApiResponse<SLAPolicy> {}
export interface SLAViolationsResponse extends PaginatedResponse<SLAViolation> {}
export interface SLADashboardResponse extends ApiResponse<SLADashboard> {}

export interface SLADashboard {
  totalPolicies: number;
  activePolicies: number;
  totalViolations: number;
  complianceRate: number;
  avgDeliveryTime: number;
  penaltiesPaid: number;
}

// Dashboard
export interface DashboardStatsResponse extends ApiResponse<DashboardMetrics> {}
export interface OrdersChartResponse extends ApiResponse<ChartDataPoint[]> {}

// Finance
export interface InvoicesResponse extends PaginatedResponse<Invoice> {}
export interface InvoiceResponse extends ApiResponse<Invoice> {}
export interface RefundsResponse extends PaginatedResponse<Refund> {}
export interface FinanceStatsResponse extends ApiResponse<FinanceStats> {}

export interface FinanceStats {
  totalRevenue: number;
  outstandingInvoices: number;
  paidInvoices: number;
  refundsProcessed: number;
  activeDisputes: number;
}

// Users/Auth
export interface LoginResponse extends ApiResponse<LoginData> {}
export interface UserResponse extends ApiResponse<User> {}
export interface UsersResponse extends PaginatedResponse<User> {}

export interface LoginData {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// ============================================
// Re-export Domain Types
// ============================================

export type {
  Order,
  Shipment,
  ShipmentEvent,
  InventoryItem,
  Warehouse,
  WarehouseUtilization,
  Carrier,
  CarrierPerformance,
  Return,
  Exception,
  SLAPolicy,
  SLAViolation,
  DashboardMetrics,
  ChartDataPoint,
  Invoice,
  Refund,
  User,
} from './index';
