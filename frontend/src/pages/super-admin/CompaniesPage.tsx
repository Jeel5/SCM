import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Users,
  RefreshCw,
  CheckCircle,
  XCircle,
  PauseCircle,
  PlayCircle,
  ClipboardList,
  Receipt,
} from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Badge,
  Dropdown,
  Modal,
} from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/utils';
import { del } from '@/api/client';
import { superAdminApi } from '@/api/services';
import { toast } from '@/stores/toastStore';
import { useOrganizations } from './hooks/useOrganizations';
import { CreateOrgModal } from './components/CreateOrgModal';
import { EditOrgModal } from './components/EditOrgModal';
import type { Organization } from './types';

interface OrgAuditLog {
  id: string;
  action: string;
  performed_by_role?: string | null;
  performed_by_name?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

interface OrgBillingSummary {
  rangeDays: number;
  invoiceCount: number;
  billedAmount: number;
  paidAmount: number;
  openAmount: number;
  refundsAmount: number;
  avgInvoiceAmount: number;
  lastInvoice: {
    invoiceNumber: string;
    status: string;
    createdAt: string;
  } | null;
}

const TIER_BADGE: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
  starter: 'default',
  standard: 'info',
  enterprise: 'success',
};

export function CompaniesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [showDeleted, setShowDeleted] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null);
  const [suspendOrg, setSuspendOrg] = useState<Organization | null>(null);
  const [reactivateOrg, setReactivateOrg] = useState<Organization | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [auditOrg, setAuditOrg] = useState<Organization | null>(null);
  const [auditLogs, setAuditLogs] = useState<OrgAuditLog[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [billingOrg, setBillingOrg] = useState<Organization | null>(null);
  const [billingSummary, setBillingSummary] = useState<OrgBillingSummary | null>(null);
  const [isBillingLoading, setIsBillingLoading] = useState(false);

  const { organizations, total, isLoading, refetch } = useOrganizations({
    search: searchQuery || undefined,
    is_active: activeFilter,
    include_deleted: showDeleted,
  });

  const handleDelete = async () => {
    if (!deletingOrg) return;
    try {
      setIsDeleting(true);
      await del(`/organizations/${deletingOrg.id}`);
      toast.success('Organization Deactivated', `${deletingOrg.name} has been deactivated`);
      setDeletingOrg(null);
      refetch();
    } catch {
      // Error handled by interceptor
    } finally {
      setIsDeleting(false);
    }
  };

  const activeCount = organizations.filter((o) => o.isActive).length;
  const inactiveCount = organizations.filter((o) => !o.isActive).length;
  const suspendedCount = organizations.filter((o) => Boolean(o.suspendedAt)).length;

  const handleSuspend = async () => {
    if (!suspendOrg) return;
    if (!suspendReason.trim()) {
      toast.error('Validation Error', 'Suspension reason is required');
      return;
    }

    try {
      setIsSubmittingAction(true);
      await superAdminApi.suspendCompany(suspendOrg.id, suspendReason.trim());
      toast.success('Organization Suspended', `${suspendOrg.name} was suspended`);
      setSuspendOrg(null);
      setSuspendReason('');
      refetch();
    } catch {
      // handled by interceptor
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleReactivate = async () => {
    if (!reactivateOrg) return;
    try {
      setIsSubmittingAction(true);
      await superAdminApi.reactivateCompany(reactivateOrg.id);
      toast.success('Organization Reactivated', `${reactivateOrg.name} is active again`);
      setReactivateOrg(null);
      refetch();
    } catch {
      // handled by interceptor
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const openAuditViewer = async (org: Organization) => {
    setAuditOrg(org);
    setIsAuditLoading(true);
    try {
      const response = await superAdminApi.getOrganizationAudit(org.id, 120);
      setAuditLogs((response.data || []) as OrgAuditLog[]);
    } catch {
      setAuditLogs([]);
    } finally {
      setIsAuditLoading(false);
    }
  };

  const openBillingViewer = async (org: Organization) => {
    setBillingOrg(org);
    setIsBillingLoading(true);
    try {
      const response = await superAdminApi.getOrganizationBilling(org.id, 90);
      setBillingSummary((response.data || null) as OrgBillingSummary | null);
    } catch {
      setBillingSummary(null);
    } finally {
      setIsBillingLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Organization Management
          </h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
            Manage all tenant organizations and their admin users
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={refetch}
            isLoading={isLoading}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            New Organization
          </Button>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {[
          { label: 'Total Organizations', value: total, icon: Building2, color: 'blue' },
          { label: 'Active', value: activeCount, icon: CheckCircle, color: 'green' },
          { label: 'Inactive', value: inactiveCount, icon: XCircle, color: 'red' },
          { label: 'Suspended', value: suspendedCount, icon: PauseCircle, color: 'amber' },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg bg-${stat.color}-100 dark:bg-${stat.color}-900/30 flex items-center justify-center`}>
                <stat.icon className={`h-5 w-5 text-${stat.color}-600 dark:text-${stat.color}-400`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(stat.value)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      {/* Search and Filters */}
      <Card>
        <div className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name, code, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>
            <div className="flex gap-2">
              {[
                { label: 'All', value: undefined },
                { label: 'Active', value: true },
                { label: 'Inactive', value: false },
              ].map((f) => (
                <button
                  key={String(f.label)}
                  onClick={() => setActiveFilter(f.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeFilter === f.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <button
                onClick={() => setShowDeleted((v) => !v)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showDeleted
                    ? 'bg-rose-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {showDeleted ? 'Hide Deleted' : 'Show Deleted'}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Organizations Table */}
      <Card>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-16 text-center">
              <RefreshCw className="h-8 w-8 mx-auto text-blue-500 animate-spin mb-3" />
              <p className="text-gray-500 dark:text-gray-400">Loading organizations...</p>
            </div>
          ) : organizations.length === 0 ? (
            <div className="py-16 text-center">
              <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">No organizations found</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                {searchQuery ? 'Try a different search term' : 'Create your first organization to get started'}
              </p>
              {!searchQuery && (
                <Button
                  variant="primary"
                  className="mt-4"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  New Organization
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  {['Organization', 'Contact', 'Location', 'Tier', 'Status', 'Created', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="text-left py-4 px-6 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {organizations.map((org) => (
                  <motion.tr
                    key={org.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {/* Organization */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                          {(org.code || org.name).substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{org.name}</div>
                          <code className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                            {org.code}
                          </code>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="py-4 px-6">
                      <div className="text-sm">
                        <div className="text-gray-900 dark:text-white">{org.email || '—'}</div>
                        <div className="text-gray-500 dark:text-gray-400">{org.phone || '—'}</div>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-4 px-6 text-sm text-gray-700 dark:text-gray-300">
                      {[org.city, org.state, org.country].filter(Boolean).join(', ') || '—'}
                    </td>

                    {/* Tier */}
                    <td className="py-4 px-6">
                      <Badge variant={TIER_BADGE[org.subscriptionTier || 'standard'] || 'default'}>
                        {org.subscriptionTier || 'standard'}
                      </Badge>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1">
                        <Badge variant={org.suspendedAt ? 'error' : org.isActive ? 'success' : 'warning'}>
                          {org.suspendedAt ? 'Suspended' : org.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {org.isDeleted && <Badge variant="error">Deleted</Badge>}
                      </div>
                    </td>

                    {/* Created */}
                    <td className="py-4 px-6 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(new Date(org.createdAt), 'MMM dd, yyyy')}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6">
                      <Dropdown
                        align="right"
                        side="top"
                        trigger={
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        }
                        items={[
                          {
                            label: 'Manage Users',
                            value: 'users',
                            icon: <Users className="h-4 w-4" />,
                          },
                          {
                            label: 'Suspend',
                            value: 'suspend',
                            icon: <PauseCircle className="h-4 w-4" />,
                          },
                          {
                            label: 'Reactivate',
                            value: 'reactivate',
                            icon: <PlayCircle className="h-4 w-4" />,
                          },
                          {
                            label: 'View Audit Log',
                            value: 'audit',
                            icon: <ClipboardList className="h-4 w-4" />,
                          },
                          {
                            label: 'View Billing',
                            value: 'billing',
                            icon: <Receipt className="h-4 w-4" />,
                          },
                          {
                            label: 'Edit',
                            value: 'edit',
                            icon: <Edit className="h-4 w-4" />,
                          },
                          {
                            label: org.isActive ? 'Deactivate' : 'Already Inactive',
                            value: 'delete',
                            icon: <Trash2 className="h-4 w-4" />,
                            danger: true,
                          },
                        ]}
                        onSelect={(value) => {
                          if (value === 'edit') setEditingOrg(org);
                          if (value === 'audit') void openAuditViewer(org);
                          if (value === 'billing') void openBillingViewer(org);
                          if (value === 'suspend' && !org.suspendedAt && !org.isDeleted) setSuspendOrg(org);
                          if (value === 'reactivate' && Boolean(org.suspendedAt) && !org.isDeleted) setReactivateOrg(org);
                          if (value === 'delete' && org.isActive) setDeletingOrg(org);
                        }}
                      />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Modals */}
      <CreateOrgModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={refetch}
      />

      <EditOrgModal
        isOpen={Boolean(editingOrg)}
        onClose={() => setEditingOrg(null)}
        onSuccess={refetch}
        organization={editingOrg}
      />

      {/* Confirm Deactivate Modal */}
      <Modal
        isOpen={Boolean(deletingOrg)}
        onClose={() => setDeletingOrg(null)}
        title="Deactivate Organization"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            Are you sure you want to deactivate{' '}
            <span className="font-semibold text-gray-900 dark:text-white">{deletingOrg?.name}</span>?
            All users in this organization will lose access.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeletingOrg(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} isLoading={isDeleting}>
              Deactivate
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(suspendOrg)}
        onClose={() => {
          setSuspendOrg(null);
          setSuspendReason('');
        }}
        title="Suspend Organization"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Suspend <span className="font-semibold">{suspendOrg?.name}</span>. Users will be blocked from login until reactivation.
          </p>
          <Input
            label="Reason *"
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="Compliance hold, payment issue, policy breach..."
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setSuspendOrg(null)} disabled={isSubmittingAction}>Cancel</Button>
            <Button variant="destructive" onClick={handleSuspend} isLoading={isSubmittingAction}>Suspend</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(reactivateOrg)}
        onClose={() => setReactivateOrg(null)}
        title="Reactivate Organization"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Reactivate <span className="font-semibold">{reactivateOrg?.name}</span> and restore tenant access.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setReactivateOrg(null)} disabled={isSubmittingAction}>Cancel</Button>
            <Button variant="primary" onClick={handleReactivate} isLoading={isSubmittingAction}>Reactivate</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(auditOrg)}
        onClose={() => setAuditOrg(null)}
        title={`Audit Log${auditOrg ? ` - ${auditOrg.name}` : ''}`}
        size="lg"
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {isAuditLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading audit timeline...</p>
          ) : auditLogs.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No audit records available for this organization.</p>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="info">{log.action}</Badge>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>
                  <p className="text-sm mt-2 text-gray-700 dark:text-gray-300">
                    Actor: {log.performed_by_name || 'System'} ({log.performed_by_role || 'unknown'})
                  </p>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-800 rounded p-2 overflow-x-auto text-gray-700 dark:text-gray-300">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setAuditOrg(null)}>Close</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(billingOrg)}
        onClose={() => setBillingOrg(null)}
        title={`Billing Summary${billingOrg ? ` - ${billingOrg.name}` : ''}`}
        size="md"
      >
        <div className="space-y-4">
          {isBillingLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading billing summary...</p>
          ) : !billingSummary ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No billing data available.</p>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">Last {billingSummary.rangeDays} days</p>
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Invoices</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatNumber(billingSummary.invoiceCount)}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Billed</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatNumber(billingSummary.billedAmount)}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Paid</p>
                  <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{formatNumber(billingSummary.paidAmount)}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Open</p>
                  <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">{formatNumber(billingSummary.openAmount)}</p>
                </Card>
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm">
                <p className="text-gray-600 dark:text-gray-300">Refunds: <span className="font-medium">{formatNumber(billingSummary.refundsAmount)}</span></p>
                <p className="text-gray-600 dark:text-gray-300 mt-1">Avg invoice: <span className="font-medium">{formatNumber(billingSummary.avgInvoiceAmount)}</span></p>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  Last invoice: <span className="font-medium">{billingSummary.lastInvoice?.invoiceNumber || '—'}</span>
                  {billingSummary.lastInvoice ? ` (${billingSummary.lastInvoice.status})` : ''}
                </p>
              </div>
            </>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setBillingOrg(null)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
