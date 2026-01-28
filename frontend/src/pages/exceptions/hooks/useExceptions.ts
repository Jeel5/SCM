import { useEffect, useState } from 'react';
import { exceptionsApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import type { Exception } from '@/types';

export function useExceptions(page: number, pageSize: number) {
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [totalExceptions, setTotalExceptions] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchExceptions = async () => {
      const useMockApi = localStorage.getItem('useMockApi') === 'true';
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
  }, [page, pageSize]);

  return { exceptions, totalExceptions, isLoading };
}
