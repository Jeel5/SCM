import { useState, useEffect, useCallback } from 'react';
import { shipmentsApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import { useSocketEvent } from '@/hooks/useSocket';
import type { Shipment } from '@/types';

export function useShipments(page: number, pageSize: number) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [totalShipments, setTotalShipments] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { useMockApi } = useApiMode();

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    const fetchShipments = async () => {
      setIsLoading(true);
      try {
        const response = useMockApi
          ? await mockApi.getShipments(page, pageSize)
          : await shipmentsApi.getShipments(page, pageSize);
        setShipments(response.data);
        setTotalShipments(response.total);
      } catch (error) {
        console.error('Failed to fetch shipments:', error);
        setShipments([]);
        setTotalShipments(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShipments();
  }, [page, pageSize, useMockApi, refreshKey]);

  // Real-time refetch on socket events
  useSocketEvent('shipment:created', refetch);
  useSocketEvent('shipment:updated', refetch);

  return { shipments, totalShipments, isLoading, refetch };
}
