import { useState, useEffect, useCallback, useRef } from 'react';
import { returnsApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import { notifyLoadError } from '@/lib/apiErrors';
import type { Return } from '@/types';

export function useReturns(page: number, pageSize: number) {
  const [returns, setReturns] = useState<Return[]>([]);
  const [totalReturns, setTotalReturns] = useState(0);
  const [stats, setStats] = useState({
    totalReturns: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    completed: 0,
  });
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
        const fallback = {
          totalReturns: response.total,
          pending: response.data.filter((r) => r.status === 'pending').length,
          approved: response.data.filter((r) => r.status === 'approved').length,
          rejected: response.data.filter((r) => r.status === 'rejected').length,
          completed: response.data.filter((r) => r.status === 'completed').length,
        };
        const responseWithStats = response as typeof response & { stats?: typeof fallback };
        setStats(responseWithStats.stats ?? fallback);
      } catch (error) {
        if (!isSoft) notifyLoadError('returns', error);
        setReturns([]);
        setTotalReturns(0);
        setStats({ totalReturns: 0, pending: 0, approved: 0, rejected: 0, completed: 0 });
      } finally {
        setIsLoading(false);
      }
    };

    fetchReturns();
  }, [page, pageSize, refreshKey]);

  return { returns, totalReturns, stats, isLoading, refetch };
}
