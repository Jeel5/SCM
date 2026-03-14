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
import { Button, MetricCardSkeleton, PermissionGate } from '@/components/ui';
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
import type { UserRole } from '@/types';

type DashboardCardKey =
  | 'orders'
  | 'shipments'
  | 'deliveryRate'
  | 'sla'
  | 'returns'
  | 'exceptions'
  | 'revenue'
  | 'avgDelivery'
  | 'lowStock';

const ROLE_HEADLINES: Record<UserRole, { title: string; subtitle: string }> = {
  superadmin: { title: 'Platform overview', subtitle: 'Cross-organization health and growth.' },
  admin: { title: 'Operational command center', subtitle: 'Orders, shipments, finance, and customer impact in one view.' },
  operations_manager: { title: 'Flow control', subtitle: 'Throughput, bottlenecks, and SLA risk across the network.' },
  warehouse_manager: { title: 'Warehouse operations', subtitle: 'Capacity, low stock, and outbound execution for your warehouses.' },
  carrier_partner: { title: 'Carrier execution', subtitle: 'Shipment movement, delivery pace, and exceptions requiring action.' },
  finance: { title: 'Financial exposure', subtitle: 'Revenue, refunds, penalties, and customer-impacting exceptions.' },
  customer_support: { title: 'Customer support pulse', subtitle: 'Returns, shipment issues, and service reliability affecting customers.' },
};

const ROLE_CARD_ORDER: Record<UserRole, DashboardCardKey[]> = {
  superadmin: ['orders', 'shipments', 'revenue', 'sla'],
  admin: ['orders', 'shipments', 'revenue', 'sla', 'returns', 'exceptions', 'deliveryRate', 'avgDelivery'],
  operations_manager: ['orders', 'shipments', 'deliveryRate', 'sla', 'exceptions', 'returns', 'avgDelivery', 'revenue'],
  warehouse_manager: ['orders', 'lowStock', 'shipments', 'deliveryRate', 'returns', 'exceptions'],
  carrier_partner: ['shipments', 'deliveryRate', 'avgDelivery', 'exceptions'],
  finance: ['revenue', 'returns', 'exceptions', 'deliveryRate'],
  customer_support: ['orders', 'returns', 'exceptions', 'deliveryRate'],
};

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

  const role = user?.role ?? 'admin';
  const headline = ROLE_HEADLINES[role];
  const visibleCardOrder = ROLE_CARD_ORDER[role];
  const canViewWarehouses = ['admin', 'operations_manager', 'warehouse_manager'].includes(role);
  const showOrderStatus = ['admin', 'operations_manager', 'customer_support'].includes(role);
  const showCarrierPerformance = ['admin', 'operations_manager', 'carrier_partner'].includes(role);
  const showWarehouseChart = canViewWarehouses && ['admin', 'operations_manager', 'warehouse_manager'].includes(role);
  const showTopProducts = ['admin', 'operations_manager', 'warehouse_manager'].includes(role);
  const showRecentShipments = role !== 'finance';

  const cardMap: Record<DashboardCardKey, JSX.Element> = metrics ? {
    orders: (
      <MetricCard
        title="Total Orders"
        value={formatNumber(metrics.totalOrders)}
        change={metrics.ordersChange}
        icon={<ShoppingCart className="h-6 w-6 text-blue-600" />}
        iconBg="bg-blue-100"
        link="/orders"
      />
    ),
    shipments: (
      <MetricCard
        title="Active Shipments"
        value={formatNumber(metrics.activeShipments)}
        change={metrics.shipmentsChange}
        icon={<Truck className="h-6 w-6 text-purple-600" />}
        iconBg="bg-purple-100"
        link="/shipments"
      />
    ),
    deliveryRate: (
      <MetricCard
        title="Delivery Rate"
        value={formatPercentage(metrics.deliveryRate)}
        change={metrics.deliveryRateChange}
        icon={<Package className="h-6 w-6 text-emerald-600" />}
        iconBg="bg-emerald-100"
      />
    ),
    sla: (
      <MetricCard
        title="SLA Compliance"
        value={formatPercentage(metrics.slaCompliance)}
        change={metrics.slaComplianceChange}
        icon={<Timer className="h-6 w-6 text-amber-600" />}
        iconBg="bg-amber-100"
        link="/sla"
      />
    ),
    returns: (
      <MetricCard
        title="Pending Returns"
        value={formatNumber(metrics.pendingReturns)}
        change={metrics.returnsChange}
        icon={<RotateCcw className="h-6 w-6 text-rose-600" />}
        iconBg="bg-rose-100"
        link="/returns"
      />
    ),
    exceptions: (
      <MetricCard
        title="Active Exceptions"
        value={formatNumber(metrics.activeExceptions)}
        change={metrics.exceptionsChange}
        icon={<AlertTriangle className="h-6 w-6 text-orange-600" />}
        iconBg="bg-orange-100"
        link="/exceptions"
      />
    ),
    revenue: (
      <MetricCard
        title="Total Revenue"
        value={formatCurrency(metrics.revenue)}
        change={metrics.revenueChange}
        icon={<DollarSign className="h-6 w-6 text-green-600" />}
        iconBg="bg-green-100"
        link="/finance"
      />
    ),
    avgDelivery: (
      <MetricCard
        title="Avg. Delivery Time"
        value={`${metrics.avgDeliveryTime} days`}
        change={metrics.avgDeliveryTimeChange}
        icon={<Clock className="h-6 w-6 text-cyan-600" />}
        iconBg="bg-cyan-100"
      />
    ),
    lowStock: (
      <MetricCard
        title="Low Stock Alerts"
        value={formatNumber(metrics.lowStockAlerts || 0)}
        change={0}
        icon={<Package className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        link="/inventory"
      />
    ),
  } : {} as Record<DashboardCardKey, JSX.Element>;

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
            {headline.title}
          </h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
            {headline.subtitle}
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
            onClick={() => refetch()}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            title="Refresh dashboard"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <Calendar className="h-4 w-4" />
            {formatDate(new Date(), 'MMM dd, yyyy')}
          </div>
        </div>
      </motion.div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : metrics ? (
          visibleCardOrder.map((cardKey) => (
            <div key={cardKey}>{cardMap[cardKey]}</div>
          ))
        ) : null}
      </div>

      {/* Charts Row 1 */}
      <div className={`grid grid-cols-1 ${showOrderStatus ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-6`}>
        <div className={showOrderStatus ? 'lg:col-span-2' : ''}>
          <OrdersTrendChart data={ordersChart} />
        </div>
        {showOrderStatus && <OrderStatusChart metrics={metrics} />}
      </div>

      {(showCarrierPerformance || showTopProducts) && (
        <div className={`grid grid-cols-1 ${(showCarrierPerformance && showTopProducts) ? 'lg:grid-cols-2' : 'lg:grid-cols-1'} gap-6`}>
          {showCarrierPerformance && <CarrierPerformanceChart data={carrierPerformance} />}
          {showTopProducts && <TopProductsTable data={topProducts} />}
        </div>
      )}

      {(showRecentShipments || showWarehouseChart) && (
        <div className={`grid grid-cols-1 ${(showRecentShipments && showWarehouseChart) ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-6`}>
          {showRecentShipments && (
            <div className={showWarehouseChart ? 'lg:col-span-2' : ''}>
              <RecentShipments shipments={shipments} />
            </div>
          )}
          {showWarehouseChart && (
            <PermissionGate permission="warehouses.view">
              <WarehouseUtilizationChart data={warehouseUtilization} />
            </PermissionGate>
          )}
        </div>
      )}
    </div>
  );
}
