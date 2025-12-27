import { get, post, patch } from './client';
import type {
  User,
  Order,
  Shipment,
  Warehouse,
  InventoryItem,
  Carrier,
  SLAPolicy,
  SLAViolation,
  Return,
  Exception,
  DashboardMetrics,
  ChartDataPoint,
  CarrierPerformance,
  WarehouseUtilization,
  Notification,
  PaginatedResponse,
  ApiResponse,
} from '@/types';

// ==================== AUTH ====================
export const authApi = {
  async login(email: string, password: string): Promise<ApiResponse<{ user: User; accessToken: string; refreshToken: string }>> {
    return post('/auth/login', { email, password });
  },

  async refreshToken(refreshToken: string): Promise<ApiResponse<{ accessToken: string; refreshToken: string }>> {
    return post('/auth/refresh', { refreshToken });
  },

  async getProfile(): Promise<ApiResponse<User>> {
    return get('/auth/profile');
  },

  async logout(): Promise<ApiResponse<null>> {
    return post('/auth/logout');
  },
};

// ==================== ORDERS ====================
export const ordersApi = {
  async getOrders(page = 1, pageSize = 20, filters?: Record<string, unknown>): Promise<PaginatedResponse<Order>> {
    const response = await get<{ success: boolean; data: Order[]; pagination: { page: number; limit: number; total: number } }>(
      '/orders',
      { page, limit: pageSize, ...filters }
    );
    return {
      data: response.data,
      total: response.pagination.total,
      page: response.pagination.page,
      pageSize: response.pagination.limit,
      totalPages: Math.ceil(response.pagination.total / response.pagination.limit),
    };
  },

  async getOrder(id: string): Promise<ApiResponse<Order>> {
    return get(`/orders/${id}`);
  },

  async createOrder(orderData: Partial<Order>): Promise<ApiResponse<Order>> {
    return post('/orders', orderData);
  },

  async updateOrderStatus(id: string, status: string): Promise<ApiResponse<Order>> {
    return patch(`/orders/${id}/status`, { status });
  },
};

// ==================== SHIPMENTS ====================
export const shipmentsApi = {
  async getShipments(page = 1, pageSize = 20, filters?: Record<string, unknown>): Promise<PaginatedResponse<Shipment>> {
    const response = await get<{ success: boolean; data: Shipment[]; pagination: { page: number; limit: number; total: number } }>(
      '/shipments',
      { page, limit: pageSize, ...filters }
    );
    return {
      data: response.data,
      total: response.pagination.total,
      page: response.pagination.page,
      pageSize: response.pagination.limit,
      totalPages: Math.ceil(response.pagination.total / response.pagination.limit),
    };
  },

  async getShipment(id: string): Promise<ApiResponse<Shipment>> {
    return get(`/shipments/${id}`);
  },

  async getShipmentTimeline(id: string): Promise<ApiResponse<Shipment['events']>> {
    const response = await get<{ success: boolean; data: Shipment['events'] }>(`/shipments/${id}/timeline`);
    return { data: response.data, success: true };
  },

  async createShipment(data: Partial<Shipment>): Promise<ApiResponse<Shipment>> {
    return post('/shipments', data);
  },

  async updateShipmentStatus(id: string, status: string, location?: string): Promise<ApiResponse<Shipment>> {
    return patch(`/shipments/${id}/status`, { status, location });
  },
};

// ==================== WAREHOUSES ====================
export const warehousesApi = {
  async getWarehouses(filters?: Record<string, unknown>): Promise<ApiResponse<Warehouse[]>> {
    const response = await get<{ success: boolean; data: Warehouse[] }>('/warehouses', filters);
    return { data: response.data, success: true };
  },

  async getWarehouse(id: string): Promise<ApiResponse<Warehouse>> {
    return get(`/warehouses/${id}`);
  },

  async createWarehouse(data: Partial<Warehouse>): Promise<ApiResponse<Warehouse>> {
    return post('/warehouses', data);
  },
};

// ==================== INVENTORY ====================
export const inventoryApi = {
  async getInventory(page = 1, pageSize = 20, filters?: Record<string, unknown>): Promise<PaginatedResponse<InventoryItem>> {
    const response = await get<{ success: boolean; data: InventoryItem[]; pagination: { page: number; limit: number; total: number } }>(
      '/inventory',
      { page, limit: pageSize, ...filters }
    );
    return {
      data: response.data,
      total: response.pagination.total,
      page: response.pagination.page,
      pageSize: response.pagination.limit,
      totalPages: Math.ceil(response.pagination.total / response.pagination.limit),
    };
  },

  async getInventoryItem(id: string): Promise<ApiResponse<InventoryItem>> {
    return get(`/inventory/${id}`);
  },

  async adjustStock(id: string, adjustmentType: string, quantity: number, reason: string): Promise<ApiResponse<InventoryItem>> {
    return post(`/inventory/${id}/adjust`, { adjustmentType, quantity, reason });
  },

  async getStockMovements(id: string): Promise<ApiResponse<unknown[]>> {
    return get(`/inventory/${id}/movements`);
  },
};

