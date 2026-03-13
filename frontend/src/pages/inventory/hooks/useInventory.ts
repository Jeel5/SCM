import { useCallback, useEffect, useState } from 'react';
import { inventoryApi, warehousesApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import { useSocketEvent } from '@/hooks/useSocket';
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

  // Live refetch when backend emits inventory changes via socket
  useSocketEvent('inventory:updated', refetch);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (useMockApi) {
          const [inventoryRes, warehouseRes] = await Promise.all([
            mockApi.getInventory(page, pageSize),
            mockApi.getWarehouses(),
          ]);
          setInventory(inventoryRes.data);
          setTotalItems(inventoryRes.total);
          setWarehouses(warehouseRes.data);
          setStats({ total_items: 0, total_inventory_value: 0, low_stock_items: 0 });
          setLowStockItems([]);
        } else {
          // Use allSettled so a failing stats/low-stock call doesn't wipe the main list
          const [inventoryRes, warehouseRes, statsRes, lowStockRes] = await Promise.allSettled([
            inventoryApi.getInventory(page, pageSize),
            warehousesApi.getWarehouses(),
            inventoryApi.getInventoryStats(),
            inventoryApi.getLowStockItems(),
          ]);

          if (inventoryRes.status === 'fulfilled') {
            setInventory(inventoryRes.value.data);
            setTotalItems(inventoryRes.value.total);
          } else {
            setInventory([]);
            setTotalItems(0);
          }
          if (warehouseRes.status === 'fulfilled') setWarehouses(warehouseRes.value.data);
          if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
          if (lowStockRes.status === 'fulfilled') setLowStockItems(lowStockRes.value.data);
        }
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
