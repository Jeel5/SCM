import { useEffect, useState } from 'react';
import { carriersApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import type { Carrier } from '@/types';

export function useCarriers() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCarriers = async () => {
      const useMockApi = localStorage.getItem('useMockApi') === 'true';
      setIsLoading(true);
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
  }, []);

  return { carriers, isLoading };
}
