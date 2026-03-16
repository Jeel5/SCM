import { useEffect, useState, useCallback, useRef } from 'react';
import { exceptionsApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import { notifyLoadError } from '@/lib/apiErrors';
import type { Exception } from '@/types';

export function useExceptions(page: number, pageSize: number) {
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [totalExceptions, setTotalExceptions] = useState(0);
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
      } catch (error) {
        if (!isSoft) notifyLoadError('exceptions', error);
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
