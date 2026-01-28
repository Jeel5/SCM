import { useState, useEffect } from 'react';
import { returnsApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import type { Return } from '@/types';

export function useReturns(page: number, pageSize: number) {
  const [returns, setReturns] = useState<Return[]>([]);
  const [totalReturns, setTotalReturns] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { useMockApi } = useApiMode();

  useEffect(() => {
    const fetchReturns = async () => {
      setIsLoading(true);
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
  }, [page, pageSize]);

  return { returns, totalReturns, isLoading };
}
