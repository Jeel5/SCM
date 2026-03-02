import { useCallback, useEffect, useState } from 'react';
import { dashboardApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';

// ── Rich interfaces to match ALL backend data ──────────────────────────

export interface OrderTrendData {
  date: string;
  orders: number;
  revenue: number;
  delivered: number;
  inTransit: number;
  pending: number;
}

export interface CarrierData {
  name: string;
  carrierId: string;
  totalShipments: number;
  delivered: number;
  onTimeRate: number;
  avgDelayHours: number;
  totalCost: number;
}

export interface WarehouseData {
  name: string;
  code: string;
  capacity: number;
  currentStock: number;
  utilization: number;
  shipmentsProcessed: number;
  ordersFulfilled: number;
}

export interface DeliveryPerformanceData {
  name: string;
  value: number;
}

export interface TopProduct {
  name: string;
  sku: string;
  category: string;
  unitsSold: number;
  revenue: number;
  orderCount: number;
}

export interface SLAViolationPoint {
  date: string;
  violations: number;
  totalPenalties: number;
}

export interface ExceptionTypeData {
  type: string;
  severity: string;
  count: number;
  resolved: number;
  avgResolutionHours: number;
}

export interface ReturnsAnalysis {
  totalReturns: number;
  refunded: number;
  totalRefundAmount: number;
  avgRefundAmount: number;
  qualityPassed: number;
  qualityFailed: number;
}

export interface FinancialMetrics {
  totalRevenue: number;
  totalShippingCost: number;
  totalPenalties: number;
  totalRefunds: number;
  totalOrders: number;
  avgOrderValue: number;
}

export interface KPIData {
  totalOrders: number;
  ordersChange: number;
  totalRevenue: number;
  revenueChange: number;
  activeShipments: number;
  shipmentsChange: number;
  avgDeliveryTime: number;
  deliveryTimeChange: number;
}

const defaultKPI: KPIData = {
  totalOrders: 0, ordersChange: 0,
  totalRevenue: 0, revenueChange: 0,
  activeShipments: 0, shipmentsChange: 0,
  avgDeliveryTime: 0, deliveryTimeChange: 0,
};

const defaultReturns: ReturnsAnalysis = {
  totalReturns: 0, refunded: 0, totalRefundAmount: 0, avgRefundAmount: 0,
  qualityPassed: 0, qualityFailed: 0,
};

const defaultFinancial: FinancialMetrics = {
  totalRevenue: 0, totalShippingCost: 0, totalPenalties: 0, totalRefunds: 0,
  totalOrders: 0, avgOrderValue: 0,
};

export function useAnalytics(timeRange: string) {
  const [orderTrendData, setOrderTrendData] = useState<OrderTrendData[]>([]);
  const [carrierData, setCarrierData] = useState<CarrierData[]>([]);
  const [warehouseData, setWarehouseData] = useState<WarehouseData[]>([]);
  const [deliveryPerformance, setDeliveryPerformance] = useState<DeliveryPerformanceData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [slaViolations, setSlaViolations] = useState<SLAViolationPoint[]>([]);
  const [exceptionsByType, setExceptionsByType] = useState<ExceptionTypeData[]>([]);
  const [returnsAnalysis, setReturnsAnalysis] = useState<ReturnsAnalysis>(defaultReturns);
  const [financialMetrics, setFinancialMetrics] = useState<FinancialMetrics>(defaultFinancial);
  const [kpiData, setKpiData] = useState<KPIData>(defaultKPI);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { useMockApi } = useApiMode();

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);

      try {
        if (useMockApi) {
          const [metricsRes, ordersRes, carrierRes, warehouseRes] = await Promise.all([
            mockApi.getDashboardMetrics(),
            mockApi.getOrdersChart(parseInt(timeRange) || 30),
            mockApi.getCarrierPerformance(),
            mockApi.getWarehouseUtilization(),
          ]);

          setKpiData({
            totalOrders: metricsRes.data.totalOrders || 0,
            ordersChange: metricsRes.data.ordersChange || 0,
            totalRevenue: metricsRes.data.revenue || 0,
            revenueChange: metricsRes.data.revenueChange || 0,
            activeShipments: metricsRes.data.activeShipments || 0,
            shipmentsChange: metricsRes.data.shipmentsChange || 0,
            avgDeliveryTime: metricsRes.data.avgDeliveryTime || 0,
            deliveryTimeChange: metricsRes.data.avgDeliveryTimeChange || 0,
          });

          const onTimeRate = metricsRes.data.deliveryRate || 85;
          setDeliveryPerformance([
            { name: 'On Time', value: onTimeRate },
            { name: 'Late', value: Math.max(0, 100 - onTimeRate - 5) },
            { name: 'Early', value: 5 },
          ]);

          setOrderTrendData(
            ordersRes.data.map((item: Record<string, unknown>) => ({
              date: String(item.date || ''),
              orders: Number(item.value || item.count || 0),
              revenue: Number(item.value || 0),
              delivered: 0, inTransit: 0, pending: 0,
            }))
          );

          setCarrierData(
            carrierRes.data.map((c: Record<string, unknown>) => ({
              name: String(c.carrierName || c.carrier || c.name || ''),
              carrierId: String(c.carrierId || ''),
              totalShipments: Number(c.totalShipments || 0),
              delivered: Number(c.delivered || 0),
              onTimeRate: Number(c.onTimeRate || 0),
              avgDelayHours: Number(c.avgDelayHours || 0),
              totalCost: Number(c.totalCost || 0),
            }))
          );

          setWarehouseData(
            warehouseRes.data.map((w: Record<string, unknown>) => ({
              name: String(w.warehouseName || w.name || ''),
              code: String(w.code || ''),
              capacity: Number(w.capacity || 0),
              currentStock: Number(w.currentStock || 0),
              utilization: Number(w.utilizationRate || w.utilization || 0),
              shipmentsProcessed: Number(w.shipmentsProcessed || 0),
              ordersFulfilled: Number(w.ordersFulfilled || 0),
            }))
          );
        } else {
          // ── Real API path ─────────────────────────────────────
          const analyticsRes = await dashboardApi.getAnalytics(timeRange);
          const data = (analyticsRes.data || {}) as Record<string, unknown>;

          // 1. Orders over time
          const rawOrders = (data.ordersOverTime as Record<string, unknown>[]) || [];
          const orders: OrderTrendData[] = rawOrders.map((item) => ({
            date: String(item.date || ''),
            orders: Number(item.count) || 0,
            revenue: Number(item.value) || 0,
            delivered: Number(item.delivered) || 0,
            inTransit: Number(item.inTransit || item.in_transit) || 0,
            pending: Number(item.pending) || 0,
          }));
          setOrderTrendData(orders);

          // 2. Shipments by carrier
          const rawCarriers = (data.shipmentsByCarrier as Record<string, unknown>[]) || [];
          const carriers: CarrierData[] = rawCarriers.map((c) => ({
            name: String(c.carrier || ''),
            carrierId: String(c.carrierId || c.carrier_id || ''),
            totalShipments: Number(c.totalShipments || c.total_shipments) || 0,
            delivered: Number(c.delivered) || 0,
            onTimeRate: Number(c.onTimeRate || c.on_time_rate) || 0,
            avgDelayHours: Number(c.avgDelayHours || c.avg_delay_hours) || 0,
            totalCost: Number(c.totalCost || c.total_cost) || 0,
          }));
          setCarrierData(carriers);

          // 3. Warehouse utilization
          const rawWarehouses = (data.warehouseUtilization as Record<string, unknown>[]) || [];
          const warehouses: WarehouseData[] = rawWarehouses.map((w) => ({
            name: String(w.name || ''),
            code: String(w.code || ''),
            capacity: Number(w.capacity) || 0,
            currentStock: Number(w.currentStock || w.current_stock) || 0,
            utilization: Number(w.utilization) || 0,
            shipmentsProcessed: Number(w.shipmentsProcessed || w.shipments_processed) || 0,
            ordersFulfilled: Number(w.ordersFulfilled || w.orders_fulfilled) || 0,
          }));
          setWarehouseData(warehouses);

          // 4. Top products
          const rawProducts = (data.topProducts as Record<string, unknown>[]) || [];
          setTopProducts(rawProducts.map((p) => ({
            name: String(p.name || ''),
            sku: String(p.sku || ''),
            category: String(p.category || ''),
            unitsSold: Number(p.unitsSold || p.units_sold) || 0,
            revenue: Number(p.revenue) || 0,
            orderCount: Number(p.orderCount || p.order_count) || 0,
          })));

          // 5. SLA violations time series
          const rawSLA = (data.slaViolations as Record<string, unknown>[]) || [];
          setSlaViolations(rawSLA.map((s) => ({
            date: String(s.date || ''),
            violations: Number(s.violations) || 0,
            totalPenalties: Number(s.totalPenalties || s.total_penalties) || 0,
          })));

          // 6. Exceptions by type
          const rawExceptions = (data.exceptionsByType as Record<string, unknown>[]) || [];
          setExceptionsByType(rawExceptions.map((e) => ({
            type: String(e.type || ''),
            severity: String(e.severity || ''),
            count: Number(e.count) || 0,
            resolved: Number(e.resolved) || 0,
            avgResolutionHours: Number(e.avgResolutionHours || e.avg_resolution_hours) || 0,
          })));

          // 7. Returns analysis
          const rawReturns = (data.returnsAnalysis as Record<string, unknown>) || {};
          setReturnsAnalysis({
            totalReturns: Number(rawReturns.totalReturns || rawReturns.total_returns) || 0,
            refunded: Number(rawReturns.refunded) || 0,
            totalRefundAmount: Number(rawReturns.totalRefundAmount || rawReturns.total_refund_amount) || 0,
            avgRefundAmount: Number(rawReturns.avgRefundAmount || rawReturns.avg_refund_amount) || 0,
            qualityPassed: Number(rawReturns.qualityPassed || rawReturns.quality_passed) || 0,
            qualityFailed: Number(rawReturns.qualityFailed || rawReturns.quality_failed) || 0,
          });

          // 8. Financial metrics
          const rawFinancial = (data.financialMetrics as Record<string, unknown>) || {};
          const financial: FinancialMetrics = {
            totalRevenue: Number(rawFinancial.totalRevenue || rawFinancial.total_revenue) || 0,
            totalShippingCost: Number(rawFinancial.totalShippingCost || rawFinancial.total_shipping_cost) || 0,
            totalPenalties: Number(rawFinancial.totalPenalties || rawFinancial.total_penalties) || 0,
            totalRefunds: Number(rawFinancial.totalRefunds || rawFinancial.total_refunds) || 0,
            totalOrders: Number(rawFinancial.totalOrders || rawFinancial.total_orders) || 0,
            avgOrderValue: Number(rawFinancial.avgOrderValue || rawFinancial.avg_order_value) || 0,
          };
          setFinancialMetrics(financial);

          // ── Compute KPIs from real data ──────────────────────
          const totalOrders = financial.totalOrders || orders.reduce((s, i) => s + i.orders, 0);
          const totalRevenue = financial.totalRevenue || orders.reduce((s, i) => s + i.revenue, 0);
          const totalShipments = carriers.reduce((s, c) => s + c.totalShipments, 0);

          // Weighted avg on-time rate
          const weightedOnTime = totalShipments > 0
            ? carriers.reduce((s, c) => s + c.onTimeRate * c.totalShipments, 0) / totalShipments
            : 0;

          // Avg delay in days
          const avgDelay = carriers.length > 0
            ? carriers.reduce((s, c) => s + c.avgDelayHours, 0) / carriers.length / 24
            : 0;

          setKpiData({
            totalOrders,
            ordersChange: 0,
            totalRevenue,
            revenueChange: 0,
            activeShipments: totalShipments,
            shipmentsChange: 0,
            avgDeliveryTime: Math.round(avgDelay * 10) / 10,
            deliveryTimeChange: 0,
          });

          // Delivery performance from actual weighted on-time rate
          const onTime = Math.round(weightedOnTime * 10) / 10;
          const late = Math.round(Math.max(0, 100 - onTime) * 10) / 10;
          setDeliveryPerformance([
            { name: 'On Time', value: onTime },
            { name: 'Late', value: late },
          ]);
        }
      } catch (error) {
        console.error('Failed to load analytics:', error);
        setOrderTrendData([]);
        setCarrierData([]);
        setWarehouseData([]);
        setTopProducts([]);
        setSlaViolations([]);
        setExceptionsByType([]);
        setReturnsAnalysis(defaultReturns);
        setFinancialMetrics(defaultFinancial);
        setKpiData(defaultKPI);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [timeRange, useMockApi, refreshKey]);

  return {
    orderTrendData,
    carrierData,
    warehouseData,
    deliveryPerformance,
    topProducts,
    slaViolations,
    exceptionsByType,
    returnsAnalysis,
    financialMetrics,
    kpiData,
    isLoading,
    refetch,
  };
}
