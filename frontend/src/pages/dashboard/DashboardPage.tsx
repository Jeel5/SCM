import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  Truck,
  Package,
  Timer,
  AlertTriangle,
  RotateCcw,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
  MapPin,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, StatusBadge, Button, MetricCardSkeleton } from '@/components/ui';
import { cn, formatCurrency, formatNumber, formatPercentage, formatDate, formatRelativeTime } from '@/lib/utils';
import { useAuthStore } from '@/stores';
import { dashboardApi, shipmentsApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import type { DashboardMetrics, ChartDataPoint, Shipment, CarrierPerformance, WarehouseUtilization } from '@/types';

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  iconBg: string;
  link?: string;
}

function MetricCard({ title, value, change, icon, iconBg, link }: MetricCardProps) {
  const isPositive = change >= 0;
  const Content = (
    <Card hover={!!link} className="relative overflow-hidden">
      {/* Decorative gradient */}
      <div className={cn('absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20', iconBg)} />
      
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold text-gray-900"
          >
            {value}
          </motion.p>
          <div className="flex items-center gap-1 mt-2">
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span
              className={cn(
                'text-sm font-medium',
                isPositive ? 'text-emerald-600' : 'text-red-600'
              )}
            >
              {isPositive ? '+' : ''}{change.toFixed(1)}%
            </span>
            <span className="text-sm text-gray-400">vs last period</span>
          </div>
        </div>
        <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center', iconBg)}>
          {icon}
        </div>
      </div>
      
      {link && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <span className="text-sm text-blue-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            View Details <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      )}
    </Card>
  );

  if (link) {
    return <Link to={link} className="group">{Content}</Link>;
  }
  return Content;
}

// Recent Shipments Component
function RecentShipments({ shipments }: { shipments: Shipment[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle subtitle="Real-time tracking">Active Shipments</CardTitle>
        <Link to="/shipments">
          <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {shipments.slice(0, 5).map((shipment, index) => (
            <motion.div
              key={shipment.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Truck className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 truncate">{shipment.trackingNumber}</p>
                  <StatusBadge status={shipment.status} />
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{shipment.carrierName}</span>
                  <span>•</span>
                  <Clock className="h-3 w-3" />
                  <span>{formatRelativeTime(shipment.updatedAt)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Carrier Performance Chart
function CarrierPerformanceChart({ data }: { data: CarrierPerformance[] }) {
  const chartData = data.map((d) => ({
    name: d.carrierName.split(' ')[0],
    onTime: d.onTimeRate,
    late: 100 - d.onTimeRate,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle subtitle="On-time delivery rates">Carrier Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="name" width={60} />
            <Tooltip
              formatter={(value) => [`${Number(value).toFixed(1)}%`, '']}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
            />
            <Bar dataKey="onTime" stackId="a" fill="#10B981" radius={[0, 4, 4, 0]} name="On Time" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Orders Trend Chart
function OrdersTrendChart({ data }: { data: ChartDataPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle subtitle="Last 30 days">Orders Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => formatDate(value, 'MMM dd')}
              tick={{ fontSize: 12 }}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              labelFormatter={(value) => formatDate(value, 'MMM dd, yyyy')}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3B82F6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorOrders)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Warehouse Utilization Chart
function WarehouseUtilizationChart({ data }: { data: WarehouseUtilization[] }) {
  const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B'];

  // Cast data for Recharts compatibility
  const chartData = data as unknown as Array<Record<string, unknown>>;

  return (
    <Card>
      <CardHeader>
        <CardTitle subtitle="Capacity usage">Warehouse Utilization</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center mb-4">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="utilizationRate"
                nameKey="warehouseName"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Utilization']}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {data.map((warehouse, index) => (
            <div key={warehouse.warehouseId} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm text-gray-600 truncate">{warehouse.warehouseName.split(' ')[0]}</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{warehouse.utilizationRate.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Main Dashboard Page
export function DashboardPage() {
  const { user } = useAuthStore();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [ordersChart, setOrdersChart] = useState<ChartDataPoint[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [carrierPerformance, setCarrierPerformance] = useState<CarrierPerformance[]>([]);
  const [warehouseUtilization, setWarehouseUtilization] = useState<WarehouseUtilization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [useRealApi, setUseRealApi] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (useRealApi) {
          // Try to fetch from real API
          const [metricsRes, chartRes, shipmentsRes, carrierRes, warehouseRes] = await Promise.all([
            dashboardApi.getDashboardStats(),
            dashboardApi.getOrdersChart(30),
            shipmentsApi.getShipments(1, 10),
            dashboardApi.getCarrierPerformance(),
            dashboardApi.getWarehouseUtilization(),
          ]);
          
          setMetrics(metricsRes.data);
          setOrdersChart(chartRes.data);
          setShipments(shipmentsRes.data);
          setCarrierPerformance(carrierRes.data);
          setWarehouseUtilization(warehouseRes.data);
        } else {
          // Fallback to mock API
          const [metricsRes, chartRes, shipmentsRes, carrierRes, warehouseRes] = await Promise.all([
            mockApi.getDashboardMetrics(),
            mockApi.getOrdersChart(30),
            mockApi.getShipments(1, 10),
            mockApi.getCarrierPerformance(),
            mockApi.getWarehouseUtilization(),
          ]);
          
          setMetrics(metricsRes.data);
          setOrdersChart(chartRes.data);
          setShipments(shipmentsRes.data);
          setCarrierPerformance(carrierRes.data);
          setWarehouseUtilization(warehouseRes.data);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data from real API, falling back to mock:', error);
        // Fallback to mock data on error
        try {
          const [metricsRes, chartRes, shipmentsRes, carrierRes, warehouseRes] = await Promise.all([
            mockApi.getDashboardMetrics(),
            mockApi.getOrdersChart(30),
            mockApi.getShipments(1, 10),
            mockApi.getCarrierPerformance(),
            mockApi.getWarehouseUtilization(),
          ]);
          
          setMetrics(metricsRes.data);
          setOrdersChart(chartRes.data);
          setShipments(shipmentsRes.data);
          setCarrierPerformance(carrierRes.data);
          setWarehouseUtilization(warehouseRes.data);
          setUseRealApi(false);
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [useRealApi]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 mt-1">
            Here's what's happening with your logistics today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={<Clock className="h-4 w-4" />}>
            {formatDate(new Date(), 'MMM dd, yyyy')}
          </Button>
          <Button variant="primary" leftIcon={<ShoppingCart className="h-4 w-4" />}>
            New Order
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OrdersTrendChart data={ordersChart} />
        <CarrierPerformanceChart data={carrierPerformance} />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentShipments shipments={shipments} />
        </div>
        <WarehouseUtilizationChart data={warehouseUtilization} />
      </div>
    </div>
  );
}
