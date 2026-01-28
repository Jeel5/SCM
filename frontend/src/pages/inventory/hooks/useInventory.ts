import { useEffect, useState } from 'react';
import { inventoryApi, warehousesApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import type { InventoryItem, Warehouse } from '@/types';

export function useInventory(page: number, pageSize: number) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { useMockApi } = useApiMode();

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [inventoryRes, warehouseRes] = useMockApi
          ? await Promise.all([
              mockApi.getInventory(page, pageSize),
              mockApi.getWarehouses(),
            ])
          : await Promise.all([
              inventoryApi.getInventory(page, pageSize),
              warehousesApi.getWarehouses(),
            ]);
        setInventory(inventoryRes.data);
        setTotalItems(inventoryRes.total);
        setWarehouses(warehouseRes.data);
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
        setInventory([]);
        setTotalItems(0);
        setWarehouses([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [page, pageSize]);

  return { inventory, warehouses, totalItems, isLoading };
}
