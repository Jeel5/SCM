import { useCallback, useEffect, useState } from 'react';
import { ordersApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import { useSocketEvent } from '@/hooks/useSocket';
import type { Order } from '@/types';

export function useOrders(page: number, pageSize: number) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { useMockApi } = useApiMode();

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      try {
        const response = useMockApi 
          ? await mockApi.getOrders(page, pageSize)
          : await ordersApi.getOrders(page, pageSize);
        setOrders(response.data);
        setTotalOrders(response.total);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
        setOrders([]);
        setTotalOrders(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [page, pageSize, useMockApi, refreshKey]);

  // Refetch automatically on socket events
  useSocketEvent('order:created', refetch);
  useSocketEvent('order:updated', refetch);

  return { orders, totalOrders, isLoading, refetch };
}

