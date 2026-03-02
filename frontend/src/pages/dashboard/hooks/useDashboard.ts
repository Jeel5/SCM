import { useEffect, useState, useCallback } from 'react';
import { dashboardApi, shipmentsApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import { useSocketEvent } from '@/hooks/useSocket';
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
  const { useRealApi } = useApiMode();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (useRealApi) {
        // getDashboardStats now returns ordersTrend + warehouseActivity in a single call
        // so getOrdersChart and getWarehouseUtilization can read from cache
        const [metricsRes, shipmentsRes, carrierRes, warehouseRes] = await Promise.all([
          dashboardApi.getDashboardStats(period),
          shipmentsApi.getShipments(1, 10),
          dashboardApi.getCarrierPerformance(),
          dashboardApi.getWarehouseUtilization(),
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
          mockApi.getCarrierPerformance(),
          mockApi.getWarehouseUtilization(),
        ]);
        
        setMetrics(metricsRes.data);
        setOrdersChart(chartRes.data);
        setShipments(shipmentsRes.data);
        setCarrierPerformance(carrierRes.data);
        setWarehouseUtilization(warehouseRes.data);
        setTopProducts([]);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
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
  }, [useRealApi, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh dashboard on any real-time event that changes key metrics
  useSocketEvent('order:created', fetchData);
  useSocketEvent('order:updated', fetchData);
  useSocketEvent('shipment:created', fetchData);
  useSocketEvent('shipment:updated', fetchData);
  useSocketEvent('exception:created', fetchData);
  useSocketEvent('exception:resolved', fetchData);
  useSocketEvent('return:created', fetchData);
  useSocketEvent('inventory:low_stock', fetchData);

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
    refetch: fetchData,
  };
}
