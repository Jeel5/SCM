// User & Auth Types
export type UserRole = 
  | 'superadmin'
  | 'admin' 
  | 'operations_manager' 
  | 'warehouse_manager' 
  | 'carrier_partner' 
  | 'finance' 
  | 'customer_support';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  organizationId: string | null; // null for superadmin
  permissions: string[];
  createdAt: string;
  lastLogin: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
}

// Order Types
export type OrderStatus = 
  | 'created' 
  | 'confirmed' 
  | 'allocated' 
  | 'processing'
  | 'shipped' 
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered' 
  | 'returned'
  | 'cancelled';

export type OrderPriority = 'express' | 'standard' | 'bulk';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  weight: number;
  warehouseId?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: OrderStatus;
  priority: OrderPriority;
  items: OrderItem[];
  shippingAddress: Address;
  billingAddress: Address;
  totalAmount: number;
  currency: string;
  shipmentId?: string;
  createdAt: string;
  updatedAt: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  notes?: string;
}

// Address Type
export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

// Shipment Types
export type ShipmentStatus = 
  | 'pending'
  | 'picked_up' 
  | 'in_transit' 
  | 'at_hub'
  | 'out_for_delivery' 
  | 'delivered'
  | 'failed_delivery'
  | 'returned';

export interface ShipmentEvent {
  id: string;
  shipmentId: string;
  status: ShipmentStatus;
  location: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  timestamp: string;
  description: string;
  performedBy?: string;
}

export interface Shipment {
  id: string;
  trackingNumber: string;
  orderId: string;
  carrierId: string;
  carrierName: string;
  status: ShipmentStatus;
  origin: Address;
  destination: Address;
  currentLocation?: {
    lat: number;
    lng: number;
  };
  events: ShipmentEvent[];
  weight: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  estimatedDelivery: string;
  actualDelivery?: string;
  slaDeadline: string;
  cost: number;
  createdAt: string;
  updatedAt: string;
}

// Warehouse Types
export interface Warehouse {
  id: string;
  code: string;
  name: string;
  type: 'fulfillment' | 'distribution' | 'cross_dock' | 'cold_storage';
  address: Address;
  capacity: number;
  currentUtilization: number;
  utilizationPercentage: number;
  inventoryCount: number;
  zones: number;
  location: {
    lat: number;
    lng: number;
  };
  status: 'active' | 'inactive' | 'maintenance';
  managerId?: string;
  contactEmail: string;
  contactPhone: string;
  operatingHours: {
    open: string;
    close: string;
    timezone: string;
  };
  createdAt: string;
}

// Inventory Types
export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  name: string;
  sku: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minQuantity: number;
  maxQuantity: number;
  reorderPoint: number;
  reorderQuantity: number;
  unitCost: number;
  category: string;
  unit: string;
  location: string;
  lastRestocked: string;
  updatedAt: string;
}

// Carrier Types
export interface Carrier {
  id: string;
  code: string;
  name: string;
  logo?: string;
  type: 'ground' | 'air' | 'sea' | 'rail' | 'multimodal';
  status: 'active' | 'inactive' | 'suspended';
  rating: number;
  onTimeDeliveryRate: number;
  damageRate: number;
  lossRate: number;
  averageDeliveryTime: number;
  activeShipments: number;
  totalShipments: number;
  services: string[];
  serviceAreas: string[];
  rateCard: RateCard[];
  contactEmail: string;
  contactPhone: string;
  apiEndpoint?: string;
  createdAt: string;
}

export interface RateCard {
  id: string;
  carrierId: string;
  serviceType: string;
  originZone: string;
  destinationZone: string;
  weightMin: number;
  weightMax: number;
  baseRate: number;
  perKgRate: number;
  fuelSurcharge: number;
  effectiveFrom: string;
  effectiveTo: string;
}

// SLA Types
export type SLAStatus = 'on_track' | 'at_risk' | 'breached';

export interface SLAPolicy {
  id: string;
  name: string;
  serviceType: string;
  region: string;
  carrierId?: string;
  targetDeliveryHours: number;
  warningThresholdHours: number;
  penaltyAmount: number;
  penaltyType: 'fixed' | 'percentage';
  isActive: boolean;
  createdAt: string;
}

