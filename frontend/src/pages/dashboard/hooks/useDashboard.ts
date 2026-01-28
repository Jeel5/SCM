import { useEffect, useState } from 'react';
import { dashboardApi, shipmentsApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import type { DashboardMetrics, ChartDataPoint, Shipment, CarrierPerformance, WarehouseUtilization } from '@/types';

export function useDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [ordersChart, setOrdersChart] = useState<ChartDataPoint[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [carrierPerformance, setCarrierPerformance] = useState<CarrierPerformance[]>([]);
  const [warehouseUtilization, setWarehouseUtilization] = useState<WarehouseUtilization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { useRealApi } = useApiMode();

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (useRealApi) {
          // Fetch from real API
          const [metricsRes, chartRes, shipmentsRes, carrierRes, warehouseRes] = await Promise.all([
            dashboardApi.getDashboardStats(),
            dashboardApi.getOrdersChart(30),
            shipmentsApi.getShipments(1, 10),
            dashboardApi.getCarrierPerformance(),
            dashboardApi.getWarehouseUtilization(),
          ]);
          
          setMetrics(metricsRes.data);
          setOrdersChart(chartRes.data);
          setShipments(shipmentsRes.data || []);
          setCarrierPerformance(carrierRes.data || []);
          setWarehouseUtilization(warehouseRes.data || []);
        } else {
          // Use mock API for demo mode
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
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        // Don't fallback to mock if using real API - just show empty state
        if (useRealApi) {
          setMetrics(null);
          setOrdersChart([]);
          setShipments([]);
          setCarrierPerformance([]);
          setWarehouseUtilization([]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [useRealApi]);

  return {
    metrics,
    ordersChart,
    shipments,
    carrierPerformance,
    warehouseUtilization,
    isLoading,
  };
}
