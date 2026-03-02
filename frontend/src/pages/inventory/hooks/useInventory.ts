import { useCallback, useEffect, useState } from 'react';
import { inventoryApi, warehousesApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import type { InventoryItem, Warehouse } from '@/types';

export function useInventory(page: number, pageSize: number) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { useMockApi } = useApiMode();

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [inventoryRes, warehouseRes, statsRes, lowStockRes] = useMockApi
          ? await Promise.all([
            mockApi.getInventory(page, pageSize),
            mockApi.getWarehouses(),
            { data: { total_items: 0, total_inventory_value: 0, low_stock_items: 0 } },
            { data: [] }
          ])
          : await Promise.all([
            inventoryApi.getInventory(page, pageSize),
            warehousesApi.getWarehouses(),
            inventoryApi.getInventoryStats(),
            inventoryApi.getLowStockItems()
          ]);

        setInventory(inventoryRes.data);
        setTotalItems(inventoryRes.total);
        setWarehouses(warehouseRes.data);
        setStats(statsRes.data);
        setLowStockItems(lowStockRes.data);
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
        setInventory([]);
        setTotalItems(0);
        setWarehouses([]);
        setStats(null);
        setLowStockItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [page, pageSize, useMockApi, refreshKey]);

  return { inventory, warehouses, totalItems, stats, lowStockList: lowStockItems, isLoading, refetch };
}
