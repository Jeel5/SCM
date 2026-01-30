import { useEffect, useState } from 'react';
import { slaApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import type { SLAPolicy, SLAViolation, SLADashboardData } from '@/types';

export function useSLA(page: number, pageSize: number) {
  const [policies, setPolicies] = useState<SLAPolicy[]>([]);
  const [violations, setViolations] = useState<SLAViolation[]>([]);
  const [totalViolations, setTotalViolations] = useState(0);
  const [dashboardData, setDashboardData] = useState<SLADashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { useMockApi } = useApiMode();

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);

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
            topCarriers: [],
          });
        } else {
          const [policiesRes, violationsRes, dashRes] = await Promise.all([
            slaApi.getSLAPolicies(),
            slaApi.getSLAViolations(page, pageSize),
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
            topCarriers: [],
          });
        }
      } catch (error) {
        console.error('Failed to fetch SLA data:', error);
        setPolicies([]);
        setViolations([]);
        setTotalViolations(0);
        setDashboardData({
          overallCompliance: 0,
          totalShipments: 0,
          onTimeDeliveries: 0,
          violations: { pending: 0, resolved: 0, waived: 0 },
          topCarriers: [],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [page, pageSize, useMockApi]);

  return { policies, violations, totalViolations, dashboardData, isLoading };
}
