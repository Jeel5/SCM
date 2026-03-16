import { motion } from 'framer-motion';
import {
  Building2,
  Users,
  ShoppingCart,
  Truck,
  TrendingUp,
  Activity,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { Card, Badge, Button, Skeleton } from '@/components/ui';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';
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
  orders: {
    total: number;
    last30d: number;
  };
  shipments: {
    active: number;
    last30d: number;
  };
  alerts: {
    active: number;
  };
  revenue: {
    last30d: number;
  };
  atRiskTenants: Array<{
    id: string;
    name: string;
    code: string;
    subscriptionTier?: string;
    isActive: boolean;
    suspendedAt?: string | null;
    slaViolations30d: number;
    openExceptions: number;
    activeUsers: number;
    lastUserLogin?: string | null;
  }>;
}

export function SuperAdminDashboard() {
  const { organizations, isLoading: loadingOrganizations } = useOrganizations({ page: 1, limit: 8 });
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

  const metrics = useMemo(() => {
    if (!stats) return null;
    return [
      {
        title: 'Total Tenants',
        value: formatNumber(stats.tenants.total),
        subtitle: `${stats.tenants.active} active, ${stats.tenants.suspended} suspended`,
        icon: <Building2 className="h-6 w-6 text-indigo-600" />,
        iconBg: 'bg-indigo-100',
      },
      {
        title: 'Active Users',
        value: formatNumber(stats.users.totalActive),
        subtitle: 'Across all tenants',
        icon: <Users className="h-6 w-6 text-purple-600" />,
        iconBg: 'bg-purple-100',
      },
      {
        title: 'Orders (30d)',
        value: formatNumber(stats.orders.last30d),
        subtitle: `${formatNumber(stats.orders.total)} total`,
        icon: <ShoppingCart className="h-6 w-6 text-blue-600" />,
        iconBg: 'bg-blue-100',
      },
      {
        title: 'Active Shipments',
        value: formatNumber(stats.shipments.active),
        subtitle: `${formatNumber(stats.shipments.last30d)} created in 30d`,
        icon: <Truck className="h-6 w-6 text-emerald-600" />,
        iconBg: 'bg-emerald-100',
      },
      {
        title: 'Revenue (30d)',
        value: formatCurrency(stats.revenue.last30d),
        subtitle: 'Across all tenants',
        icon: <DollarSign className="h-6 w-6 text-green-600" />,
        iconBg: 'bg-green-100',
      },
      {
        title: 'Suspended Tenants',
        value: formatNumber(stats.tenants.suspended),
        subtitle: `${formatNumber(stats.tenants.deleted)} deleted`,
        icon: <TrendingUp className="h-6 w-6 text-amber-600" />,
        iconBg: 'bg-amber-100',
      },
      {
        title: 'System Health',
        value: stats.alerts.active > 0 ? 'Warning' : 'Healthy',
        subtitle: `${formatNumber(stats.alerts.active)} active alerts`,
        icon: <Activity className="h-6 w-6 text-cyan-600" />,
        iconBg: 'bg-cyan-100',
      },
      {
        title: 'At-Risk Tenants',
        value: formatNumber(stats.atRiskTenants.length),
        subtitle: 'Based on SLA + open exceptions',
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

      {/* Tenant Risk Table */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tenant Risk Watchlist</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Highest SLA violations and unresolved exception load in the last 30 days
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tenant</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">SLA Violations (30d)</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Open Exceptions</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Users</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {(stats?.atRiskTenants || []).map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900 dark:text-white">{tenant.name}</div>
                      <code className="text-xs text-gray-500 dark:text-gray-400">{tenant.code}</code>
                    </td>
                    <td className="py-4 px-4 text-gray-900 dark:text-white">{formatNumber(tenant.slaViolations30d)}</td>
                    <td className="py-4 px-4 text-gray-900 dark:text-white">{formatNumber(tenant.openExceptions)}</td>
                    <td className="py-4 px-4 text-gray-900 dark:text-white">{formatNumber(tenant.activeUsers)}</td>
                    <td className="py-4 px-4 text-sm text-gray-500 dark:text-gray-400">
                      {tenant.lastUserLogin ? formatDate(new Date(tenant.lastUserLogin), 'MMM dd, HH:mm') : 'No recent login'}
                    </td>
                  </tr>
                ))}
                {!loadingStats && (stats?.atRiskTenants?.length || 0) === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No risk signals detected</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

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
                    Users
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Orders
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    SLA
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Activity
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loadingOrganizations && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading organizations...</td>
                  </tr>
                )}

                {!loadingOrganizations && organizations.map((org) => (
                  <tr
                    key={org.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {org.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {org.subscriptionTier || 'standard'} plan
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        {org.code}
                      </code>
                    </td>
                    <td className="py-4 px-4 text-gray-900 dark:text-white">
                      -
                    </td>
                    <td className="py-4 px-4 text-gray-900 dark:text-white">
                      -
                    </td>
                    <td className="py-4 px-4 text-gray-900 dark:text-white">
                      -
                    </td>
                    <td className="py-4 px-4">
                      -
                    </td>
                    <td className="py-4 px-4">
                      <Badge
                        variant={
                          org.isActive
                            ? 'success'
                            : 'warning'
                        }
                      >
                        {org.isActive ? 'active' : 'inactive'}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(new Date(org.updatedAt || org.createdAt), 'MMM dd, HH:mm')}
                    </td>
                  </tr>
                ))}
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
