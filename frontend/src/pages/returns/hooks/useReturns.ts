import { useState, useEffect, useCallback, useRef } from 'react';
import { returnsApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import type { Return } from '@/types';

export function useReturns(page: number, pageSize: number) {
  const [returns, setReturns] = useState<Return[]>([]);
  const [totalReturns, setTotalReturns] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { useMockApi } = useApiMode();
  const [refreshKey, setRefreshKey] = useState(0);

  const isSoftRefresh = useRef(false);
  const refetch = useCallback(() => {
    isSoftRefresh.current = true;
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const isSoft = isSoftRefresh.current;
    isSoftRefresh.current = false;
    const fetchReturns = async () => {
      if (!isSoft) setIsLoading(true);
      try {
        const response = useMockApi
          ? await mockApi.getReturns(page, pageSize)
          : await returnsApi.getReturns(page, pageSize);
        setReturns(response.data);
        setTotalReturns(response.total);
      } catch (error) {
        console.error('Failed to fetch returns:', error);
        setReturns([]);
        setTotalReturns(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReturns();
  }, [page, pageSize, refreshKey]);

  return { returns, totalReturns, isLoading, refetch };
}
