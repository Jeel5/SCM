import { useCallback, useEffect, useState, useRef } from 'react';
import { ordersApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import { useSocketEvent } from '@/hooks/useSocket';
import { notifyLoadError } from '@/lib/apiErrors';
import type { Order } from '@/types';

const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return (error as { name?: string }).name === 'CanceledError';
  }
  return false;
};

export function useOrders(page: number, pageSize: number, filters?: Record<string, unknown>) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [stats, setStats] = useState({
    totalOrders: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    returned: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { useMockApi } = useApiMode();

  // isSoftRefresh: true when triggered by refetch() (background update) — skip full-page spinner
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
    const fetchOrders = async () => {
      if (!isSoft) setIsLoading(true);
      try {
        const response = useMockApi
          ? await mockApi.getOrders(page, pageSize)
          : await ordersApi.getOrders(page, pageSize, filters);
        setOrders(response.data);
        setTotalOrders(response.total);
        const fallback = {
          totalOrders: response.total,
          processing: response.data.filter((o) => o.status === 'processing').length,
          shipped: response.data.filter((o) => o.status === 'shipped').length,
          delivered: response.data.filter((o) => o.status === 'delivered').length,
          returned: response.data.filter((o) => o.status === 'returned').length,
        };
        const responseWithStats = response as typeof response & { stats?: typeof fallback };
        setStats(responseWithStats.stats ?? fallback);
      } catch (error) {
        if (isAbortError(error)) return;
        if (!isSoft) notifyLoadError('orders', error);
        setOrders([]);
        setTotalOrders(0);
        setStats({ totalOrders: 0, processing: 0, shipped: 0, delivered: 0, returned: 0 });
      } finally {
        if (abortControllerRef.current === controller) {
          setIsLoading(false);
        }
      }
    };

    fetchOrders();

    return () => {
      controller.abort();
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    };
  }, [page, pageSize, useMockApi, refreshKey, JSON.stringify(filters || {})]);

  // Refetch automatically on socket events
  useSocketEvent('order:created', refetch);
  useSocketEvent('order:updated', refetch);

  return { orders, totalOrders, stats, isLoading, refetch };
}
