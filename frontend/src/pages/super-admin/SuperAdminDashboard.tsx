import { motion } from 'framer-motion';
import {
  Building2,
  Users,
  Activity,
  AlertCircle,
  CheckCircle,
  PauseCircle,
  Trash2,
  UserCheck,
  RefreshCw,
} from 'lucide-react';
import { Card, Badge, Button, Skeleton } from '@/components/ui';
import { formatNumber, formatDate } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { superAdminApi } from '@/api/services';
import { notifyLoadError } from '@/lib/apiErrors';
import { useOrganizations } from './hooks/useOrganizations';

interface DashboardStats {
  tenants: {
    total: number;
    active: number;
    suspended: number;
    deleted: number;
  };
  users: {
    totalActive: number;
  };
  alerts: {
    active: number;
  };
}

export function SuperAdminDashboard() {
  const { organizations, isLoading: loadingOrganizations, refetch } = useOrganizations({ page: 1, limit: 8 });
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoadingStats(true);
        const response = await superAdminApi.getGlobalStats();
        if (mounted) setStats(response.data as DashboardStats);
      } catch (error) {
        notifyLoadError('statistics', error);
      } finally {
        if (mounted) setLoadingStats(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleRefresh = async () => {
    await Promise.all([refetch(), (async () => {
      try {
        setLoadingStats(true);
        const response = await superAdminApi.getGlobalStats();
        setStats(response.data as DashboardStats);
      } catch (error) {
        notifyLoadError('statistics', error);
      } finally {
        setLoadingStats(false);
      }
    })()]);
  };

  const metrics = useMemo(() => {
    if (!stats) return null;

    const liveTenants = Math.max(stats.tenants.total, 0);
    const suspendedTenants = Math.max(stats.tenants.suspended, 0);
    const inactiveTenants = Math.max(liveTenants - stats.tenants.active - suspendedTenants, 0);
    const actionRequired = inactiveTenants + suspendedTenants;
    const suspensionRate = liveTenants > 0
      ? `${((suspendedTenants / liveTenants) * 100).toFixed(1)}% suspension rate`
      : 'No live tenants yet';
    const avgUsersPerTenant = liveTenants > 0
      ? `${(stats.users.totalActive / liveTenants).toFixed(1)} avg active users / tenant`
      : 'No tenant users yet';

    return [
      {
        title: 'Total Tenants',
        value: formatNumber(liveTenants),
        subtitle: `${formatNumber(stats.tenants.active)} active`,
        icon: <Building2 className="h-6 w-6 text-indigo-600" />,
        iconBg: 'bg-indigo-100',
      },
      {
        title: 'Active Tenants',
        value: formatNumber(stats.tenants.active),
        subtitle: liveTenants > 0
          ? `${((stats.tenants.active / liveTenants) * 100).toFixed(1)}% of live tenants`
          : 'No live tenants yet',
        icon: <CheckCircle className="h-6 w-6 text-emerald-600" />,
        iconBg: 'bg-emerald-100',
      },
      {
        title: 'Inactive Tenants',
        value: formatNumber(inactiveTenants),
        subtitle: 'Live but currently inactive',
        icon: <Activity className="h-6 w-6 text-amber-600" />,
        iconBg: 'bg-amber-100',
      },
      {
        title: 'Suspended Tenants',
        value: formatNumber(suspendedTenants),
        subtitle: suspensionRate,
        icon: <PauseCircle className="h-6 w-6 text-orange-600" />,
        iconBg: 'bg-orange-100',
      },
      {
        title: 'Deleted Tenants',
        value: formatNumber(stats.tenants.deleted),
        subtitle: 'Soft-deleted organizations',
        icon: <Trash2 className="h-6 w-6 text-rose-600" />,
        iconBg: 'bg-rose-100',
      },
      {
        title: 'Active Users',
        value: formatNumber(stats.users.totalActive),
        subtitle: avgUsersPerTenant,
        icon: <UserCheck className="h-6 w-6 text-purple-600" />,
        iconBg: 'bg-purple-100',
      },
      {
        title: 'System Health',
        value: stats.alerts.active > 0 ? 'Warning' : 'Healthy',
        subtitle: `${formatNumber(stats.alerts.active)} active platform alerts`,
        icon: <Activity className="h-6 w-6 text-cyan-600" />,
        iconBg: 'bg-cyan-100',
      },
      {
        title: 'Action Required',
        value: formatNumber(actionRequired),
        subtitle: 'Inactive + suspended tenants',
        icon: <AlertCircle className="h-6 w-6 text-rose-600" />,
        iconBg: 'bg-rose-100',
      },
    ];
  }, [stats]);

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
            System Overview
          </h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
            Global dashboard for all companies and operations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} isLoading={loadingStats || loadingOrganizations} onClick={() => void handleRefresh()}>
            Refresh
          </Button>
          <Link to="/super-admin/users">
            <Button variant="outline" leftIcon={<Users className="h-4 w-4" />}>
              System Users
            </Button>
          </Link>
          <Link to="/super-admin/health">
            <Button variant="outline" leftIcon={<Activity className="h-4 w-4" />}>
              System Health
            </Button>
          </Link>
          <Link to="/super-admin/companies">
            <Button variant="primary" leftIcon={<Building2 className="h-4 w-4" />}>
              Manage Companies
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Global Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {(loadingStats || !metrics) && Array.from({ length: 8 }).map((_, i) => (
          <Card key={`skeleton-${i}`}>
            <div className="p-6 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-40" />
            </div>
          </Card>
        ))}

        {!loadingStats && metrics?.map((m) => (
          <MetricCard key={m.title} title={m.title} value={m.value} subtitle={m.subtitle} icon={m.icon} iconBg={m.iconBg} />
        ))}
      </div>

      {/* Organizations Overview */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Organizations Overview
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Live tenant list from the organizations domain
              </p>
            </div>
            <Link to="/super-admin/companies">
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loadingOrganizations && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading organizations...</td>
                  </tr>
                )}

                {!loadingOrganizations && organizations.map((org) => (
                  <tr
                    key={org.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900 dark:text-white">{org.name}</div>
                    </td>
                    <td className="py-4 px-4">
                      <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        {org.code}
                      </code>
                    </td>
                    <td className="py-4 px-4 text-gray-900 dark:text-white">{org.subscriptionTier || 'standard'}</td>
                    <td className="py-4 px-4 text-sm text-gray-700 dark:text-gray-300">{org.email || '—'}</td>
                    <td className="py-4 px-4">
                      <Badge
                        variant={org.isDeleted ? 'error' : org.suspendedAt ? 'error' : org.isActive ? 'success' : 'warning'}
                      >
                        {org.isDeleted ? 'deleted' : org.suspendedAt ? 'suspended' : org.isActive ? 'active' : 'inactive'}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(new Date(org.createdAt), 'MMM dd, yyyy')}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(new Date(org.updatedAt || org.createdAt), 'MMM dd, HH:mm')}
                    </td>
                  </tr>
                ))}

                {!loadingOrganizations && organizations.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No organizations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
}

function MetricCard({ title, value, subtitle, icon, iconBg }: MetricCardProps) {
  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {title}
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
              {value}
            </p>
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {subtitle}
              </p>
            )}
          </div>
          <div className={`${iconBg} p-3 rounded-lg`}>{icon}</div>
        </div>
      </div>
    </Card>
  );
}
