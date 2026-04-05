import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle, PauseCircle, RefreshCw, Siren, Plus, Trash2, UserCheck } from 'lucide-react';
import { Card, Badge, Button, Skeleton, Modal, Input, Select } from '@/components/ui';
import { superAdminApi } from '@/api/services';
import { formatDate, formatNumber } from '@/lib/utils';
import { toast } from '@/stores/toastStore';
import { Link } from 'react-router-dom';

interface GlobalStats {
  tenants: { total: number; active: number; suspended: number; deleted: number };
  users: { totalActive: number };
  orders: { total: number; last30d: number };
  shipments: { active: number; last30d: number };
  alerts: { active: number };
  revenue: { last30d: number };
  atRiskTenants: Array<{
    id: string;
    name: string;
    code: string;
    isActive: boolean;
    suspendedAt?: string | null;
    slaViolations30d: number;
    openExceptions: number;
    activeUsers: number;
    lastUserLogin?: string | null;
  }>;
}

interface IncidentBanner {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  is_active: boolean;
  created_at: string;
  starts_at?: string | null;
  ends_at?: string | null;
}

export function SystemHealthPage() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [incidents, setIncidents] = useState<IncidentBanner[]>([]);
  const [isIncidentsLoading, setIsIncidentsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<IncidentBanner | null>(null);
  const [isSavingBanner, setIsSavingBanner] = useState(false);
  const [bannerForm, setBannerForm] = useState({
    title: '',
    message: '',
    severity: 'warning' as 'info' | 'warning' | 'critical',
    starts_at: '',
    ends_at: '',
  });

  const loadStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await superAdminApi.getGlobalStats();
      setStats(response.data as GlobalStats);
    } catch {
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadIncidents = useCallback(async () => {
    try {
      setIsIncidentsLoading(true);
      const response = await superAdminApi.listIncidentBanners();
      setIncidents((response.data || []) as IncidentBanner[]);
    } catch {
      setIncidents([]);
    } finally {
      setIsIncidentsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
    void loadIncidents();
  }, [loadStats, loadIncidents]);

  const healthLabel = useMemo(() => {
    if (!stats) return 'Unknown';
    if (stats.alerts.active > 5) return 'At Risk';
    if (stats.alerts.active > 0) return 'Warning';
    return 'Healthy';
  }, [stats]);

  const lifecycle = useMemo(() => {
    if (!stats) return null;
    const liveTenants = Math.max(stats.tenants.total, 0);
    const suspended = Math.max(stats.tenants.suspended, 0);
    const inactive = Math.max(liveTenants - stats.tenants.active - suspended, 0);
    const actionRequired = inactive + suspended;

    return {
      liveTenants,
      active: stats.tenants.active,
      inactive,
      suspended,
      deleted: stats.tenants.deleted,
      actionRequired,
      suspensionRate: liveTenants > 0 ? ((suspended / liveTenants) * 100).toFixed(1) : '0.0',
    };
  }, [stats]);

  const handleCreateIncidentBanner = async () => {
    if (!bannerForm.title.trim() || !bannerForm.message.trim()) {
      toast.error('Validation Error', 'Title and message are required');
      return;
    }

    try {
      setIsSavingBanner(true);
      await superAdminApi.createIncidentBanner({
        title: bannerForm.title.trim(),
        message: bannerForm.message.trim(),
        severity: bannerForm.severity,
        starts_at: bannerForm.starts_at ? new Date(bannerForm.starts_at).toISOString() : undefined,
        ends_at: bannerForm.ends_at ? new Date(bannerForm.ends_at).toISOString() : undefined,
      });
      toast.success('Incident Banner Published', 'Global incident banner is now active');
      setIsCreateModalOpen(false);
      setBannerForm({ title: '', message: '', severity: 'warning', starts_at: '', ends_at: '' });
      await loadIncidents();
    } catch {
      // handled by interceptor
    } finally {
      setIsSavingBanner(false);
    }
  };

  const handleToggleIncidentBanner = async (banner: IncidentBanner) => {
    try {
      await superAdminApi.updateIncidentBanner(banner.id, { is_active: !banner.is_active });
      toast.success(
        banner.is_active ? 'Incident Banner Disabled' : 'Incident Banner Re-Enabled',
        banner.title
      );
      await loadIncidents();
    } catch {
      // handled by interceptor
    }
  };

  const handleUpdateIncidentBanner = async () => {
    if (!editingBanner) return;
    if (!bannerForm.title.trim() || !bannerForm.message.trim()) {
      toast.error('Validation Error', 'Title and message are required');
      return;
    }

    try {
      setIsSavingBanner(true);
      await superAdminApi.updateIncidentBanner(editingBanner.id, {
        title: bannerForm.title.trim(),
        message: bannerForm.message.trim(),
        severity: bannerForm.severity,
        starts_at: bannerForm.starts_at ? new Date(bannerForm.starts_at).toISOString() : null,
        ends_at: bannerForm.ends_at ? new Date(bannerForm.ends_at).toISOString() : null,
      });
      toast.success('Incident Banner Updated', editingBanner.title);
      setEditingBanner(null);
      setBannerForm({ title: '', message: '', severity: 'warning', starts_at: '', ends_at: '' });
      await loadIncidents();
    } catch {
      // handled by interceptor
    } finally {
      setIsSavingBanner(false);
    }
  };

  const openEditBannerModal = (banner: IncidentBanner) => {
    const toLocalDateTime = (iso?: string | null) => {
      if (!iso) return '';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setEditingBanner(banner);
    setBannerForm({
      title: banner.title,
      message: banner.message,
      severity: banner.severity,
      starts_at: toLocalDateTime(banner.starts_at),
      ends_at: toLocalDateTime(banner.ends_at),
    });
  };

  const handleRefreshAll = async () => {
    await Promise.all([loadStats(), loadIncidents()]);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">System Health</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
            Platform reliability and tenant lifecycle health.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} isLoading={isLoading || isIncidentsLoading} onClick={() => void handleRefreshAll()}>
            Refresh
          </Button>
          <Link to="/super-admin/dashboard">
            <Button variant="outline">Dashboard</Button>
          </Link>
          <Link to="/super-admin/companies">
            <Button variant="outline">Companies</Button>
          </Link>
          <Link to="/super-admin/users">
            <Button variant="primary">System Users</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading && Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx} className="p-4"><Skeleton className="h-16 w-full" /></Card>
        ))}

        {!isLoading && stats && (
          <>
            <Card className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Platform Health</p>
              <div className="mt-2 flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-600" />
                <Badge variant={healthLabel === 'Healthy' ? 'success' : healthLabel === 'Warning' ? 'warning' : 'error'}>{healthLabel}</Badge>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{formatNumber(stats.alerts.active)} active alerts</p>
            </Card>

            <Card className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Active Tenants</p>
              <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">{formatNumber(stats.tenants.active)}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">of {formatNumber(stats.tenants.total)} total</p>
            </Card>

            <Card className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Suspended Tenants</p>
              <div className="mt-2 flex items-center gap-2">
                <PauseCircle className="h-4 w-4 text-orange-600" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(stats.tenants.suspended)}</p>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{lifecycle?.suspensionRate || '0.0'}% of tenant base</p>
            </Card>

            <Card className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Active Users</p>
              <div className="mt-2 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-purple-600" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(stats.users.totalActive)}</p>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">users currently enabled</p>
            </Card>
          </>
        )}
      </div>

      <Card>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Siren className="h-4 w-4 text-orange-600" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Incident Banner Control</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              isLoading={isIncidentsLoading}
              onClick={() => void loadIncidents()}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              New Banner
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {isIncidentsLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => <Skeleton key={idx} className="h-10 w-full" />)}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Title</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Severity</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Window</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Created</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {incidents.slice(0, 10).map((banner) => (
                  <tr key={banner.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900 dark:text-white">{banner.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-md">{banner.message}</p>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={banner.severity === 'critical' ? 'error' : banner.severity === 'warning' ? 'warning' : 'info'}>
                        {banner.severity}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {banner.starts_at ? formatDate(new Date(banner.starts_at), 'MMM dd, yyyy HH:mm') : 'Immediate'}
                      {' - '}
                      {banner.ends_at ? formatDate(new Date(banner.ends_at), 'MMM dd, yyyy HH:mm') : 'Open'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(new Date(banner.created_at), 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={banner.is_active ? 'success' : 'default'}>
                        {banner.is_active ? 'active' : 'inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditBannerModal(banner)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={banner.is_active ? 'outline' : 'primary'}
                          onClick={() => void handleToggleIncidentBanner(banner)}
                        >
                          {banner.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {incidents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No incident banners configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Card>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Tenant Lifecycle Summary</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => <Skeleton key={idx} className="h-10 w-full" />)}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Metric</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Value</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Operational Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {lifecycle && (
                  <>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">Total Tenants</td>
                      <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">{formatNumber(lifecycle.liveTenants)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">All organizations currently tracked</td>
                    </tr>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">Inactive Tenants</td>
                      <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">{formatNumber(lifecycle.inactive)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">Candidates for reactivation follow-up</td>
                    </tr>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">Suspended Tenants</td>
                      <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">{formatNumber(lifecycle.suspended)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{lifecycle.suspensionRate}% suspension rate</td>
                    </tr>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">Deleted Tenants</td>
                      <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                        <span className="inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5 text-rose-600" />{formatNumber(lifecycle.deleted)}</span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">Soft-deleted organizations</td>
                    </tr>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">Action Required</td>
                      <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">{formatNumber(lifecycle.actionRequired)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">Inactive + suspended tenants pending admin action</td>
                    </tr>
                  </>
                )}
                {!lifecycle && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No tenant lifecycle data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Publish Incident Banner"
        description="Create a global notice shown to active users."
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={bannerForm.title}
            onChange={(e) => setBannerForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Service degradation in eu-west"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Message</label>
            <textarea
              value={bannerForm.message}
              onChange={(e) => setBannerForm((prev) => ({ ...prev, message: e.target.value }))}
              rows={4}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="We are investigating elevated API latency. Next update in 20 minutes."
            />
          </div>
          <Select
            label="Severity"
            value={bannerForm.severity}
            onChange={(e) => setBannerForm((prev) => ({ ...prev, severity: e.target.value as 'info' | 'warning' | 'critical' }))}
            options={[
              { value: 'info', label: 'Info' },
              { value: 'warning', label: 'Warning' },
              { value: 'critical', label: 'Critical' },
            ]}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Starts At (optional)"
              type="datetime-local"
              value={bannerForm.starts_at}
              onChange={(e) => setBannerForm((prev) => ({ ...prev, starts_at: e.target.value }))}
            />
            <Input
              label="Ends At (optional)"
              type="datetime-local"
              value={bannerForm.ends_at}
              onChange={(e) => setBannerForm((prev) => ({ ...prev, ends_at: e.target.value }))}
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button variant="primary" isLoading={isSavingBanner} onClick={() => void handleCreateIncidentBanner()}>
              Publish Banner
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(editingBanner)}
        onClose={() => {
          setEditingBanner(null);
          setBannerForm({ title: '', message: '', severity: 'warning', starts_at: '', ends_at: '' });
        }}
        title="Edit Incident Banner"
        description="Update active content and timing window."
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={bannerForm.title}
            onChange={(e) => setBannerForm((prev) => ({ ...prev, title: e.target.value }))}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Message</label>
            <textarea
              value={bannerForm.message}
              onChange={(e) => setBannerForm((prev) => ({ ...prev, message: e.target.value }))}
              rows={4}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <Select
            label="Severity"
            value={bannerForm.severity}
            onChange={(e) => setBannerForm((prev) => ({ ...prev, severity: e.target.value as 'info' | 'warning' | 'critical' }))}
            options={[
              { value: 'info', label: 'Info' },
              { value: 'warning', label: 'Warning' },
              { value: 'critical', label: 'Critical' },
            ]}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Starts At"
              type="datetime-local"
              value={bannerForm.starts_at}
              onChange={(e) => setBannerForm((prev) => ({ ...prev, starts_at: e.target.value }))}
            />
            <Input
              label="Ends At"
              type="datetime-local"
              value={bannerForm.ends_at}
              onChange={(e) => setBannerForm((prev) => ({ ...prev, ends_at: e.target.value }))}
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditingBanner(null)}>Cancel</Button>
            <Button variant="primary" isLoading={isSavingBanner} onClick={() => void handleUpdateIncidentBanner()}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
