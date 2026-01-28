import { useEffect, useState } from 'react';
import { warehousesApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import type { Warehouse } from '@/types';

export function useWarehouses() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { useMockApi } = useApiMode();

  useEffect(() => {
    const fetchWarehouses = async () => {
      setIsLoading(true);
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
    };

    fetchWarehouses();
  }, []);

  return { warehouses, isLoading };
}
