import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  Truck,
  DollarSign,
  Clock,
  Download,
  ArrowUpRight,
  ArrowDownRight,
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
  Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, Button, Select, Tabs } from '@/components/ui';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

// KPI Card Component
function KPICard({
  title,
  value,
  change,
  trend,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down';
  icon: React.ElementType;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-white rounded-2xl border border-gray-100 hover:shadow-lg transition-all duration-300"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          <div className="flex items-center gap-1 mt-2">
            {trend === 'up' ? (
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            )}
            <span className={cn('text-sm font-medium', trend === 'up' ? 'text-green-500' : 'text-red-500')}>
              {Math.abs(change)}%
            </span>
            <span className="text-sm text-gray-500">vs last period</span>
          </div>
        </div>
        <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center', color)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </motion.div>
  );
}

// Main Analytics Page
export function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('30d');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'orders', label: 'Orders' },
    { id: 'shipments', label: 'Shipments' },
    { id: 'carriers', label: 'Carriers' },
    { id: 'warehouses', label: 'Warehouses' },
  ];

  // Mock chart data
  const orderTrendData = [
    { date: 'Jan', orders: 1200, revenue: 45000 },
    { date: 'Feb', orders: 1400, revenue: 52000 },
    { date: 'Mar', orders: 1100, revenue: 41000 },
    { date: 'Apr', orders: 1600, revenue: 61000 },
    { date: 'May', orders: 1800, revenue: 72000 },
    { date: 'Jun', orders: 2100, revenue: 85000 },
    { date: 'Jul', orders: 1900, revenue: 76000 },
    { date: 'Aug', orders: 2200, revenue: 89000 },
    { date: 'Sep', orders: 2400, revenue: 96000 },
    { date: 'Oct', orders: 2600, revenue: 105000 },
    { date: 'Nov', orders: 2800, revenue: 112000 },
    { date: 'Dec', orders: 3100, revenue: 125000 },
  ];

  const deliveryPerformance = [
    { name: 'On Time', value: 85 },
    { name: 'Late', value: 10 },
    { name: 'Early', value: 5 },
  ];

  const carrierPerformance = [
    { carrier: 'FedEx', onTime: 92, volume: 1200 },
    { carrier: 'UPS', onTime: 88, volume: 980 },
    { carrier: 'DHL', onTime: 95, volume: 750 },
    { carrier: 'USPS', onTime: 82, volume: 620 },
    { carrier: 'Amazon', onTime: 90, volume: 540 },
  ];

  const warehouseUtilization = [
    { name: 'LA Warehouse', utilized: 78, capacity: 100 },
    { name: 'NY Warehouse', utilized: 92, capacity: 100 },
    { name: 'Chicago Hub', utilized: 65, capacity: 100 },
    { name: 'Dallas DC', utilized: 88, capacity: 100 },
    { name: 'Seattle FC', utilized: 71, capacity: 100 },
  ];

  // Mock KPI data
  const kpiData = {
    totalOrders: 24580,
    ordersChange: 12.5,
    totalRevenue: 1250000,
    revenueChange: 8.2,
    activeShipments: 3420,
    shipmentsChange: -2.3,
    avgDeliveryTime: 2.4,
    deliveryTimeChange: -5.1,
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
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Track performance metrics and insights</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            options={[
              { value: '7d', label: 'Last 7 days' },
              { value: '30d', label: 'Last 30 days' },
              { value: '90d', label: 'Last 90 days' },
              { value: '1y', label: 'Last year' },
            ]}
            className="w-40"
          />
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />}>
            Export Report
          </Button>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Orders"
          value={formatNumber(kpiData.totalOrders)}
          change={kpiData.ordersChange}
          trend={kpiData.ordersChange >= 0 ? 'up' : 'down'}
          icon={Package}
          color="bg-blue-100 text-blue-600"
        />
        <KPICard
          title="Total Revenue"
          value={formatCurrency(kpiData.totalRevenue)}
          change={kpiData.revenueChange}
          trend={kpiData.revenueChange >= 0 ? 'up' : 'down'}
          icon={DollarSign}
          color="bg-green-100 text-green-600"
        />
        <KPICard
          title="Active Shipments"
          value={formatNumber(kpiData.activeShipments)}
          change={kpiData.shipmentsChange}
          trend={kpiData.shipmentsChange >= 0 ? 'up' : 'down'}
          icon={Truck}
          color="bg-purple-100 text-purple-600"
        />
        <KPICard
          title="Avg. Delivery Time"
          value={`${kpiData.avgDeliveryTime}d`}
          change={kpiData.deliveryTimeChange}
          trend={kpiData.deliveryTimeChange <= 0 ? 'up' : 'down'}
          icon={Clock}
          color="bg-yellow-100 text-yellow-600"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Order & Revenue Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={orderTrendData}>
                  <defs>
                    <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                  <YAxis yAxisId="left" stroke="#6B7280" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="#6B7280" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '12px',
                    }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="orders"
                    stroke="#3B82F6"
                    fillOpacity={1}
                    fill="url(#colorOrders)"
                    name="Orders"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10B981"
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    name="Revenue"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deliveryPerformance}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}%`}
                  >
                    {deliveryPerformance.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Carrier Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Carrier Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={carrierPerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" domain={[0, 100]} stroke="#6B7280" fontSize={12} />
                  <YAxis dataKey="carrier" type="category" stroke="#6B7280" fontSize={12} width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '12px',
                    }}
                  />
                  <Bar dataKey="onTime" fill="#3B82F6" radius={[0, 4, 4, 0]} name="On-Time %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Warehouse Utilization */}
        <Card>
          <CardHeader>
            <CardTitle>Warehouse Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={warehouseUtilization}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#6B7280" fontSize={10} angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="#6B7280" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '12px',
                    }}
                  />
                  <Bar dataKey="utilized" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Utilization %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Avg. Order Value', value: formatCurrency(52.30), color: 'text-blue-600' },
          { label: 'Avg. Delivery Time', value: `${kpiData.avgDeliveryTime}d`, color: 'text-green-600' },
          { label: 'Return Rate', value: '3.2%', color: 'text-yellow-600' },
          { label: 'Customer Satisfaction', value: '4.8/5', color: 'text-purple-600' },
        ].map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-4 bg-white rounded-xl border border-gray-100 text-center"
          >
            <p className="text-sm text-gray-500">{metric.label}</p>
            <p className={cn('text-2xl font-bold mt-1', metric.color)}>{metric.value}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
