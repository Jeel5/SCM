import { useEffect, useState } from 'react';
import { dashboardApi } from '@/api/services';
import { mockApi } from '@/api/mockData';

interface OrderTrendData {
  date: string;
  orders: number;
  revenue: number;
}

interface CarrierData {
  name: string;
  count: number;
}

interface WarehouseData {
  name: string;
  utilization: number;
}

interface DeliveryPerformanceData {
  name: string;
  value: number;
  [key: string]: string | number;
}

interface KPIData {
  totalOrders: number;
  ordersChange: number;
  totalRevenue: number;
  revenueChange: number;
  activeShipments: number;
  shipmentsChange: number;
  avgDeliveryTime: number;
  deliveryTimeChange: number;
}

export function useAnalytics(timeRange: string) {
  const [orderTrendData, setOrderTrendData] = useState<OrderTrendData[]>([]);
  const [carrierData, setCarrierData] = useState<CarrierData[]>([]);
  const [warehouseData, setWarehouseData] = useState<WarehouseData[]>([]);
  const [deliveryPerformance, setDeliveryPerformance] = useState<DeliveryPerformanceData[]>([
    { name: 'On Time', value: 85 },
    { name: 'Late', value: 10 },
    { name: 'Early', value: 5 },
  ]);
  const [kpiData, setKpiData] = useState<KPIData>({
    totalOrders: 0,
    ordersChange: 0,
    totalRevenue: 0,
    revenueChange: 0,
    activeShipments: 0,
    shipmentsChange: 0,
    avgDeliveryTime: 0,
    deliveryTimeChange: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const useMock = localStorage.getItem('useMockApi') === 'true';

      try {
        if (useMock) {
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
            ordersRes.data.map((item: unknown) => {
              const itemRecord = item as Record<string, unknown>;
              return {
                date: String(itemRecord.date || ''),
                orders: 'value' in itemRecord ? Number(itemRecord.value) || 0 : Number(itemRecord.count) || 0,
                revenue: 'value' in itemRecord ? Number(itemRecord.value) || 0 : 0,
              };
            })
          );

          setCarrierData(
            carrierRes.data.map((c: unknown) => {
              const carrierRecord = c as Record<string, unknown>;
              return {
                name: String(carrierRecord.carrierName || carrierRecord.carrier || carrierRecord.name || ''),
                count: Number(carrierRecord.totalShipments || carrierRecord.onTimeRate || 0),
              };
            })
          );

          setWarehouseData(
            warehouseRes.data.map((w: unknown) => {
              const warehouseRecord = w as Record<string, unknown>;
              return {
                name: String(warehouseRecord.warehouseName || warehouseRecord.name || ''),
                utilization: Number(warehouseRecord.utilizationRate || warehouseRecord.utilization || 0),
              };
            })
          );
        } else {
          const analyticsRes = await dashboardApi.getAnalytics(timeRange);
          const data = analyticsRes.data || {};

          const orders = (data.ordersOverTime || []).map((item: unknown) => {
            const itemRecord = item as Record<string, unknown>;
            return {
              date: String(itemRecord.date || ''),
              orders: Number(itemRecord.count) || 0,
              revenue: Number(itemRecord.value) || 0,
            };
          });
          setOrderTrendData(orders);

          const totalOrders = orders.reduce((sum, item) => sum + (item.orders || 0), 0);
          const totalRevenue = orders.reduce((sum, item) => sum + (item.revenue || 0), 0);
          const carrier = (data.shipmentsByCarrier || []).map((c: unknown) => {
            const carrierRecord = c as Record<string, unknown>;
            return { name: String(carrierRecord.carrier || ''), count: Number(carrierRecord.count) || 0 };
          });
          setCarrierData(carrier);

          const warehouse = (data.warehouseUtilization || []).map((w: unknown) => {
            const warehouseRecord = w as Record<string, unknown>;
            return {
              name: String(warehouseRecord.name || ''),
              utilization: Number(warehouseRecord.utilization) || (warehouseRecord.capacity ? Math.round(((Number(warehouseRecord.currentStock) || 0) / Number(warehouseRecord.capacity)) * 100) : 0),
            };
          });
          setWarehouseData(warehouse);

          setKpiData({
            totalOrders,
            ordersChange: 0,
            totalRevenue,
            revenueChange: 0,
            activeShipments: carrier.reduce((sum, c) => sum + (c.count || 0), 0),
            shipmentsChange: 0,
            avgDeliveryTime: 0,
            deliveryTimeChange: 0,
          });

          const onTimeRate = 85;
          setDeliveryPerformance([
            { name: 'On Time', value: onTimeRate },
            { name: 'Late', value: Math.max(0, 100 - onTimeRate - 5) },
            { name: 'Early', value: 5 },
          ]);
        }
      } catch (error) {
        console.error('Failed to load analytics:', error);
        setOrderTrendData([]);
        setCarrierData([]);
        setWarehouseData([]);
        setKpiData({
          totalOrders: 0,
          ordersChange: 0,
          totalRevenue: 0,
          revenueChange: 0,
          activeShipments: 0,
          shipmentsChange: 0,
          avgDeliveryTime: 0,
          deliveryTimeChange: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  return {
    orderTrendData,
    carrierData,
    warehouseData,
    deliveryPerformance,
    kpiData,
    isLoading,
  };
}
