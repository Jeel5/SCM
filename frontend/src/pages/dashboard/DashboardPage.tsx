import { motion } from 'framer-motion';
import {
  ShoppingCart,
  Truck,
  Package,
  Timer,
  AlertTriangle,
  RotateCcw,
  DollarSign,
  Clock,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { Button, MetricCardSkeleton } from '@/components/ui';
import { formatCurrency, formatNumber, formatPercentage, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores';
import { MetricCard } from './components/MetricCard';
import { RecentShipments } from './components/RecentShipments';
import { CarrierPerformanceChart } from './components/CarrierPerformanceChart';
import { OrdersTrendChart } from './components/OrdersTrendChart';
import { WarehouseUtilizationChart } from './components/WarehouseUtilizationChart';
import { OrderStatusChart } from './components/OrderStatusChart';
import { TopProductsTable } from './components/TopProductsTable';
import { useDashboard } from './hooks/useDashboard';
import type { DashboardPeriod } from './hooks/useDashboard';
import { SuperAdminDashboard } from '@/pages/super-admin';

export function DashboardPage() {
  const { user } = useAuthStore();

  // If user is superadmin, show SuperAdmin dashboard instead
  if (user?.role === 'superadmin') {
    return <SuperAdminDashboard />;
  }

  const {
    metrics,
    ordersChart,
    shipments,
    carrierPerformance,
    warehouseUtilization,
    topProducts,
    isLoading,
    period,
    setPeriod,
    periodLabels,
    refetch,
  } = useDashboard();

  const periodOptions = Object.entries(periodLabels) as [DashboardPeriod, string][];

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
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
            Here's what's happening with your logistics.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Period selector */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {periodOptions.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                  period === key
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={refetch}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            title="Refresh dashboard"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <Button variant="outline" size="sm" leftIcon={<Calendar className="h-4 w-4" />}>
            {formatDate(new Date(), 'MMM dd, yyyy')}
          </Button>
        </div>
      </motion.div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : metrics ? (
          <>
            <MetricCard
              title="Total Orders"
              value={formatNumber(metrics.totalOrders)}
              change={metrics.ordersChange}
              icon={<ShoppingCart className="h-6 w-6 text-blue-600" />}
              iconBg="bg-blue-100"
              link="/orders"
            />
            <MetricCard
              title="Active Shipments"
              value={formatNumber(metrics.activeShipments)}
              change={metrics.shipmentsChange}
              icon={<Truck className="h-6 w-6 text-purple-600" />}
              iconBg="bg-purple-100"
              link="/shipments"
            />
            <MetricCard
              title="Delivery Rate"
              value={formatPercentage(metrics.deliveryRate)}
              change={metrics.deliveryRateChange}
              icon={<Package className="h-6 w-6 text-emerald-600" />}
              iconBg="bg-emerald-100"
            />
            <MetricCard
              title="SLA Compliance"
              value={formatPercentage(metrics.slaCompliance)}
              change={metrics.slaComplianceChange}
              icon={<Timer className="h-6 w-6 text-amber-600" />}
              iconBg="bg-amber-100"
              link="/sla"
            />
            <MetricCard
              title="Pending Returns"
              value={formatNumber(metrics.pendingReturns)}
              change={metrics.returnsChange}
              icon={<RotateCcw className="h-6 w-6 text-rose-600" />}
              iconBg="bg-rose-100"
              link="/returns"
            />
            <MetricCard
              title="Active Exceptions"
              value={formatNumber(metrics.activeExceptions)}
              change={metrics.exceptionsChange}
              icon={<AlertTriangle className="h-6 w-6 text-orange-600" />}
              iconBg="bg-orange-100"
              link="/exceptions"
            />
            <MetricCard
              title="Total Revenue"
              value={formatCurrency(metrics.revenue)}
              change={metrics.revenueChange}
              icon={<DollarSign className="h-6 w-6 text-green-600" />}
              iconBg="bg-green-100"
              link="/finance"
            />
            <MetricCard
              title="Avg. Delivery Time"
              value={`${metrics.avgDeliveryTime} days`}
              change={metrics.avgDeliveryTimeChange}
              icon={<Clock className="h-6 w-6 text-cyan-600" />}
              iconBg="bg-cyan-100"
            />
          </>
        ) : null}
      </div>

      {/* Charts Row 1: Orders Trend + Order Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <OrdersTrendChart data={ordersChart} />
        </div>
        <OrderStatusChart metrics={metrics} />
      </div>

      {/* Charts Row 2: Carrier Performance + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CarrierPerformanceChart data={carrierPerformance} />
        <TopProductsTable data={topProducts} />
      </div>

      {/* Bottom Row: Recent Shipments + Warehouse */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentShipments shipments={shipments} />
        </div>
        <WarehouseUtilizationChart data={warehouseUtilization} />
      </div>
    </div>
  );
}
