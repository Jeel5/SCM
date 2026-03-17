import { useState, useEffect, useCallback, useRef } from 'react';
import { shipmentsApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import { useSocketEvent } from '@/hooks/useSocket';
import { notifyLoadError } from '@/lib/apiErrors';
import type { Shipment } from '@/types';

export function useShipments(page: number, pageSize: number) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [totalShipments, setTotalShipments] = useState(0);
  const [stats, setStats] = useState({
    totalShipments: 0,
    inTransit: 0,
    outForDelivery: 0,
    delivered: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { useMockApi } = useApiMode();

  const isSoftRefresh = useRef(false);
  const refetch = useCallback(() => {
    isSoftRefresh.current = true;
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const isSoft = isSoftRefresh.current;
    isSoftRefresh.current = false;
    const fetchShipments = async () => {
      if (!isSoft) setIsLoading(true);
      try {
        const response = useMockApi
          ? await mockApi.getShipments(page, pageSize)
          : await shipmentsApi.getShipments(page, pageSize);
        setShipments(response.data);
        setTotalShipments(response.total);
        const fallback = {
          totalShipments: response.total,
          inTransit: response.data.filter((s) => s.status === 'in_transit').length,
          outForDelivery: response.data.filter((s) => s.status === 'out_for_delivery').length,
          delivered: response.data.filter((s) => s.status === 'delivered').length,
        };
        const responseWithStats = response as typeof response & { stats?: typeof fallback };
        setStats(responseWithStats.stats ?? fallback);
      } catch (error) {
        if (!isSoft) notifyLoadError('shipments', error);
        setShipments([]);
        setTotalShipments(0);
        setStats({ totalShipments: 0, inTransit: 0, outForDelivery: 0, delivered: 0 });
      } finally {
        setIsLoading(false);
      }
    };

    fetchShipments();
  }, [page, pageSize, useMockApi, refreshKey]);

  // Real-time refetch on socket events
  useSocketEvent('shipment:created', refetch);
  useSocketEvent('shipment:updated', refetch);

  return { shipments, totalShipments, stats, isLoading, refetch };
}