// ==================== CARRIERS ====================
export const carriersApi = {
  async getCarriers(filters?: Record<string, unknown>): Promise<ApiResponse<Carrier[]>> {
    const response = await get<{ success: boolean; data: Carrier[] }>('/carriers', filters);
    return { data: response.data, success: true };
  },

  async getCarrier(id: string): Promise<ApiResponse<Carrier>> {
    return get(`/carriers/${id}`);
  },

  async createCarrier(data: Partial<Carrier>): Promise<ApiResponse<Carrier>> {
    return post('/carriers', data);
  },

  async getCarrierRates(carrierId: string): Promise<ApiResponse<unknown[]>> {
    return get(`/carriers/${carrierId}/rates`);
  },
};

// ==================== SLA ====================
export const slaApi = {
  async getSLAPolicies(): Promise<ApiResponse<SLAPolicy[]>> {
    const response = await get<{ success: boolean; data: SLAPolicy[] }>('/sla/policies');
    return { data: response.data, success: true };
  },

  async getSLAViolations(page = 1, pageSize = 20, filters?: Record<string, unknown>): Promise<PaginatedResponse<SLAViolation>> {
    const response = await get<{ success: boolean; data: SLAViolation[]; pagination: { page: number; limit: number; total: number } }>(
      '/sla/violations',
      { page, limit: pageSize, ...filters }
    );
    return {
      data: response.data,
      total: response.pagination.total,
      page: response.pagination.page,
      pageSize: response.pagination.limit,
      totalPages: Math.ceil(response.pagination.total / response.pagination.limit),
    };
  },

  async getSLADashboard(): Promise<ApiResponse<{ overallCompliance: number; violations: Record<string, number>; topCarriers: unknown[] }>> {
    return get('/sla/dashboard');
  },

  async getEta(shipmentId: string): Promise<ApiResponse<unknown>> {
    return get(`/eta/${shipmentId}`);
  },
};

// ==================== RETURNS ====================
export const returnsApi = {
  async getReturns(page = 1, pageSize = 20, filters?: Record<string, unknown>): Promise<PaginatedResponse<Return>> {
    const response = await get<{ success: boolean; data: Return[]; pagination: { page: number; limit: number; total: number } }>(
      '/returns',
      { page, limit: pageSize, ...filters }
    );
    return {
      data: response.data,
      total: response.pagination.total,
      page: response.pagination.page,
      pageSize: response.pagination.limit,
      totalPages: Math.ceil(response.pagination.total / response.pagination.limit),
    };
  },

  async getReturn(id: string): Promise<ApiResponse<Return>> {
    return get(`/returns/${id}`);
  },

  async createReturn(data: Partial<Return>): Promise<ApiResponse<Return>> {
    return post('/returns', data);
  },

  async updateReturn(id: string, data: Partial<Return>): Promise<ApiResponse<Return>> {
    return patch(`/returns/${id}`, data);
  },

  async getReturnStats(): Promise<ApiResponse<unknown>> {
    return get('/returns/stats');
  },
};

// ==================== EXCEPTIONS ====================
export const exceptionsApi = {
  async getExceptions(page = 1, pageSize = 20, filters?: Record<string, unknown>): Promise<PaginatedResponse<Exception>> {
    const response = await get<{ success: boolean; data: Exception[]; pagination: { page: number; limit: number; total: number } }>(
      '/exceptions',
      { page, limit: pageSize, ...filters }
    );
    return {
      data: response.data,
      total: response.pagination?.total || response.data.length,
      page: response.pagination?.page || page,
      pageSize: response.pagination?.limit || pageSize,
      totalPages: response.pagination ? Math.ceil(response.pagination.total / response.pagination.limit) : 1,
    };
  },

  async getException(id: string): Promise<ApiResponse<Exception>> {
    return get(`/exceptions/${id}`);
  },

  async createException(data: Partial<Exception>): Promise<ApiResponse<Exception>> {
    return post('/exceptions', data);
  },

  async resolveException(id: string, resolution: string): Promise<ApiResponse<Exception>> {
    return patch(`/exceptions/${id}/resolve`, { resolution });
  },
};

