import { useState, useEffect, useCallback, useRef } from 'react';
import { returnsApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import { notifyLoadError } from '@/lib/apiErrors';
import type { Return } from '@/types';

const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return (error as { name?: string }).name === 'CanceledError';
  }
  return false;
};

export function useReturns(page: number, pageSize: number, filters?: Record<string, unknown>) {
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
    const fetchReturns = async () => {
      if (!isSoft) setIsLoading(true);
      try {
        const response = useMockApi
          ? await mockApi.getReturns(page, pageSize)
          : await returnsApi.getReturns(page, pageSize, filters);
        setReturns(response.data);
        setTotalReturns(response.total);
        const fallback = {
          totalReturns: response.total,
          pending: response.data.filter((r) => r.status === 'requested').length,
          approved: response.data.filter((r) => r.status === 'approved').length,
          rejected: response.data.filter((r) => r.status === 'rejected').length,
          completed: response.data.filter((r) => ['refunded', 'restocked', 'completed'].includes(r.status)).length,
        };
        const responseWithStats = response as typeof response & { stats?: typeof fallback };
        setStats(responseWithStats.stats ?? fallback);
      } catch (error) {
        if (isAbortError(error)) return;
        if (!isSoft) notifyLoadError('returns', error);
        setReturns([]);
        setTotalReturns(0);
        setStats({ totalReturns: 0, pending: 0, approved: 0, rejected: 0, completed: 0 });
      } finally {
        if (abortControllerRef.current === controller) {
          setIsLoading(false);
        }
      }
    };

    fetchReturns();

    return () => {
      controller.abort();
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    };
  }, [page, pageSize, refreshKey, useMockApi, JSON.stringify(filters || {})]);

  return { returns, totalReturns, stats, isLoading, refetch };
}
