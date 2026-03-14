import { useEffect, useState, useCallback, useRef } from 'react';
import { productsApi } from '@/api/services';
import { useApiMode } from '@/hooks';
import type { Product } from '@/types';

export function useProducts(page: number, pageSize: number, filters?: Record<string, unknown>) {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { useMockApi } = useApiMode();
  const isSoftRefresh = useRef(false);

  const refetch = useCallback(() => {
    isSoftRefresh.current = true;
    setRefreshKey((k) => k + 1);
  }, []);

  const fetchProducts = useCallback(async () => {
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
    } catch (error) {
      console.error('Failed to fetch products:', error);
      setProducts([]);
      setTotalItems(0);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, useMockApi, JSON.stringify(filters)]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts, refreshKey]);

  return { products, totalItems, isLoading, refetch };
}
