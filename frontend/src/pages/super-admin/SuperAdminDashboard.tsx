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
import { Card, Badge, Button } from '@/components/ui';
import { formatCurrency, formatNumber, formatPercentage, formatDate } from '@/lib/utils';
import { useState } from 'react';
import { Link } from 'react-router-dom';

interface GlobalMetrics {
  totalCompanies: number;
  activeCompanies: number;
  totalUsers: number;
  totalOrders: number;
  totalShipments: number;
  totalRevenue: number;
  avgSlaCompliance: number;
  systemHealth: number;
}

interface CompanySummary {
  id: string;
  name: string;
  code: string;
  admins: number;
  users: number;
  orders: number;
  revenue: number;
  slaCompliance: number;
  status: 'active' | 'inactive' | 'suspended';
  lastActivity: string;
}

// Static timestamps for mock data (calculated once)
const ONE_HOUR_AGO = new Date(Date.now() - 3600000).toISOString();
const TWO_HOURS_AGO = new Date(Date.now() - 7200000).toISOString();
const ONE_WEEK_AGO = new Date(Date.now() - 86400000 * 7).toISOString();

export function SuperAdminDashboard() {
  const [metrics] = useState<GlobalMetrics>({
    totalCompanies: 12,
    activeCompanies: 11,
    totalUsers: 156,
    totalOrders: 8547,
    totalShipments: 7123,
    totalRevenue: 4250000,
    avgSlaCompliance: 94.5,
    systemHealth: 99.2,
  });

  const [companies] = useState<CompanySummary[]>([
    {
      id: '1',
      name: 'TwinChain Demo',
      code: 'DEMO001',
      admins: 1,
      users: 7,
      orders: 2547,
      revenue: 1250000,
      slaCompliance: 96.5,
      status: 'active',
      lastActivity: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Acme Corporation',
      code: 'ACME001',
      admins: 2,
      users: 15,
      orders: 3890,
      revenue: 1890000,
      slaCompliance: 94.2,
      status: 'active',
      lastActivity: ONE_HOUR_AGO,
    },
    {
      id: '3',
      name: 'Global Logistics Inc',
      code: 'GLI001',
      admins: 1,
      users: 12,
      orders: 1234,
      revenue: 780000,
      slaCompliance: 92.8,
      status: 'active',
      lastActivity: TWO_HOURS_AGO,
    },
    {
      id: '4',
      name: 'FastShip Limited',
      code: 'FSL001',
      admins: 1,
      users: 8,
      orders: 876,
      revenue: 330000,
      slaCompliance: 88.5,
      status: 'inactive',
      lastActivity: ONE_WEEK_AGO,
    },
  ]);

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
        <MetricCard
          title="Total Companies"
          value={formatNumber(metrics.totalCompanies)}
          subtitle={`${metrics.activeCompanies} active`}
          icon={<Building2 className="h-6 w-6 text-indigo-600" />}
          iconBg="bg-indigo-100"
        />
        <MetricCard
          title="Total Users"
          value={formatNumber(metrics.totalUsers)}
          subtitle="Across all companies"
          icon={<Users className="h-6 w-6 text-purple-600" />}
          iconBg="bg-purple-100"
        />
        <MetricCard
          title="Total Orders"
          value={formatNumber(metrics.totalOrders)}
          subtitle="All time"
          icon={<ShoppingCart className="h-6 w-6 text-blue-600" />}
          iconBg="bg-blue-100"
        />
        <MetricCard
          title="Total Shipments"
          value={formatNumber(metrics.totalShipments)}
          subtitle="Active + Delivered"
          icon={<Truck className="h-6 w-6 text-emerald-600" />}
          iconBg="bg-emerald-100"
        />
        <MetricCard
          title="Global Revenue"
          value={formatCurrency(metrics.totalRevenue)}
          subtitle="Combined"
          icon={<DollarSign className="h-6 w-6 text-green-600" />}
          iconBg="bg-green-100"
        />
        <MetricCard
          title="Avg SLA Compliance"
          value={formatPercentage(metrics.avgSlaCompliance)}
          subtitle="Across companies"
          icon={<TrendingUp className="h-6 w-6 text-amber-600" />}
          iconBg="bg-amber-100"
        />
        <MetricCard
          title="System Health"
          value={formatPercentage(metrics.systemHealth)}
          subtitle="All services"
          icon={<Activity className="h-6 w-6 text-cyan-600" />}
          iconBg="bg-cyan-100"
        />
        <MetricCard
          title="Active Issues"
          value="3"
          subtitle="Require attention"
          icon={<AlertCircle className="h-6 w-6 text-rose-600" />}
          iconBg="bg-rose-100"
        />
      </div>

      {/* Companies Overview */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Companies Overview
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Performance metrics for all registered companies
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
                {companies.map((company) => (
                  <tr
                    key={company.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {company.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {company.admins} {company.admins === 1 ? 'admin' : 'admins'}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        {company.code}
                      </code>
                    </td>
                    <td className="py-4 px-4 text-gray-900 dark:text-white">
                      {company.users}
                    </td>
                    <td className="py-4 px-4 text-gray-900 dark:text-white">
                      {formatNumber(company.orders)}
                    </td>
                    <td className="py-4 px-4 text-gray-900 dark:text-white">
                      {formatCurrency(company.revenue)}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-sm font-medium ${
                          company.slaCompliance >= 95
                            ? 'text-green-600'
                            : company.slaCompliance >= 90
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {formatPercentage(company.slaCompliance)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <Badge
                        variant={
                          company.status === 'active'
                            ? 'success'
                            : company.status === 'inactive'
                            ? 'warning'
                            : 'error'
                        }
                      >
                        {company.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(new Date(company.lastActivity), 'MMM dd, HH:mm')}
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
