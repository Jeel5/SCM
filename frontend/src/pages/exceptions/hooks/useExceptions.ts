import { useEffect, useState, useCallback, useRef } from 'react';
import { exceptionsApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import { notifyLoadError } from '@/lib/apiErrors';
import type { Exception } from '@/types';

const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return (error as { name?: string }).name === 'CanceledError';
  }
  return false;
};

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
  const abortControllerRef = useRef<AbortController | null>(null);
  const refetch = useCallback(() => {
    isSoftRefresh.current = true;
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const isSoft = isSoftRefresh.current;
    isSoftRefresh.current = false;
    const fetchExceptions = async () => {
      if (!isSoft) setIsLoading(true);
      try {
        const response = useMockApi
          ? await mockApi.getExceptions(page, pageSize)
          : await exceptionsApi.getExceptions(page, pageSize, undefined);
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
        if (isAbortError(error)) return;
        if (!isSoft) notifyLoadError('exceptions', error);
        setExceptions([]);
        setTotalExceptions(0);
        setStats({ totalExceptions: 0, open: 0, inProgress: 0, resolved: 0, critical: 0 });
      } finally {
        if (abortControllerRef.current === controller) {
          setIsLoading(false);
        }
      }
    };

    fetchExceptions();

    return () => {
      controller.abort();
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    };
  }, [page, pageSize, refreshKey, useMockApi]);

  return { exceptions, totalExceptions, stats, isLoading, refetch };
}
