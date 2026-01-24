import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Timer, AlertTriangle, CheckCircle, Clock, Download, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Tabs, DataTable, StatusBadge } from '@/components/ui';
import { formatDate, formatPercentage, cn } from '@/lib/utils';
import { slaApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import type { SLAPolicy, SLAViolation } from '@/types';

export function SLAManagementPage() {
  const [policies, setPolicies] = useState<SLAPolicy[]>([]);
  const [violations, setViolations] = useState<SLAViolation[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'policies', label: 'Policies' },
    { id: 'violations', label: 'Violations' },
  ];

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const useMock = localStorage.getItem('useMockApi') === 'true';

      try {
        if (useMock) {
          const [policiesRes, violationsRes] = await Promise.all([
            mockApi.getSLAPolicies(),
            mockApi.getSLAViolations(page, pageSize),
          ]);
          setPolicies(policiesRes.data);
          setViolations(violationsRes.data);
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
  }, [page]);

  const policyColumns = [
    {
      key: 'name',
      header: 'Policy Name',
      render: (policy: SLAPolicy) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{policy.name}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{policy.serviceType}</p>
        </div>
      ),
    },
    {
      key: 'region',
      header: 'Region',
      render: (policy: SLAPolicy) => <span className="text-gray-700 dark:text-gray-300">{policy.region}</span>,
    },
    {
      key: 'targetDeliveryHours',
      header: 'Target (hrs)',
      render: (policy: SLAPolicy) => <span className="text-gray-700 dark:text-gray-300">{policy.targetDeliveryHours}</span>,
    },
    {
      key: 'penaltyAmount',
      header: 'Penalty',
      render: (policy: SLAPolicy) => <span className="text-gray-700">${policy.penaltyAmount}/hr</span>,
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (policy: SLAPolicy) => (
        <StatusBadge status={policy.isActive ? 'active' : 'inactive'} />
      ),
    },
  ];

  const violationColumns = [
    {
      key: 'id',
      header: 'Violation',
      render: (violation: SLAViolation) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{violation.trackingNumber}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{violation.policyName}</p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (violation: SLAViolation) => (
        <span className="text-gray-700 dark:text-gray-200">{violation.violationReason || 'Late delivery'}</span>
      ),
    },
    {
      key: 'penalty',
      header: 'Penalty',
      render: (violation: SLAViolation) => (
        <span className="font-medium text-red-600 dark:text-red-400">${violation.penaltyAmount.toFixed(2)}</span>
      ),
    },
    {
      key: 'violatedAt',
      header: 'Violated At',
      render: (violation: SLAViolation) => (
        <span className="text-gray-500 dark:text-gray-400">{formatDate(violation.violatedAt)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (violation: SLAViolation) => <StatusBadge status={violation.status} />,
    },
  ];

  const compliance = dashboardData?.overallCompliance || 0;
  const totalViolations = dashboardData?.violations
    ? dashboardData.violations.pending + dashboardData.violations.resolved + dashboardData.violations.waived
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SLA Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Monitor service level agreements and violations</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />}>
            Export
          </Button>
          <Button variant="primary">Create Policy</Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      {!isLoading && dashboardData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">Overall Compliance</p>
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatPercentage(compliance)}</p>
            <div className="flex items-center gap-1 mt-2">
              {compliance >= 90 ? (
                <>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">Excellent</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-500">Needs improvement</span>
                </>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Violations</p>
              <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalViolations}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {dashboardData.violations?.pending || 0} pending resolution
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">On-Time Deliveries</p>
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{dashboardData.onTimeDeliveries || 0}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              of {dashboardData.totalShipments || 0} total shipments
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Policies</p>
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Timer className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{policies.filter(p => p.isActive).length}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {policies.length} total policies
            </p>
          </motion.div>
        </div>
      )}

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Content based on active tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Violations</CardTitle>
            </CardHeader>
            <CardContent>
              {violations.slice(0, 5).length > 0 ? (
                <div className="space-y-3">
                  {violations.slice(0, 5).map((v) => (
                    <div key={v.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{v.trackingNumber}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-300">{v.policyName}</p>
                      </div>
                      <span className="text-red-600 dark:text-red-400 font-medium">${v.penaltyAmount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No violations found</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Policies</CardTitle>
            </CardHeader>
            <CardContent>
              {policies.filter(p => p.isActive).length > 0 ? (
                <div className="space-y-3">
                  {policies.filter(p => p.isActive).slice(0, 5).map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{p.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{p.targetDeliveryHours}h target</p>
                      </div>
                      <span className="text-gray-600 dark:text-gray-300">${p.penaltyAmount}/hr</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No active policies</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'policies' && (
        <Card padding="none">
          <DataTable
            columns={policyColumns}
            data={policies}
            isLoading={isLoading}
            searchPlaceholder="Search policies..."
            emptyMessage="No SLA policies found"
          />
        </Card>
      )}

      {activeTab === 'violations' && (
        <Card padding="none">
          <DataTable
            columns={violationColumns}
            data={violations}
            isLoading={isLoading}
            searchPlaceholder="Search violations..."
            emptyMessage="No violations found"
          />
        </Card>
      )}
    </div>
  );
}

export default SLAManagementPage;
