import { get, post, patch, put, del } from './client';
import type {
  User,
  Order,
  Shipment,
  Warehouse,
  InventoryItem,
  Product,
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
  async login(email: string, password: string): Promise<ApiResponse<{ user: User }>> {
    return post('/auth/login', { email, password });
  },

  async refreshToken(): Promise<ApiResponse<null>> {
    // Sends the refreshToken httpOnly cookie automatically via withCredentials
    return post('/auth/refresh', {});
  },

  async getProfile(): Promise<ApiResponse<User>> {
    return get('/auth/profile');
  },

  async logout(): Promise<ApiResponse<null>> {
    // Backend clears both httpOnly cookies (accessToken + refreshToken)
    return post('/auth/logout', {});
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

  async createTransferOrder(transferData: {
    from_warehouse_id: string;
    to_warehouse_id: string;
    items: Array<{
      product_id: string;
      sku: string;
      product_name: string;
      quantity: number;
      unit_cost?: number;
    }>;
    priority?: string;
    reason: string;
    requested_by?: string;
    notes?: string;
    expected_delivery_date?: string;
  }): Promise<ApiResponse<{ order: Order; shipment: Shipment; fromWarehouse: unknown; toWarehouse: unknown }>> {
    return post('/orders/transfer', transferData);
  },

  async updateOrderStatus(id: string, status: string): Promise<ApiResponse<Order>> {
    return patch(`/orders/${id}/status`, { status });
  },

  async requestCarrierAssignment(id: string, force: boolean = false): Promise<ApiResponse<unknown>> {
    return post(`/orders/${id}/request-carriers${force ? '?force=true' : ''}`);
  },
};

// ==================== SHIPMENTS ====================
export const shipmentsApi = {
  async getShipments(page = 1, pageSize = 20, filters?: Record<string, unknown>): Promise<PaginatedResponse<Shipment>> {
    const response = await get<{ success: boolean; data: Shipment[]; pagination?: { page: number; limit: number; total: number } }>(
      '/shipments',
      { page, limit: pageSize, ...filters }
    );
    return {
      data: response.data,
      total: response.pagination?.total || 0,
      page: response.pagination?.page || 1,
      pageSize: response.pagination?.limit || pageSize,
      totalPages: Math.ceil((response.pagination?.total || 0) / (response.pagination?.limit || pageSize)),
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

  async updateWarehouse(id: string, data: Partial<Warehouse>): Promise<ApiResponse<Warehouse>> {
    return put(`/warehouses/${id}`, data);
  },

  async deleteWarehouse(id: string): Promise<ApiResponse<void>> {
    return del(`/warehouses/${id}`);
  },

  async getWarehouseStats(id: string): Promise<ApiResponse<any>> {
    return get(`/warehouses/${id}/stats`);
  },

  async getWarehouseInventory(id: string, page = 1, limit = 20): Promise<PaginatedResponse<any>> {
    const response = await get<{ success: boolean; data: any[]; pagination: any }>(`/warehouses/${id}/inventory`, { page, limit });
    return {
      data: response.data,
      total: response.pagination.total,
      page: response.pagination.page,
      pageSize: response.pagination.limit,
      totalPages: response.pagination.totalPages,
    };
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

  async createInventoryItem(data: Partial<InventoryItem>): Promise<ApiResponse<InventoryItem>> {
    return post('/inventory', data);
  },

  async updateInventoryItem(id: string, data: Partial<InventoryItem>): Promise<ApiResponse<InventoryItem>> {
    return patch(`/inventory/${id}`, data);
  },

  async adjustStock(id: string, adjustmentType: string, quantity: number, reason: string): Promise<ApiResponse<InventoryItem>> {
    return post(`/inventory/${id}/adjust`, { adjustment_type: adjustmentType, quantity, reason });
  },

  async getStockMovements(id: string): Promise<ApiResponse<unknown[]>> {
    return get(`/inventory/${id}/movements`);
  },

  async getLowStockItems(warehouseId?: string): Promise<ApiResponse<InventoryItem[]>> {
    const response = await get<{ success: boolean; data: InventoryItem[] }>(
      '/inventory/low-stock',
      warehouseId ? { warehouse_id: warehouseId } : undefined
    );
    return { data: response.data, success: true };
  },

  async getInventoryStats(warehouseId?: string): Promise<ApiResponse<{
    total_items: number;
    total_quantity: number;
    total_available: number;
    total_reserved: number;
    low_stock_items: number;
    out_of_stock_items: number;
    total_inventory_value: number;
  }>> {
    return get('/inventory/stats', warehouseId ? { warehouse_id: warehouseId } : undefined);
  },

  async transferInventory(data: {
    sku: string;
    from_warehouse_id: string;
    to_warehouse_id: string;
    quantity: number;
    reason: string;
    performed_by: string;
  }): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return post('/inventory/transfer', data);
  },
};

// ==================== PRODUCTS ====================
export const productsApi = {
  async getProducts(filters?: Record<string, unknown>): Promise<PaginatedResponse<Product>> {
    const response = await get<{ success: boolean; data: Record<string, unknown>[]; pagination: { page: number; limit: number; total: number } }>('/products', filters);
    return {
      data: response.data.map(mapProduct),
      total: response.pagination?.total ?? response.data.length,
      page: response.pagination?.page ?? 1,
      pageSize: response.pagination?.limit ?? 50,
      totalPages: response.pagination ? Math.ceil(response.pagination.total / response.pagination.limit) : 1,
    };
  },

  async getProduct(id: string): Promise<ApiResponse<Product>> {
    const response = await get<{ success: boolean; data: Record<string, unknown> }>(`/products/${id}`);
    return { data: mapProduct(response.data), success: true };
  },

  async createProduct(data: Partial<Product> & { name: string }): Promise<ApiResponse<Product>> {
    const response = await post<{ success: boolean; data: Record<string, unknown> }>('/products', toSnakeProduct(data));
    return { data: mapProduct(response.data), success: true };
  },

  async updateProduct(id: string, data: Partial<Product>): Promise<ApiResponse<Product>> {
    const response = await put<{ success: boolean; data: Record<string, unknown> }>(`/products/${id}`, toSnakeProduct(data));
    return { data: mapProduct(response.data), success: true };
  },

  async deleteProduct(id: string): Promise<ApiResponse<null>> {
    return del(`/products/${id}`);
  },
};

/** Map raw DB row (snake_case) → Product (camelCase) */
function mapProduct(p: Record<string, unknown>): Product {
  return {
    id: p.id as string,
    organizationId: p.organization_id as string | null,
    sku: p.sku as string,
    name: p.name as string,
    description: (p.description as string | null) ?? null,
    category: (p.category as string | null) ?? null,
    brand: (p.brand as string | null) ?? null,
    weight: p.weight != null ? parseFloat(p.weight as string) : null,
    dimensions: (p.dimensions as Product['dimensions']) ?? null,
    sellingPrice: p.selling_price != null ? parseFloat(p.selling_price as string) : null,
    costPrice: p.cost_price != null ? parseFloat(p.cost_price as string) : null,
    mrp: p.mrp != null ? parseFloat(p.mrp as string) : null,
    currency: (p.currency as string) || 'INR',
    isFragile: Boolean(p.is_fragile),
    requiresColdStorage: Boolean(p.requires_cold_storage),
    isHazmat: Boolean(p.is_hazmat),
    isPerishable: Boolean(p.is_perishable),
    packageType: (p.package_type as Product['packageType']) ?? null,
    handlingInstructions: (p.handling_instructions as string | null) ?? null,
    requiresInsurance: Boolean(p.requires_insurance),
    hsnCode: (p.hsn_code as string | null) ?? null,
    gstRate: p.gst_rate != null ? parseFloat(p.gst_rate as string) : null,
    countryOfOrigin: (p.country_of_origin as string | null) ?? null,
    manufacturerBarcode: (p.manufacturer_barcode as string | null) ?? null,
    internalBarcode: p.internal_barcode as string,
    warrantyPeriodDays: p.warranty_period_days != null ? parseInt(p.warranty_period_days as string) : 0,
    shelfLifeDays: p.shelf_life_days != null ? parseInt(p.shelf_life_days as string) : null,
    supplierId: (p.supplier_id as string | null) ?? null,
    tags: (p.tags as string[]) ?? [],
    attributes: (p.attributes as Record<string, unknown> | null) ?? null,
    volumetricWeight: p.volumetric_weight != null ? parseFloat(p.volumetric_weight as string) : null,
    isActive: Boolean(p.is_active),
    createdAt: p.created_at as string,
    updatedAt: p.updated_at as string,
  };
}

/** Map Product (camelCase) → backend payload (snake_case) */
function toSnakeProduct(data: Partial<Product>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (data.sku !== undefined)                    out.sku = data.sku;
  if (data.name !== undefined)                   out.name = data.name;
  if (data.description !== undefined)            out.description = data.description;
  if (data.category !== undefined)               out.category = data.category;
  if (data.brand !== undefined)                  out.brand = data.brand;
  if (data.weight !== undefined)                 out.weight = data.weight;
  if (data.dimensions !== undefined)             out.dimensions = data.dimensions;
  if (data.sellingPrice !== undefined)           out.selling_price = data.sellingPrice;
  if (data.costPrice !== undefined)              out.cost_price = data.costPrice;
  if (data.mrp !== undefined)                    out.mrp = data.mrp;
  if (data.currency !== undefined)               out.currency = data.currency;
  if (data.isFragile !== undefined)              out.is_fragile = data.isFragile;
  if (data.requiresColdStorage !== undefined)    out.requires_cold_storage = data.requiresColdStorage;
  if (data.isHazmat !== undefined)               out.is_hazmat = data.isHazmat;
  if (data.isPerishable !== undefined)           out.is_perishable = data.isPerishable;
  if (data.packageType !== undefined)            out.package_type = data.packageType;
  if (data.handlingInstructions !== undefined)   out.handling_instructions = data.handlingInstructions;
  if (data.requiresInsurance !== undefined)      out.requires_insurance = data.requiresInsurance;
  if (data.hsnCode !== undefined)                out.hsn_code = data.hsnCode;
  if (data.gstRate !== undefined)                out.gst_rate = data.gstRate;
  if (data.countryOfOrigin !== undefined)        out.country_of_origin = data.countryOfOrigin;
  if (data.manufacturerBarcode !== undefined)    out.manufacturer_barcode = data.manufacturerBarcode;
  if (data.warrantyPeriodDays !== undefined)     out.warranty_period_days = data.warrantyPeriodDays;
  if (data.shelfLifeDays !== undefined)          out.shelf_life_days = data.shelfLifeDays;
  if (data.supplierId !== undefined)             out.supplier_id = data.supplierId;
  if (data.tags !== undefined)                   out.tags = data.tags;
  if (data.isActive !== undefined)               out.is_active = data.isActive;
  if (data.attributes !== undefined)             out.attributes = data.attributes;
  return out;
}

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
    // Transform camelCase to snake_case for backend
    const backendData = {
      name: data.name,
      contact_email: data.contactEmail,
      contact_phone: data.contactPhone,
      website: data.website,
      status: data.status,
      services_offered: data.servicesOffered,
      service_type: data.serviceType
    };
    return post('/carriers', backendData);
  },

  async getCarrierRates(carrierId: string): Promise<ApiResponse<unknown[]>> {
    return get(`/carriers/${carrierId}/rates`);
  },

  async updateCarrier(id: string, data: Partial<Carrier>): Promise<ApiResponse<Carrier>> {
    const backendData: Record<string, unknown> = {};
    if (data.name !== undefined) backendData.name = data.name;
    if (data.contactEmail !== undefined) backendData.contact_email = data.contactEmail;
    if (data.contactPhone !== undefined) backendData.contact_phone = data.contactPhone;
    if (data.website !== undefined) backendData.website = data.website;
    if (data.status !== undefined) backendData.status = data.status;
    if (data.servicesOffered !== undefined) backendData.services_offered = data.servicesOffered;
    if (data.serviceType !== undefined) backendData.service_type = data.serviceType;
    return put(`/carriers/${id}`, backendData);
  },

  async deleteCarrier(id: string): Promise<ApiResponse<{ message: string }>> {
    return del(`/carriers/${id}`);
  },
};

// ==================== SLA ====================
export const slaApi = {
  async getSLAPolicies(): Promise<ApiResponse<SLAPolicy[]>> {
    const response = await get<{ success: boolean; data: SLAPolicy[] }>('/sla/policies');
    return { data: response.data, success: true };
  },

  async createSLAPolicy(data: Omit<SLAPolicy, 'id' | 'createdAt' | 'region' | 'warningThresholdHours' | 'carrierName'>): Promise<ApiResponse<SLAPolicy>> {
    // Map frontend SLAPolicy field names to backend schema field names
    return post('/sla/policies', {
      name:                    data.name,
      serviceType:             data.serviceType,
      carrierId:               (data as any).carrierId,
      originZoneType:          data.originZoneType,
      destinationZoneType:     data.destinationZoneType,
      deliveryHours:           data.targetDeliveryHours,
      pickupHours:             (data as any).pickupHours ?? 4,
      penaltyPerHour:          data.penaltyAmount,
      maxPenaltyAmount:        data.maxPenaltyAmount,
      penaltyType:             data.penaltyType,
      warningThresholdPercent: data.warningThresholdPercent,
      isActive:                data.isActive,
      priority:                data.priority,
    });
  },

  async updateSLAPolicy(id: string, data: Partial<Omit<SLAPolicy, 'id' | 'createdAt' | 'region' | 'warningThresholdHours' | 'carrierName'>>): Promise<ApiResponse<SLAPolicy>> {
    return put(`/sla/policies/${id}`, data);
  },

  async deactivateSLAPolicy(id: string): Promise<ApiResponse<{ message: string }>> {
    return del(`/sla/policies/${id}`);
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

// ==================== SETTINGS ====================
export const settingsApi = {
  async updateProfile(data: { name?: string; phone?: string; email?: string }): Promise<ApiResponse<User>> {
    return patch('/settings/profile', data);
  },

  async changePassword(data: { current_password: string; new_password: string }): Promise<ApiResponse<null>> {
    return post('/settings/password', data);
  },

  async getNotificationPreferences(): Promise<ApiResponse<Record<string, boolean>>> {
    return get('/settings/notifications');
  },

  async updateNotificationPreferences(prefs: Record<string, boolean>): Promise<ApiResponse<null>> {
    return patch('/settings/notifications', prefs);
  },

  async getActiveSessions(): Promise<ApiResponse<Array<{ id: string; device: string; ip: string; lastActive: string; current: boolean }>>> {
    return get('/settings/sessions');
  },

  async revokeSession(sessionId: string): Promise<ApiResponse<null>> {
    return del(`/settings/sessions/${sessionId}`);
  },

  async revokeAllSessions(): Promise<ApiResponse<null>> {
    return del('/settings/sessions');
  },
};

// ==================== FINANCE ====================
export const financeApi = {
  async getSummary(range = 'month'): Promise<ApiResponse<{
    invoices: { total: number; outstanding: number; paid: number; total_amount: number; outstanding_amount: number };
    refunds: { total: number; processed: number; pending: number; total_amount: number };
    disputes: { total: number; open: number; resolved: number };
  }>> {
    return get('/finance/summary', { range });
  },

  async getInvoices(page = 1, limit = 20, filters?: Record<string, unknown>): Promise<{
    data: any[];
    pagination: { page: number; limit: number; total: number };
  }> {
    return get('/finance/invoices', { page, limit, ...filters });
  },

  async getRefunds(page = 1, limit = 20, filters?: Record<string, unknown>): Promise<{
    data: any[];
    pagination: { page: number; limit: number; total: number };
  }> {
    return get('/finance/refunds', { page, limit, ...filters });
  },

  async getDisputes(page = 1, limit = 20): Promise<{
    data: any[];
    pagination: { page: number; limit: number; total: number };
  }> {
    return get('/finance/disputes', { page, limit });
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

// Cached warehouse activity from latest getDashboardStats call
let _warehouseActivityCache: Record<string, { inbound: number; outbound: number }> = {};
// Cached order trend from latest getDashboardStats call
let _ordersTrendCache: ChartDataPoint[] = [];
// Cached topProducts from latest getDashboardStats call
let _topProductsCache: Array<{ name: string; sku: string; unitsSold: number; revenue: number }> = [];

export const dashboardApi = {
  async getDashboardStats(period = '30d'): Promise<ApiResponse<DashboardMetrics>> {
    const response = await get<{ success: boolean; data: {
      orders?: { total: number; totalValue: number; pending: number; processing: number; shipped: number; delivered: number; cancelled: number; returned: number; change: number; revenueChange: number };
      shipments?: { inTransit: number; onTimeRate: number; total: number; delivered: number; avgDeliveryDays: number; change: number; onTimeRateChange: number; avgDeliveryChange: number };
      returns?: { pending: number; change: number };
      exceptions?: { active: number; change: number };
      ordersTrend?: Array<{ date: string; count: number; value: number }>;
      warehouseActivity?: Record<string, { inbound: number; outbound: number }>;
      topProducts?: Array<{ name: string; sku: string; unitsSold: number; revenue: number }>;
    } }>('/dashboard/stats', { period });
    const data = response.data || {};

    // Cache warehouse activity and orders trend for other APIs to use
    _warehouseActivityCache = data.warehouseActivity || {};
    _ordersTrendCache = (data.ordersTrend || []).map(r => ({ date: r.date, value: r.count }));
    _topProductsCache = data.topProducts || [];

    return {
      data: {
        totalOrders: data.orders?.total || 0,
        ordersChange: data.orders?.change ?? 0,
        activeShipments: data.shipments?.inTransit || 0,
        shipmentsChange: data.shipments?.change ?? 0,
        deliveryRate: data.shipments?.onTimeRate || 0,
        deliveryRateChange: data.shipments?.onTimeRateChange ?? 0,
        slaCompliance: data.shipments?.onTimeRate || 0,
        slaComplianceChange: data.shipments?.onTimeRateChange ?? 0,
        pendingReturns: data.returns?.pending || 0,
        returnsChange: data.returns?.change ?? 0,
        activeExceptions: data.exceptions?.active || 0,
        exceptionsChange: data.exceptions?.change ?? 0,
        revenue: data.orders?.totalValue || 0,
        revenueChange: data.orders?.revenueChange ?? 0,
        avgDeliveryTime: data.shipments?.avgDeliveryDays || 0,
        avgDeliveryTimeChange: data.shipments?.avgDeliveryChange ?? 0,
        // Extended data for richer dashboard
        ordersPending: data.orders?.pending || 0,
        ordersProcessing: data.orders?.processing || 0,
        ordersShipped: data.orders?.shipped || 0,
        ordersDelivered: data.orders?.delivered || 0,
        ordersCancelled: data.orders?.cancelled || 0,
        ordersReturned: data.orders?.returned || 0,
      } as DashboardMetrics,
      success: true,
    };
  },

  /** Returns cached orders trend from last getDashboardStats call */
  async getOrdersChart(_days = 30): Promise<ApiResponse<ChartDataPoint[]>> {
    return { data: _ordersTrendCache, success: true };
  },

  /** Returns cached top products from last getDashboardStats call */
  getTopProducts(): Array<{ name: string; sku: string; unitsSold: number; revenue: number }> {
    return _topProductsCache;
  },

  async getAnalytics(period = '30d'): Promise<ApiResponse<{
    ordersOverTime: ChartDataPoint[];
    shipmentsByCarrier: unknown[];
    topProducts: unknown[];
    warehouseUtilization: WarehouseUtilization[];
  }>> {
    const rangeMap: Record<string, string> = { '7d': 'week', '30d': 'month', '90d': 'month', '1y': 'year' };
    const range = rangeMap[period] || 'month';
    const response = await get<{ success: boolean; data: unknown }>('/analytics', { range });
    return { data: response.data as never, success: true };
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
      capacity: wh.capacity || 0,
      used: wh.currentUtilization || 0,
      utilizationRate: Number(wh.utilizationPercentage) || 0,
      inboundToday: _warehouseActivityCache[wh.id]?.inbound ?? 0,
      outboundToday: _warehouseActivityCache[wh.id]?.outbound ?? 0,
    }));
    return { data: utilization, success: true };
  },
};

// ==================== NOTIFICATIONS ====================
export const notificationsApi = {
  async getNotifications(filters?: { page?: number; limit?: number; isRead?: boolean; type?: string }): Promise<ApiResponse<Notification[]> & { pagination?: { unreadCount: number; totalCount: number; page: number; limit: number; totalPages: number } }> {
    const response = await get<{ success: boolean; data: any[]; pagination: any }>('/notifications', filters as Record<string, unknown>);
    const notifications: Notification[] = (response.data || []).map((n: any) => ({
      id: n.id,
      type: n.type || 'system',
      title: n.title,
      message: n.message,
      isRead: n.is_read ?? n.isRead ?? false,
      actionUrl: n.link || n.actionUrl,
      createdAt: n.created_at || n.createdAt,
    }));
    return { data: notifications, success: true, pagination: response.pagination };
  },

  async getUnreadCount(): Promise<ApiResponse<{ unreadCount: number }>> {
    return get('/notifications/unread-count');
  },

  async markNotificationRead(id: string): Promise<ApiResponse<null>> {
    return patch(`/notifications/${id}/read`, {});
  },

  async markAllNotificationsRead(): Promise<ApiResponse<null>> {
    return patch('/notifications/read-all', {});
  },

  async deleteNotification(id: string): Promise<ApiResponse<null>> {
    return del(`/notifications/${id}`);
  },
};

// ==================== SALES CHANNELS ====================
export const channelsApi = {
  async getChannels(filters?: Record<string, unknown>): Promise<PaginatedResponse<any>> {
    const response = await get<{ success: boolean; data: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      '/channels', filters
    );
    return {
      data: response.data,
      total: response.pagination?.total || 0,
      page: response.pagination?.page || 1,
      pageSize: response.pagination?.limit || 50,
      totalPages: response.pagination?.totalPages || 1,
    };
  },

  async getChannel(id: string): Promise<ApiResponse<any>> {
    return get(`/channels/${id}`);
  },

  async createChannel(data: Record<string, unknown>): Promise<ApiResponse<any>> {
    return post('/channels', data);
  },

  async updateChannel(id: string, data: Record<string, unknown>): Promise<ApiResponse<any>> {
    return put(`/channels/${id}`, data);
  },

  async deleteChannel(id: string): Promise<ApiResponse<void>> {
    return del(`/channels/${id}`);
  },
};

// ==================== SUPPLIERS ====================
export const suppliersApi = {
  async getSuppliers(filters?: Record<string, unknown>): Promise<PaginatedResponse<any>> {
    const response = await get<{ success: boolean; data: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      '/suppliers', filters
    );
    return {
      data: response.data,
      total: response.pagination?.total || 0,
      page: response.pagination?.page || 1,
      pageSize: response.pagination?.limit || 50,
      totalPages: response.pagination?.totalPages || 1,
    };
  },

  async getSupplier(id: string): Promise<ApiResponse<any>> {
    return get(`/suppliers/${id}`);
  },

  async createSupplier(data: Record<string, unknown>): Promise<ApiResponse<any>> {
    return post('/suppliers', data);
  },

  async updateSupplier(id: string, data: Record<string, unknown>): Promise<ApiResponse<any>> {
    return put(`/suppliers/${id}`, data);
  },

  async deleteSupplier(id: string): Promise<ApiResponse<void>> {
    return del(`/suppliers/${id}`);
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
  getSLADashboard: slaApi.getSLADashboard,

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

// ==================== SUPERADMIN ====================
export const superAdminApi = {
  async getGlobalStats(): Promise<ApiResponse<{
    totalCompanies: number;
    activeCompanies: number;
    totalUsers: number;
    totalOrders: number;
    activeShipments: number;
    totalRevenue: number;
    avgSlaCompliance: number;
    systemHealth: number;
  }>> {
    return get('/super-admin/stats');
  },

  async getCompanies(): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    code: string;
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      country: string;
      postalCode: string;
    };
    admins: number;
    users: number;
    orders: number;
    revenue: number;
    status: 'active' | 'inactive' | 'suspended';
    createdAt: string;
    updatedAt: string;
  }>>> {
    return get('/companies');
  },

  async getCompanyById(id: string): Promise<ApiResponse<{
    id: string;
    name: string;
    code: string;
    email: string;
    phone: string;
    address: object;
    admins: number;
    users: number;
    orders: number;
    revenue: number;
    createdAt: string;
    updatedAt: string;
  }>> {
    return get(`/companies/${id}`);
  },

  async createCompany(data: {
    name: string;
    code: string;
    email: string;
    phone: string;
    website?: string;
    address: {
      street: string;
      city: string;
      state: string;
      country?: string;
      postalCode: string;
    };
  }): Promise<ApiResponse<object>> {
    return post('/companies', data);
  },

  async updateCompany(id: string, data: Partial<{
    name: string;
    email: string;
    phone: string;
    website: string;
    address: object;
  }>): Promise<ApiResponse<object>> {
    return patch(`/companies/${id}`, data);
  },

  async getCompanyUsers(id: string): Promise<ApiResponse<User[]>> {
    return get(`/companies/${id}/users`);
  },
};

export default realApi;
