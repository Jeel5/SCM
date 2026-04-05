import { useCallback, useEffect, useState, useRef } from 'react';
import { inventoryApi, warehousesApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import { useSocketEvent } from '@/hooks/useSocket';
import { notifyLoadError } from '@/lib/apiErrors';
import type { InventoryItem, Warehouse, RestockOrderSummary } from '@/types';

const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return (error as { name?: string }).name === 'CanceledError';
  }
  return false;
};

export function useInventory(page: number, pageSize: number, filters?: Record<string, unknown>) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [restockOrders, setRestockOrders] = useState<RestockOrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { useMockApi } = useApiMode();

  const isSoftRefresh = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const refetch = useCallback(() => {
    isSoftRefresh.current = true;
    setRefreshKey((k) => k + 1);
  }, []);

  // Live refetch when backend emits inventory changes via socket
  useSocketEvent('inventory:updated', refetch);

  useEffect(() => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const isSoft = isSoftRefresh.current;
    isSoftRefresh.current = false;
    const fetchData = async () => {
      if (!isSoft) setIsLoading(true);
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
          setRestockOrders([]);
        } else {
          // Use allSettled so a failing stats/low-stock call doesn't wipe the main list
          const [inventoryRes, warehouseRes, statsRes, lowStockRes, restockOrdersRes] = await Promise.allSettled([
            inventoryApi.getInventory(page, pageSize, filters),
            warehousesApi.getWarehouses(undefined),
            inventoryApi.getInventoryStats(undefined),
            inventoryApi.getLowStockItems(undefined),
            inventoryApi.getRestockOrders(10, false),
          ]);

          const wasAborted = [inventoryRes, warehouseRes, statsRes, lowStockRes, restockOrdersRes].some(
            (result) => result.status === 'rejected' && isAbortError(result.reason)
          );
          if (wasAborted) return;

          if (inventoryRes.status === 'fulfilled') {
            setInventory(inventoryRes.value.data);
            setTotalItems(inventoryRes.value.total);
          } else {
            setInventory([]);
            setTotalItems(0);
            if (!isSoft) notifyLoadError('inventory', inventoryRes.reason);
          }
          if (warehouseRes.status === 'fulfilled') {
            setWarehouses(warehouseRes.value.data);
          } else if (!isSoft) {
            notifyLoadError('warehouses', warehouseRes.reason);
          }
          if (statsRes.status === 'fulfilled') {
            setStats(statsRes.value.data);
          } else if (!isSoft) {
            notifyLoadError('inventory stats', statsRes.reason);
          }
          if (lowStockRes.status === 'fulfilled') {
            setLowStockItems(lowStockRes.value.data);
          } else if (!isSoft) {
            notifyLoadError('low stock alerts', lowStockRes.reason);
          }
          if (restockOrdersRes.status === 'fulfilled') {
            setRestockOrders(restockOrdersRes.value.data);
          } else if (!isSoft) {
            notifyLoadError('restock orders', restockOrdersRes.reason);
          }
        }
      } catch (error) {
        if (isAbortError(error)) return;
        if (!isSoft) notifyLoadError('inventory', error);
        setInventory([]);
        setTotalItems(0);
        setWarehouses([]);
        setStats(null);
        setLowStockItems([]);
        setRestockOrders([]);
      } finally {
        if (abortControllerRef.current === controller) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      controller.abort();
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    };
  }, [page, pageSize, useMockApi, refreshKey, JSON.stringify(filters || {})]);

  return { inventory, warehouses, totalItems, stats, lowStockList: lowStockItems, restockOrders, isLoading, refetch };
}
