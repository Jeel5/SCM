import { useEffect, useState, useCallback, useRef } from 'react';
import { warehousesApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import type { Warehouse } from '@/types';

export function useWarehouses() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { useMockApi } = useApiMode();

  const isSoftRefresh = useRef(false);
  const refetch = useCallback(() => {
    isSoftRefresh.current = true;
    setRefreshKey((k) => k + 1);
  }, []);

  const fetchWarehouses = useCallback(async () => {
    const isSoft = isSoftRefresh.current;
    isSoftRefresh.current = false;
    if (!isSoft) setIsLoading(true);
    try {
      const response = useMockApi
        ? await mockApi.getWarehouses()
        : await warehousesApi.getWarehouses();
      setWarehouses(response.data);
    } catch (error) {
      console.error('Failed to fetch warehouses:', error);
      setWarehouses([]);
    } finally {
      setIsLoading(false);
    }
  }, [useMockApi]);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses, refreshKey]);

  return { warehouses, isLoading, refetch };
}