// ==================== DASHBOARD & ANALYTICS ====================
export const dashboardApi = {
  async getDashboardStats(): Promise<ApiResponse<DashboardMetrics>> {
    const response = await get<{ success: boolean; data: DashboardMetrics }>('/dashboard/stats');
    // Transform backend response to match frontend DashboardMetrics type
    const data = response.data;
    return {
      data: {
        totalOrders: data.orders?.total || 0,
        ordersChange: 0,
        activeShipments: data.shipments?.inTransit || 0,
        shipmentsChange: 0,
        deliveryRate: data.shipments?.onTimeRate || 0,
        deliveryRateChange: 0,
        slaCompliance: data.shipments?.onTimeRate || 0,
        slaComplianceChange: 0,
        pendingReturns: data.returns?.pending || 0,
        returnsChange: 0,
        activeExceptions: data.exceptions?.active || 0,
        exceptionsChange: 0,
        revenue: data.orders?.totalValue || 0,
        revenueChange: 0,
        avgDeliveryTime: 2.5,
        avgDeliveryTimeChange: 0,
      } as DashboardMetrics,
      success: true,
    };
  },

  async getAnalytics(period = '30d'): Promise<ApiResponse<{
    ordersOverTime: ChartDataPoint[];
    shipmentsByCarrier: unknown[];
    topProducts: unknown[];
    warehouseUtilization: WarehouseUtilization[];
  }>> {
    const response = await get<{ success: boolean; data: unknown }>('/analytics', { period });
    return { data: response.data as never, success: true };
  },

  async getOrdersChart(days = 30): Promise<ApiResponse<ChartDataPoint[]>> {
    const response = await get<{ success: boolean; data: { ordersOverTime: ChartDataPoint[] } }>('/analytics', { period: `${days}d` });
    const chartData = response.data.ordersOverTime?.map((item: { date: string; count: number }) => ({
      date: item.date,
      value: item.count,
    })) || [];
    return { data: chartData, success: true };
  },

  async getCarrierPerformance(): Promise<ApiResponse<CarrierPerformance[]>> {
    const response = await get<{ success: boolean; data: Carrier[] }>('/carriers');
    const performance: CarrierPerformance[] = response.data.map((carrier: Carrier) => ({
      carrierId: carrier.id,
      carrierName: carrier.name,
      totalShipments: carrier.totalShipments || 0,
      onTimeDeliveries: Math.floor((carrier.totalShipments || 0) * (carrier.onTimeDeliveryRate / 100)),
      lateDeliveries: Math.floor((carrier.totalShipments || 0) * ((100 - carrier.onTimeDeliveryRate) / 100)),
      onTimeRate: carrier.onTimeDeliveryRate,
      avgDeliveryTime: carrier.averageDeliveryTime,
      rating: carrier.rating,
      slaViolations: 0,
    }));
    return { data: performance, success: true };
  },

  async getWarehouseUtilization(): Promise<ApiResponse<WarehouseUtilization[]>> {
    const response = await get<{ success: boolean; data: Warehouse[] }>('/warehouses');
    const utilization: WarehouseUtilization[] = response.data.map((wh: Warehouse) => ({
      warehouseId: wh.id,
      warehouseName: wh.name,
      capacity: wh.capacity,
      used: Math.floor(wh.capacity * (wh.currentUtilization / 100)),
      utilizationRate: wh.currentUtilization,
      inboundToday: Math.floor(Math.random() * 200) + 50,
      outboundToday: Math.floor(Math.random() * 250) + 60,
    }));
    return { data: utilization, success: true };
  },
};

// ==================== NOTIFICATIONS ====================
export const notificationsApi = {
  async getNotifications(): Promise<ApiResponse<Notification[]>> {
    // For now, return mock notifications since we don't have a notifications table
    const mockNotifications: Notification[] = [
      {
        id: 'notif-1',
        type: 'sla',
        title: 'SLA Monitoring Active',
        message: 'System is monitoring SLA compliance',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ];
    return { data: mockNotifications, success: true };
  },

  async markNotificationRead(_id: string): Promise<ApiResponse<null>> {
    return { data: null, success: true };
  },

  async markAllNotificationsRead(): Promise<ApiResponse<null>> {
    return { data: null, success: true };
  },
};

// Export unified API object matching mockApi interface
export const realApi = {
  // Auth
  login: authApi.login,
  getCurrentUser: authApi.getProfile,
  logout: authApi.logout,

  // Orders
  getOrders: ordersApi.getOrders,
  getOrder: ordersApi.getOrder,
  createOrder: ordersApi.createOrder,
  updateOrder: ordersApi.updateOrderStatus,

  // Shipments
  getShipments: shipmentsApi.getShipments,
  getShipment: shipmentsApi.getShipment,
  getShipmentTimeline: shipmentsApi.getShipmentTimeline,

  // Warehouses
  getWarehouses: warehousesApi.getWarehouses,
  getWarehouse: warehousesApi.getWarehouse,

  // Inventory
  getInventory: inventoryApi.getInventory,

  // Carriers
  getCarriers: carriersApi.getCarriers,
  getCarrier: carriersApi.getCarrier,

  // SLA
  getSLAPolicies: slaApi.getSLAPolicies,
  getSLAViolations: slaApi.getSLAViolations,

  // Returns
  getReturns: returnsApi.getReturns,
  getReturn: returnsApi.getReturn,

  // Exceptions
  getExceptions: exceptionsApi.getExceptions,
  getException: exceptionsApi.getException,

  // Dashboard
  getDashboardMetrics: dashboardApi.getDashboardStats,
  getOrdersChart: dashboardApi.getOrdersChart,
  getCarrierPerformance: dashboardApi.getCarrierPerformance,
  getWarehouseUtilization: dashboardApi.getWarehouseUtilization,

  // Notifications
  getNotifications: notificationsApi.getNotifications,
  markNotificationRead: notificationsApi.markNotificationRead,
  markAllNotificationsRead: notificationsApi.markAllNotificationsRead,
};

export default realApi;
