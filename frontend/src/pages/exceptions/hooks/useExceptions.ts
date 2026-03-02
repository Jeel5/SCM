import { useEffect, useState, useCallback } from 'react';
import { exceptionsApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import type { Exception } from '@/types';

export function useExceptions(page: number, pageSize: number) {
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [totalExceptions, setTotalExceptions] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { useMockApi } = useApiMode();
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    const fetchExceptions = async () => {
      setIsLoading(true);
      try {
        const response = useMockApi
          ? await mockApi.getExceptions(page, pageSize)
          : await exceptionsApi.getExceptions(page, pageSize);
        setExceptions(response.data);
        setTotalExceptions(response.total);
      } catch (error) {
        console.error('Failed to fetch exceptions:', error);
        setExceptions([]);
        setTotalExceptions(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExceptions();
  }, [page, pageSize, refreshKey]);

  return { exceptions, totalExceptions, isLoading, refetch };
}
