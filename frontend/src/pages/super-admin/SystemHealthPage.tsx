import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, RefreshCw, ShieldAlert, Siren, Plus } from 'lucide-react';
import { Card, Badge, Button, Skeleton, Modal, Input, Select } from '@/components/ui';
import { superAdminApi } from '@/api/services';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { toast } from '@/stores/toastStore';

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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">System Health</h1>
        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
          Tenant risk, platform throughput, and incident pressure.
        </p>
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
              <p className="text-xs text-gray-500 uppercase tracking-wide">Tenant State</p>
              <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">{formatNumber(stats.tenants.active)}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">active of {formatNumber(stats.tenants.total)}</p>
            </Card>

            <Card className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Ops Throughput (30d)</p>
              <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">{formatNumber(stats.orders.last30d)}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">orders, {formatNumber(stats.shipments.last30d)} shipments</p>
            </Card>

            <Card className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Revenue (30d)</p>
              <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">{formatCurrency(stats.revenue.last30d)}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{formatNumber(stats.users.totalActive)} active users</p>
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
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Tenant Risk Watchlist</h2>
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
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Tenant</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">SLA Violations</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Open Exceptions</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Users</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {(stats?.atRiskTenants || []).map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900 dark:text-white">{t.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t.code}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">{formatNumber(t.slaViolations30d)}</td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">{formatNumber(t.openExceptions)}</td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">{formatNumber(t.activeUsers)}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {t.lastUserLogin ? formatDate(new Date(t.lastUserLogin), 'MMM dd, yyyy HH:mm') : 'No recent login'}
                    </td>
                  </tr>
                ))}
                {(stats?.atRiskTenants?.length || 0) === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      <AlertTriangle className="h-4 w-4 inline mr-2" />
                      No high-risk tenants detected.
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
        isOpen={!!editingBanner}
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
