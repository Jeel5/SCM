import { useState } from 'react';
import { useSocketEvent } from '@/hooks/useSocket';
import { motion } from 'framer-motion';
import { Timer, AlertTriangle, CheckCircle, Clock, Download, TrendingUp, TrendingDown, Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Tabs, DataTable, StatusBadge, PermissionGate, Modal } from '@/components/ui';
import { formatDate, formatPercentage } from '@/lib/utils';
import { downloadApiFile, notifyError } from '@/lib/apiErrors';
import type { SLAPolicy, SLAViolation } from '@/types';
import { useSLA } from './hooks/useSLA';
import { CreateSLAPolicyModal } from './components/CreateSLAPolicyModal';

export function SLAManagementPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [page, setPage] = useState(1);
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState<SLAViolation | null>(null);
  const pageSize = 10;
  const { policies, violations, dashboardData, isLoading, totalViolations: violationsTotal, refetch } = useSLA(page, pageSize);

  const getViolationShipmentLabel = (violation: SLAViolation) => violation.trackingNumber || violation.shipmentId || violation.id;
  const getViolationPolicyLabel = (violation: SLAViolation) => violation.policyName || 'No SLA policy';

  // Refetch on real-time exception events (SLA violations are driven by exceptions)
  useSocketEvent('exception:created', refetch);
  useSocketEvent('exception:resolved', refetch);

  const handleExport = async () => {
    try {
      await downloadApiFile(
        '/analytics/export?type=violations&range=month',
        `sla-violations-${new Date().toISOString().slice(0, 10)}.csv`,
      );
    } catch (err) {
      notifyError('Export failed', err, 'Could not export SLA data');
    }
  };

  // Tab badges reflect current counts
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'policies', label: 'Policies', count: policies.length },
    { id: 'violations', label: 'Violations', count: violations.length },
  ];

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
      key: 'targetDeliveryHours',
      header: 'Target (hrs)',
      render: (policy: SLAPolicy) => <span className="text-gray-700 dark:text-gray-300">{policy.targetDeliveryHours}</span>,
    },
    {
      key: 'penaltyAmount',
      header: 'Penalty',
      render: (policy: SLAPolicy) => <span className="text-gray-700 dark:text-gray-300">₹{policy.penaltyAmount}/hr</span>,
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
      header: 'Shipment',
      render: (violation: SLAViolation) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{getViolationShipmentLabel(violation)}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{getViolationPolicyLabel(violation)}</p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (violation: SLAViolation) => (
        <span className="text-gray-700 dark:text-gray-200">{violation.rootCause || 'Late delivery'}</span>
      ),
    },
    {
      key: 'penalty',
      header: 'Penalty',
      render: (violation: SLAViolation) => (
        <span className="font-medium text-red-600 dark:text-red-400">₹{violation.penaltyAmount.toFixed(2)}</span>
      ),
    },
    {
      key: 'violatedAt',
      header: 'Violated At',
      render: (violation: SLAViolation) => (
        <span className="text-gray-500 dark:text-gray-400">{formatDate(violation.createdAt)}</span>
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
    <>
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
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={handleExport}>
            Export
          </Button>
          <PermissionGate permission="sla.manage">
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreatePolicy(true)}>
              Create Policy
            </Button>
          </PermissionGate>
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
                            <p className="font-medium text-gray-900 dark:text-white">{getViolationShipmentLabel(v)}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-300">{getViolationPolicyLabel(v)}</p>
                      </div>
                      <span className="text-red-600 dark:text-red-400 font-medium">₹{v.penaltyAmount.toFixed(2)}</span>
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
                      <span className="text-gray-600 dark:text-gray-300">₹{p.penaltyAmount}/hr</span>
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
            onRowClick={(violation) => setSelectedViolation(violation)}
            pagination={{
              page,
              pageSize,
              total: violationsTotal || violations.length,
              onPageChange: setPage,
            }}
          />
        </Card>
      )}
    </div>

    {/* Create Policy Modal */}
    <CreateSLAPolicyModal
      isOpen={showCreatePolicy}
      onClose={() => setShowCreatePolicy(false)}
      onCreated={() => {
        setShowCreatePolicy(false);
        refetch();
      }}
    />

    <Modal
      isOpen={Boolean(selectedViolation)}
      onClose={() => setSelectedViolation(null)}
      title="Violation Details"
      size="lg"
    >
      {selectedViolation && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Shipment</p>
              <p className="font-medium text-gray-900 dark:text-white">{selectedViolation.trackingNumber || selectedViolation.shipmentId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
              <StatusBadge status={selectedViolation.status} />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Policy</p>
              <p className="font-medium text-gray-900 dark:text-white">{getViolationPolicyLabel(selectedViolation)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Penalty</p>
              <p className="font-medium text-gray-900 dark:text-white">₹{selectedViolation.penaltyAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Violated At</p>
              <p className="font-medium text-gray-900 dark:text-white">{selectedViolation.violatedAt ? formatDate(selectedViolation.violatedAt) : formatDate(selectedViolation.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Delay</p>
              <p className="font-medium text-gray-900 dark:text-white">{selectedViolation.delayHours.toFixed(2)} hours</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Root Cause</p>
            <p className="text-gray-900 dark:text-white">{selectedViolation.rootCause || 'Late delivery'}</p>
          </div>
          {selectedViolation.notes && (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Notes</p>
              <p className="text-gray-900 dark:text-white">{selectedViolation.notes}</p>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setSelectedViolation(null)}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  </>
  );
}

export default SLAManagementPage;
