import { useState, useEffect, useCallback } from 'react';
import { get } from '@/api/client';
import type { Organization } from '../types';

interface OrganizationsResponse {
  success: boolean;
  data: Organization[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface UseOrganizationsOptions {
  search?: string;
  is_active?: boolean;
  include_deleted?: boolean;
  page?: number;
  limit?: number;
}

export function useOrganizations(options: UseOrganizationsOptions = {}) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params: Record<string, unknown> = {
        page: options.page || 1,
        limit: options.limit || 50,
      };
      if (options.search) params.search = options.search;
      if (options.is_active !== undefined) params.is_active = options.is_active;
      if (options.include_deleted !== undefined) params.include_deleted = options.include_deleted;

      const response = await get<OrganizationsResponse>('/organizations', params);
      setOrganizations(response.data);
      setTotal(response.pagination.total);
    } catch (err) {
      setError('Failed to load organizations');
      console.error('useOrganizations error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [options.search, options.is_active, options.include_deleted, options.page, options.limit]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  return { organizations, total, isLoading, error, refetch: fetchOrganizations };
}
