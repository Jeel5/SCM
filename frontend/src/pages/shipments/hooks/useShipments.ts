import { useState, useEffect, useCallback, useRef } from 'react';
import { shipmentsApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import { useSocketEvent } from '@/hooks/useSocket';
import { notifyLoadError } from '@/lib/apiErrors';
import type { Shipment } from '@/types';

const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return (error as { name?: string }).name === 'CanceledError';
  }
  return false;
};

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
  const abortControllerRef = useRef<AbortController | null>(null);
  const refetch = useCallback(() => {
    isSoftRefresh.current = true;
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const isSoft = isSoftRefresh.current;
    isSoftRefresh.current = false;
    const fetchShipments = async () => {
      if (!isSoft) setIsLoading(true);
      try {
        const response = useMockApi
          ? await mockApi.getShipments(page, pageSize)
          : await shipmentsApi.getShipments(page, pageSize, undefined);
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
        if (isAbortError(error)) return;
        if (!isSoft) notifyLoadError('shipments', error);
        setShipments([]);
        setTotalShipments(0);
        setStats({ totalShipments: 0, inTransit: 0, outForDelivery: 0, delivered: 0 });
      } finally {
        if (abortControllerRef.current === controller) {
          setIsLoading(false);
        }
      }
    };

    fetchShipments();

    return () => {
      controller.abort();
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    };
  }, [page, pageSize, useMockApi, refreshKey]);

  // Real-time refetch on socket events
  useSocketEvent('shipment:created', refetch);
  useSocketEvent('shipment:updated', refetch);

  return { shipments, totalShipments, stats, isLoading, refetch };
}
