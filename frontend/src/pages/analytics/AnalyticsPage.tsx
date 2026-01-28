import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Truck, DollarSign, Clock, Download } from 'lucide-react';
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
import { KPICard } from './components/KPICard';
import { useAnalytics } from './hooks/useAnalytics';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

// Main Analytics Page
export function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('30d');
  const { orderTrendData, carrierData, warehouseData, deliveryPerformance, kpiData, isLoading } = useAnalytics(timeRange);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'orders', label: 'Orders' },
    { id: 'shipments', label: 'Shipments' },
    { id: 'carriers', label: 'Carriers' },
    { id: 'warehouses', label: 'Warehouses' },
  ];

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
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track performance metrics and insights</p>
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

      {isLoading && (
        <div className="w-full p-6 text-center text-gray-500">Loading analytics...</div>
      )}

      {/* KPI Cards */}
      {!isLoading && (
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
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Order & Revenue Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {orderTrendData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-80 text-center">
                <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                  <Package className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">No order data available</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Order trends will appear when data is available</p>
              </div>
            ) : (
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
            )}
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
            {carrierData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-80 text-center">
                <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                  <Truck className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">No carrier data available</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Carrier performance will appear when data is available</p>
              </div>
            ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={carrierData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" domain={[0, 'auto']} stroke="#6B7280" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="#6B7280" fontSize={12} width={120} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '12px',
                    }}
                  />
                  <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} name="Shipments" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
          </CardContent>
        </Card>

        {/* Warehouse Utilization */}
        <Card>
          <CardHeader>
            <CardTitle>Warehouse Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            {warehouseData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-80 text-center">
                <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                  <Package className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">No warehouse data available</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Warehouse utilization will appear when data is available</p>
              </div>
            ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={warehouseData}>
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
                  <Bar dataKey="utilization" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Utilization %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Avg. Order Value', value: orderTrendData.length ? formatCurrency(kpiData.totalRevenue / Math.max(kpiData.totalOrders, 1)) : '$0', color: 'text-blue-600' },
          { label: 'Avg. Delivery Time', value: `${kpiData.avgDeliveryTime}d`, color: 'text-green-600' },
          { label: 'Return Rate', value: '—', color: 'text-yellow-600' },
          { label: 'Customer Satisfaction', value: '—', color: 'text-purple-600' },
        ].map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-center"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">{metric.label}</p>
            <p className={cn('text-2xl font-bold mt-1', metric.color)}>{metric.value}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
