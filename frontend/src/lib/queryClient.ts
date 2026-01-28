import { QueryClient } from '@tanstack/react-query';

/**
 * React Query Configuration
 * Provides caching, background updates, and request deduplication
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes
      staleTime: 5 * 60 * 1000,
      
      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      
      // Retry failed requests once
      retry: 1,
      
      // Don't refetch on window focus in development
      refetchOnWindowFocus: process.env.NODE_ENV === 'production',
      
      // Refetch on reconnect
      refetchOnReconnect: true,
      
      // Refetch on mount if data is stale
      refetchOnMount: true,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
    },
  },
});

/**
 * Query Keys Factory
 * Centralized query key management for cache invalidation
 */
export const queryKeys = {
  // Orders
  orders: {
    all: ['orders'] as const,
    lists: () => [...queryKeys.orders.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.orders.lists(), filters] as const,
    details: () => [...queryKeys.orders.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.orders.details(), id] as const,
    stats: () => [...queryKeys.orders.all, 'stats'] as const,
  },
  
  // Shipments
  shipments: {
    all: ['shipments'] as const,
    lists: () => [...queryKeys.shipments.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.shipments.lists(), filters] as const,
    details: () => [...queryKeys.shipments.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.shipments.details(), id] as const,
    tracking: (id: string) => [...queryKeys.shipments.all, 'tracking', id] as const,
  },
  
  // Inventory
  inventory: {
    all: ['inventory'] as const,
    lists: () => [...queryKeys.inventory.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.inventory.lists(), filters] as const,
    details: () => [...queryKeys.inventory.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.inventory.details(), id] as const,
    stats: () => [...queryKeys.inventory.all, 'stats'] as const,
  },
  
  // Warehouses
  warehouses: {
    all: ['warehouses'] as const,
    lists: () => [...queryKeys.warehouses.all, 'list'] as const,
    list: () => [...queryKeys.warehouses.lists()] as const,
    details: () => [...queryKeys.warehouses.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.warehouses.details(), id] as const,
    utilization: () => [...queryKeys.warehouses.all, 'utilization'] as const,
  },
  
  // Carriers
  carriers: {
    all: ['carriers'] as const,
    lists: () => [...queryKeys.carriers.all, 'list'] as const,
    list: () => [...queryKeys.carriers.lists()] as const,
    details: () => [...queryKeys.carriers.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.carriers.details(), id] as const,
    performance: () => [...queryKeys.carriers.all, 'performance'] as const,
  },
  
  // Returns
  returns: {
    all: ['returns'] as const,
    lists: () => [...queryKeys.returns.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.returns.lists(), filters] as const,
    details: () => [...queryKeys.returns.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.returns.details(), id] as const,
    stats: () => [...queryKeys.returns.all, 'stats'] as const,
  },
  
  // Exceptions
  exceptions: {
    all: ['exceptions'] as const,
    lists: () => [...queryKeys.exceptions.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.exceptions.lists(), filters] as const,
    details: () => [...queryKeys.exceptions.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.exceptions.details(), id] as const,
    count: () => [...queryKeys.exceptions.all, 'count'] as const,
  },
  
  // SLA
  sla: {
    all: ['sla'] as const,
    policies: {
      all: () => [...queryKeys.sla.all, 'policies'] as const,
      list: (filters: Record<string, unknown>) => [...queryKeys.sla.policies.all(), filters] as const,
      detail: (id: string) => [...queryKeys.sla.policies.all(), id] as const,
    },
    violations: {
      all: () => [...queryKeys.sla.all, 'violations'] as const,
      list: (filters: Record<string, unknown>) => [...queryKeys.sla.violations.all(), filters] as const,
    },
    dashboard: () => [...queryKeys.sla.all, 'dashboard'] as const,
  },
  
  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    metrics: () => [...queryKeys.dashboard.all, 'metrics'] as const,
    ordersChart: (days: number) => [...queryKeys.dashboard.all, 'orders-chart', days] as const,
    carrierPerformance: () => [...queryKeys.dashboard.all, 'carrier-performance'] as const,
    warehouseUtilization: () => [...queryKeys.dashboard.all, 'warehouse-utilization'] as const,
  },
  
  // Analytics
  analytics: {
    all: ['analytics'] as const,
    kpis: (timeRange: string) => [...queryKeys.analytics.all, 'kpis', timeRange] as const,
    trends: (timeRange: string) => [...queryKeys.analytics.all, 'trends', timeRange] as const,
  },
  
  // Finance
  finance: {
    all: ['finance'] as const,
    invoices: () => [...queryKeys.finance.all, 'invoices'] as const,
    refunds: () => [...queryKeys.finance.all, 'refunds'] as const,
    stats: () => [...queryKeys.finance.all, 'stats'] as const,
  },
  
  // Users
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
    current: () => [...queryKeys.users.all, 'current'] as const,
  },
};

/**
 * Cache Invalidation Helpers
 * Use these after mutations to refresh data
 */
export const cacheUtils = {
  // Invalidate all queries for a resource
  invalidateOrders: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
  invalidateShipments: () => queryClient.invalidateQueries({ queryKey: queryKeys.shipments.all }),
  invalidateInventory: () => queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
  invalidateWarehouses: () => queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all }),
  invalidateCarriers: () => queryClient.invalidateQueries({ queryKey: queryKeys.carriers.all }),
  invalidateReturns: () => queryClient.invalidateQueries({ queryKey: queryKeys.returns.all }),
  invalidateExceptions: () => queryClient.invalidateQueries({ queryKey: queryKeys.exceptions.all }),
  invalidateSLA: () => queryClient.invalidateQueries({ queryKey: queryKeys.sla.all }),
  invalidateDashboard: () => queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
  invalidateAnalytics: () => queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
  invalidateFinance: () => queryClient.invalidateQueries({ queryKey: queryKeys.finance.all }),
  
  // Invalidate specific query
  invalidateQuery: (queryKey: unknown[]) => queryClient.invalidateQueries({ queryKey }),
  
  // Remove query from cache
  removeQuery: (queryKey: unknown[]) => queryClient.removeQueries({ queryKey }),
  
  // Prefetch query
  prefetchQuery: async (queryKey: unknown[], queryFn: () => Promise<unknown>) => {
    await queryClient.prefetchQuery({ queryKey, queryFn });
  },
  
  // Set query data manually
  setQueryData: <T>(queryKey: unknown[], data: T) => {
    queryClient.setQueryData(queryKey, data);
  },
  
  // Get cached query data
  getQueryData: <T>(queryKey: unknown[]): T | undefined => {
    return queryClient.getQueryData<T>(queryKey);
  },
  
  // Clear all cache
  clearAll: () => queryClient.clear(),
};
