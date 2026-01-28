import { useState, useEffect } from 'react';
import { shipmentsApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import type { Shipment } from '@/types';

export function useShipments(page: number, pageSize: number) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [totalShipments, setTotalShipments] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { useMockApi } = useApiMode();

  useEffect(() => {
    const fetchShipments = async () => {
      setIsLoading(true);
      try {
        const response = useMockApi
          ? await mockApi.getShipments(page, pageSize)
          : await shipmentsApi.getShipments(page, pageSize);
        setShipments(response.data);
        setTotalShipments(response.total);
      } catch (error) {
        console.error('Failed to fetch shipments:', error);
        setShipments([]);
        setTotalShipments(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShipments();
  }, [page, pageSize]);

  return { shipments, totalShipments, isLoading };
}
