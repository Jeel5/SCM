import { useCallback, useEffect, useState, useRef } from 'react';
import { slaApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import { notifyLoadError } from '@/lib/apiErrors';
import type { SLAPolicy, SLAViolation, SLADashboardData } from '@/types';

const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return (error as { name?: string }).name === 'CanceledError';
  }
  return false;
};

export function useSLA(page: number, pageSize: number) {
  const [policies, setPolicies] = useState<SLAPolicy[]>([]);
  const [violations, setViolations] = useState<SLAViolation[]>([]);
  const [totalViolations, setTotalViolations] = useState(0);
  const [dashboardData, setDashboardData] = useState<SLADashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { useMockApi } = useApiMode();

  // isSoftRefresh: when triggered by refetch() skip full-page spinner
  const isSoftRefresh = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const refetch = useCallback(() => {
    isSoftRefresh.current = true;
    setRefreshKey((k) => k + 1);
  }, []);

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
          const [policiesRes, violationsRes] = await Promise.all([
            mockApi.getSLAPolicies(),
            mockApi.getSLAViolations(page, pageSize),
          ]);
          setPolicies(policiesRes.data);
          setViolations(violationsRes.data);
          setTotalViolations(violationsRes.total || violationsRes.data.length);
          setDashboardData({
            overallCompliance: 94.5,
            totalShipments: 1250,
            onTimeDeliveries: 1182,
            violations: { pending: 12, resolved: 45, waived: 11 },
            topCarriers: [] as Array<{ name: string; reliabilityScore: number; shipmentCount: number }>,
          });
        } else {
          const [policiesRes, violationsRes, dashRes] = await Promise.all([
            slaApi.getSLAPolicies(),
            slaApi.getSLAViolations(page, pageSize, undefined),
            slaApi.getSLADashboard(),
          ]);
          setPolicies(policiesRes.data || []);
          setViolations(violationsRes.data || []);
          setTotalViolations(violationsRes.total || 0);
          setDashboardData(dashRes.data || {
            overallCompliance: 0,
            totalShipments: 0,
            onTimeDeliveries: 0,
            violations: { pending: 0, resolved: 0, waived: 0 },
            topCarriers: [] as Array<{ name: string; reliabilityScore: number; shipmentCount: number }>,
          });
        }
      } catch (error) {
        if (isAbortError(error)) return;
        if (!isSoft) notifyLoadError('SLA data', error);
        setPolicies([]);
        setViolations([]);
        setTotalViolations(0);
        setDashboardData({
          overallCompliance: 0,
          totalShipments: 0,
          onTimeDeliveries: 0,
          violations: { pending: 0, resolved: 0, waived: 0 },
          topCarriers: [] as Array<{ name: string; reliabilityScore: number; shipmentCount: number }>,
        });
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
  }, [page, pageSize, useMockApi, refreshKey]);

  return { policies, violations, totalViolations, dashboardData, isLoading, refetch };
}
