import { useEffect, useState, useCallback, useRef } from 'react';
import { dashboardApi, shipmentsApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import { useSocketEvent } from '@/hooks/useSocket';
import { useAuthStore } from '@/stores';
import { checkPermission } from '@/lib/permissions';
import { notifyLoadError } from '@/lib/apiErrors';
import type { DashboardMetrics, ChartDataPoint, Shipment, CarrierPerformance, WarehouseUtilization } from '@/types';

export type DashboardPeriod = '1d' | '7d' | '30d' | '90d' | '365d';

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  '1d': 'Today',
  '7d': '7 Days',
  '30d': '30 Days',
  '90d': '90 Days',
  '365d': '1 Year',
};

export function useDashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>('30d');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [ordersChart, setOrdersChart] = useState<ChartDataPoint[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [carrierPerformance, setCarrierPerformance] = useState<CarrierPerformance[]>([]);
  const [warehouseUtilization, setWarehouseUtilization] = useState<WarehouseUtilization[]>([]);
  const [topProducts, setTopProducts] = useState<Array<{ name: string; sku: string; unitsSold: number; revenue: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { useRealApi } = useApiMode();
  const isSoftRefresh = useRef(false);

  const currentUser = useAuthStore((s) => s.user);
  const canViewCarriers = checkPermission(currentUser?.role, 'carriers.view');
  const canViewWarehouses = checkPermission(currentUser?.role, 'warehouses.view');

  const fetchData = useCallback(async () => {
    const isSoft = isSoftRefresh.current;
    isSoftRefresh.current = false;
    if (!isSoft) setIsLoading(true);
    try {
      if (useRealApi) {
        // getDashboardStats now returns ordersTrend + warehouseActivity in a single call
        // so getOrdersChart and getWarehouseUtilization can read from cache
        // Fetch dashboard stats first because getWarehouseUtilization depends on
        // cached warehouse activity populated by getDashboardStats.
        const metricsRes = await dashboardApi.getDashboardStats(period);

        const [shipmentsRes, carrierRes, warehouseRes] = await Promise.all([
          shipmentsApi.getShipments(1, 10),
          canViewCarriers ? dashboardApi.getCarrierPerformance() : Promise.resolve({ data: [] }),
          canViewWarehouses ? dashboardApi.getWarehouseUtilization() : Promise.resolve({ data: [] }),
        ]);
        
        setMetrics(metricsRes.data);
        // Orders chart data is now cached from the stats call
        const chartRes = await dashboardApi.getOrdersChart();
        setOrdersChart(chartRes.data);
        setShipments(shipmentsRes.data || []);
        setCarrierPerformance(carrierRes.data || []);
        setWarehouseUtilization(warehouseRes.data || []);
        setTopProducts(dashboardApi.getTopProducts());
      } else {
        const [metricsRes, chartRes, shipmentsRes, carrierRes, warehouseRes] = await Promise.all([
          mockApi.getDashboardMetrics(),
          mockApi.getOrdersChart(30),
          mockApi.getShipments(1, 10),
          canViewCarriers ? mockApi.getCarrierPerformance() : Promise.resolve({ data: [] }),
          canViewWarehouses ? mockApi.getWarehouseUtilization() : Promise.resolve({ data: [] }),
        ]);
        
        setMetrics(metricsRes.data);
        setOrdersChart(chartRes.data);
        setShipments(shipmentsRes.data);
        setCarrierPerformance(carrierRes.data);
        setWarehouseUtilization(warehouseRes.data);
        setTopProducts([]);
      }
    } catch (error) {
      if (!isSoft) notifyLoadError('dashboard data', error);
      if (useRealApi) {
        setMetrics(null);
        setOrdersChart([]);
        setShipments([]);
        setCarrierPerformance([]);
        setWarehouseUtilization([]);
        setTopProducts([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [useRealApi, period, canViewCarriers, canViewWarehouses]);

  const refetch = useCallback((soft = false) => {
    if (soft) isSoftRefresh.current = true;
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Refresh dashboard on any real-time event that changes key metrics
  useSocketEvent('order:created', () => refetch(true));
  useSocketEvent('order:updated', () => refetch(true));
  useSocketEvent('shipment:created', () => refetch(true));
  useSocketEvent('shipment:updated', () => refetch(true));
  useSocketEvent('exception:created', () => refetch(true));
  useSocketEvent('exception:resolved', () => refetch(true));
  useSocketEvent('return:created', () => refetch(true));
  useSocketEvent('inventory:low_stock', () => refetch(true));

  return {
    metrics,
    ordersChart,
    shipments,
    carrierPerformance,
    warehouseUtilization,
    topProducts,
    isLoading,
    period,
    setPeriod,
    periodLabels: PERIOD_LABELS,
    refetch,
  };
}
