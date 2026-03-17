import { useEffect, useState, useCallback, useRef } from 'react';
import { productsApi } from '@/api/services';
import { useApiMode } from '@/hooks';
import { notifyLoadError } from '@/lib/apiErrors';
import type { Product } from '@/types';

const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return (error as { name?: string }).name === 'CanceledError';
  }
  return false;
};

export function useProducts(page: number, pageSize: number, filters?: Record<string, unknown>) {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [stats, setStats] = useState({
    totalProducts: 0,
    active: 0,
    inactive: 0,
    categories: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { useMockApi } = useApiMode();
  const isSoftRefresh = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const refetch = useCallback(() => {
    isSoftRefresh.current = true;
    setRefreshKey((k) => k + 1);
  }, []);

  const fetchProducts = useCallback(async (signal?: AbortSignal) => {
    const isSoft = isSoftRefresh.current;
    isSoftRefresh.current = false;
    if (useMockApi) {
      setProducts([]);
      setTotalItems(0);
      setIsLoading(false);
      return;
    }

    if (!isSoft) setIsLoading(true);
    try {
      const res = await productsApi.getProducts({ page, limit: pageSize, ...filters });
      setProducts(res.data);
      setTotalItems(res.total);
      const fallback = {
        totalProducts: res.total,
        active: res.data.filter((p) => p.isActive).length,
        inactive: res.data.filter((p) => !p.isActive).length,
        categories: new Set(res.data.map((p) => p.category).filter(Boolean)).size,
      };
      const responseWithStats = res as typeof res & { stats?: typeof fallback };
      setStats(responseWithStats.stats ?? fallback);
    } catch (error) {
      if (isAbortError(error)) return;
      if (!isSoft) notifyLoadError('products', error);
      setProducts([]);
      setTotalItems(0);
      setStats({ totalProducts: 0, active: 0, inactive: 0, categories: 0 });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, useMockApi, JSON.stringify(filters)]);

  useEffect(() => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    fetchProducts(controller.signal);

    return () => {
      controller.abort();
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    };
  }, [fetchProducts, refreshKey]);

  return { products, totalItems, stats, isLoading, refetch };
}
