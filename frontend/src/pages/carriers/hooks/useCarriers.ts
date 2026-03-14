import { useCallback, useEffect, useState, useRef } from 'react';
import { carriersApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import type { Carrier } from '@/types';

export function useCarriers() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
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
    const fetchCarriers = async () => {
      if (!isSoft) setIsLoading(true);
      try {
        const response = useMockApi
          ? await mockApi.getCarriers()
          : await carriersApi.getCarriers();
        setCarriers(response.data);
      } catch (error) {
        console.error('Failed to fetch carriers:', error);
        setCarriers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCarriers();
  }, [useMockApi, refreshKey]);

  return { carriers, isLoading, refetch };
}
