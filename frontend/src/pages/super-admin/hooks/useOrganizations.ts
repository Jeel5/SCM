import { useState, useEffect, useCallback, useRef } from 'react';
import { get } from '@/api/client';
import { extractSafeErrorMessage, notifyLoadError } from '@/lib/apiErrors';
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

const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return (error as { name?: string }).name === 'CanceledError';
  }
  return false;
};

export function useOrganizations(options: UseOrganizationsOptions = {}) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchOrganizations = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

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

      const response = await get<OrganizationsResponse>('/organizations', params, { signal: controller.signal });
      setOrganizations(response.data);
      setTotal(response.pagination.total);
    } catch (err) {
      if (isAbortError(err)) return;
      setError(extractSafeErrorMessage(err, 'Failed to load organizations'));
      notifyLoadError('organizations', err);
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, [options.search, options.is_active, options.include_deleted, options.page, options.limit]);

  useEffect(() => {
    fetchOrganizations();
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, [fetchOrganizations]);

  return { organizations, total, isLoading, error, refetch: fetchOrganizations };
}