export interface SLAViolation {
  id: string;
  shipmentId: string;
  orderId: string;
  policyId: string;
  policyName: string;
  expectedDelivery: string;
  actualDelivery?: string;
  delayHours: number;
  status: 'pending' | 'acknowledged' | 'resolved' | 'waived';
  penaltyAmount: number;
  carrierId: string;
  carrierName: string;
  rootCause?: string;
  notes?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface SLADashboardData {
  overallCompliance: number;
  totalShipments: number;
  onTimeDeliveries: number;
  violations: { pending: number; resolved: number; waived: number };
  topCarriers: unknown[];
}

// Return Types
export type ReturnStatus = 
  | 'pending'
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'processing'
  | 'pickup_scheduled'
  | 'picked_up'
  | 'in_transit'
  | 'received'
  | 'inspected'
  | 'completed'
  | 'refunded'
  | 'replaced'
  | 'closed';

export type ReturnReason = 
  | 'damaged'
  | 'wrong_item'
  | 'not_as_described'
  | 'changed_mind'
  | 'quality_issue'
  | 'late_delivery'
  | 'other';

export interface Return {
  id: string;
  rmaNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  status: ReturnStatus;
  reason: ReturnReason;
  type: 'refund' | 'exchange' | 'store_credit';
  reasonDetails?: string;
  notes?: string;
  items: ReturnItem[];
  pickupAddress: Address;
  warehouseId: string;
  shipmentId?: string;
  trackingNumber?: string;
  refundAmount?: number;
  refundStatus?: 'pending' | 'processed' | 'failed';
  qualityCheckResult?: 'pass' | 'fail' | 'partial';
  qualityCheckNotes?: string;
  requestedAt: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ReturnItem {
  id: string;
  productId: string;
  productName: string;
  name: string;
  sku: string;
  quantity: number;
  condition?: 'new' | 'good' | 'damaged' | 'defective';
}

// Exception Types
export type ExceptionType = 
  | 'delay'
  | 'damage'
  | 'lost'
  | 'wrong_address'
  | 'customer_unavailable'
  | 'carrier_issue'
  | 'weather'
  | 'other';

export type ExceptionSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ExceptionStatus = 
  | 'open'
  | 'investigating'
  | 'pending_resolution'
  | 'resolved'
  | 'escalated'
  | 'closed';

export interface Exception {
  id: string;
  ticketNumber: string;
  shipmentId: string;
  orderId: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  title: string;
  description: string;
  rootCause?: string;
  resolution?: string;
  resolutionType?: 'reship' | 'refund' | 'credit' | 'escalate' | 'no_action';
  assignedTo?: string;
  assignedToName?: string;
  slaImpact: boolean;
  estimatedResolutionTime?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

// Analytics Types
export interface DashboardMetrics {
  totalOrders: number;
  ordersChange: number;
  activeShipments: number;
  shipmentsChange: number;
  deliveryRate: number;
  deliveryRateChange: number;
  slaCompliance: number;
  slaComplianceChange: number;
  pendingReturns: number;
  returnsChange: number;
  activeExceptions: number;
  exceptionsChange: number;
  revenue: number;
  revenueChange: number;
  avgDeliveryTime: number;
  avgDeliveryTimeChange: number;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface CarrierPerformance {
  carrierId: string;
  carrierName: string;
  totalShipments: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  onTimeRate: number;
  avgDeliveryTime: number;
  rating: number;
  slaViolations: number;
}

export interface WarehouseUtilization {
  warehouseId: string;
  warehouseName: string;
  capacity: number;
  used: number;
  utilizationRate: number;
  inboundToday: number;
  outboundToday: number;
}

// Notification Types
export type NotificationType = 
  | 'order'
  | 'shipment'
  | 'sla'
  | 'exception'
  | 'return'
  | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, string[]>;
}

// Filter & Sort Types
export interface FilterOptions {
  search?: string;
  status?: string[];
  dateFrom?: string;
  dateTo?: string;
  priority?: string[];
  carrierId?: string;
  warehouseId?: string;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
}

// Re-export API types
export * from './api';
