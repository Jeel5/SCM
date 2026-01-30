import { useEffect, useState } from 'react';
import { ordersApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import type { Order } from '@/types';

export function useOrders(page: number, pageSize: number) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { useMockApi } = useApiMode();

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
  }, [page, pageSize, useMockApi]);

  return { orders, totalOrders, isLoading };
}
