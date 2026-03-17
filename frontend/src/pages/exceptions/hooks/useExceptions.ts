import { useEffect, useState, useCallback, useRef } from 'react';
import { exceptionsApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import { notifyLoadError } from '@/lib/apiErrors';
import type { Exception } from '@/types';

export function useExceptions(page: number, pageSize: number) {
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [totalExceptions, setTotalExceptions] = useState(0);
  const [stats, setStats] = useState({
    totalExceptions: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    critical: 0,
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
    const fetchExceptions = async () => {
      if (!isSoft) setIsLoading(true);
      try {
        const response = useMockApi
          ? await mockApi.getExceptions(page, pageSize)
          : await exceptionsApi.getExceptions(page, pageSize);
        setExceptions(response.data);
        setTotalExceptions(response.total);
        const fallback = {
          totalExceptions: response.total,
          open: response.data.filter((e) => e.status === 'open').length,
          inProgress: response.data.filter((e) => e.status === 'in_progress').length,
          resolved: response.data.filter((e) => e.status === 'resolved').length,
          critical: response.data.filter((e) => e.severity === 'critical').length,
        };
        const responseWithStats = response as typeof response & { stats?: typeof fallback };
        setStats(responseWithStats.stats ?? fallback);
      } catch (error) {
        if (!isSoft) notifyLoadError('exceptions', error);
        setExceptions([]);
        setTotalExceptions(0);
        setStats({ totalExceptions: 0, open: 0, inProgress: 0, resolved: 0, critical: 0 });
      } finally {
        setIsLoading(false);
      }
    };

    fetchExceptions();
  }, [page, pageSize, refreshKey]);

  return { exceptions, totalExceptions, stats, isLoading, refetch };
}
