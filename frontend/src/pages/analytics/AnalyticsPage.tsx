import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Truck, DollarSign, Clock, Download, BarChart3 } from 'lucide-react';
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
  TooltipProps,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, Button, Select, Tabs } from '@/components/ui';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import { KPICard } from './components/KPICard';
import { useAnalytics } from './hooks/useAnalytics';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

// Custom Tooltip for Charts
const CustomTooltip = ({ active, payload, label }: TooltipProps<any, any>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        {label && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{label}</p>
        )}
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 mb-1">
            <span className="text-sm text-gray-600 dark:text-gray-300">{entry.name}:</span>
            <span className="text-sm font-bold" style={{ color: entry.color }}>
              {typeof entry.value === 'number' && entry.value > 1000
                ? formatCurrency(entry.value)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

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
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">Track performance metrics and insights</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            options={[
              { value: '7d', label: 'Last 7 days' },
              { value: '30d', label: 'Last 30 days' },
              { value: '90d', label: 'Last 90 days' },
              { value: '1y', label: 'Last year' },
            ]}
            className="w-36 sm:w-40"
          />
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} className="whitespace-nowrap">
            <span className="hidden sm:inline">Export Report</span>
            <span className="sm:hidden">Export</span>
          </Button>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {isLoading && (
        <div className="w-full p-6 text-center text-gray-500 dark:text-gray-400">Loading analytics...</div>
      )}

      {/* KPI Cards */}
      {!isLoading && activeTab === 'overview' && (
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

      {/* Overview Tab */}
      {activeTab === 'overview' && !isLoading && (
      <>
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
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis dataKey="date" tick={{ fill: 'currentColor', fontSize: 12, className: 'text-gray-600 dark:text-gray-300' }} />
                  <YAxis yAxisId="left" tick={{ fill: 'currentColor', fontSize: 12, className: 'text-gray-600 dark:text-gray-300' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: 'currentColor', fontSize: 12, className: 'text-gray-600 dark:text-gray-300' }} />
                  <Tooltip content={<CustomTooltip />} />
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
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
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
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis type="number" domain={[0, 'auto']} tick={{ fill: 'currentColor', fontSize: 12, className: 'text-gray-600 dark:text-gray-300' }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: 'currentColor', fontSize: 12, className: 'text-gray-600 dark:text-gray-300' }} width={120} />
                  <Tooltip content={<CustomTooltip />} />
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
                <BarChart data={warehouseData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis 
                    type="number" 
                    tick={{ fill: 'currentColor', fontSize: 12, className: 'text-gray-600 dark:text-gray-300' }}
                  />
                  <YAxis 
                    type="category"
                    dataKey="name" 
                    tick={{ fill: 'currentColor', fontSize: 12, className: 'text-gray-700 dark:text-gray-200 font-medium' }}
                    width={150}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="utilization" fill="#8B5CF6" radius={[0, 4, 4, 0]} name="Utilization %" />
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
      </>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && !isLoading && (
        <>
          {/* Order KPIs */}
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
              title="Avg. Order Value"
              value={formatCurrency(kpiData.totalRevenue / Math.max(kpiData.totalOrders, 1))}
              change={0}
              trend="up"
              icon={DollarSign}
              color="bg-purple-100 text-purple-600"
            />
            <KPICard
              title="Processing Time"
              value={`${kpiData.avgDeliveryTime}d`}
              change={kpiData.deliveryTimeChange}
              trend={kpiData.deliveryTimeChange <= 0 ? 'up' : 'down'}
              icon={Clock}
              color="bg-yellow-100 text-yellow-600"
            />
          </div>

          {/* Order Trends Chart */}
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
              <div className="h-96">
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
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis dataKey="date" tick={{ fill: 'currentColor', fontSize: 12, className: 'text-gray-600 dark:text-gray-300' }} />
                    <YAxis yAxisId="left" tick={{ fill: 'currentColor', fontSize: 12, className: 'text-gray-600 dark:text-gray-300' }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: 'currentColor', fontSize: 12, className: 'text-gray-600 dark:text-gray-300' }} />
                    <Tooltip content={<CustomTooltip />} />
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
        </>
      )}

      {/* Shipments Tab */}
      {activeTab === 'shipments' && !isLoading && (
        <>
          {/* Shipment KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Active Shipments"
              value={formatNumber(kpiData.activeShipments)}
              change={kpiData.shipmentsChange}
              trend={kpiData.shipmentsChange >= 0 ? 'up' : 'down'}
              icon={Truck}
              color="bg-blue-100 text-blue-600"
            />
            <KPICard
              title="Avg. Delivery Time"
              value={`${kpiData.avgDeliveryTime}d`}
              change={kpiData.deliveryTimeChange}
              trend={kpiData.deliveryTimeChange <= 0 ? 'up' : 'down'}
              icon={Clock}
              color="bg-green-100 text-green-600"
            />
            <KPICard
              title="On-Time Rate"
              value="—"
              change={0}
              trend="up"
              icon={Package}
              color="bg-purple-100 text-purple-600"
            />
            <KPICard
              title="In Transit"
              value="—"
              change={0}
              trend="up"
              icon={Truck}
              color="bg-yellow-100 text-yellow-600"
            />
          </div>

          {/* Delivery Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={deliveryPerformance}
                      cx="50%"
                      cy="50%"
                      innerRadius={100}
                      outerRadius={140}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
                      {deliveryPerformance.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Carriers Tab */}
      {activeTab === 'carriers' && !isLoading && (
        <>
          {/* Carrier KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Total Carriers"
              value={formatNumber(carrierData.length)}
              change={0}
              trend="up"
              icon={Truck}
              color="bg-blue-100 text-blue-600"
            />
            <KPICard
              title="Total Shipments"
              value={formatNumber(carrierData.reduce((sum, c) => sum + c.count, 0))}
              change={0}
              trend="up"
              icon={Package}
              color="bg-green-100 text-green-600"
            />
            <KPICard
              title="Avg. Performance"
              value="—"
              change={0}
              trend="up"
              icon={BarChart3}
              color="bg-purple-100 text-purple-600"
            />
            <KPICard
              title="Best Carrier"
              value={carrierData.length > 0 ? carrierData[0].name : '—'}
              change={0}
              trend="up"
              icon={Truck}
              color="bg-yellow-100 text-yellow-600"
            />
          </div>

          {/* Carrier Performance Chart */}
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
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={carrierData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis type="number" domain={[0, 'auto']} tick={{ fill: 'currentColor', fontSize: 12, className: 'text-gray-600 dark:text-gray-300' }} />
                    <YAxis dataKey="name" type="category" tick={{ fill: 'currentColor', fontSize: 12, className: 'text-gray-600 dark:text-gray-300' }} width={120} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} name="Shipments" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Warehouses Tab */}
      {activeTab === 'warehouses' && !isLoading && (
        <>
          {/* Warehouse KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Total Warehouses"
              value={formatNumber(warehouseData.length)}
              change={0}
              trend="up"
              icon={Package}
              color="bg-blue-100 text-blue-600"
            />
            <KPICard
              title="Avg. Utilization"
              value={warehouseData.length > 0 ? `${(warehouseData.reduce((sum, w) => sum + w.utilization, 0) / warehouseData.length).toFixed(1)}%` : '0%'}
              change={0}
              trend="up"
              icon={BarChart3}
              color="bg-green-100 text-green-600"
            />
            <KPICard
              title="Highest Utilization"
              value={warehouseData.length > 0 ? warehouseData[0].name : '—'}
              change={0}
              trend="up"
              icon={Package}
              color="bg-purple-100 text-purple-600"
            />
            <KPICard
              title="Available Capacity"
              value="—"
              change={0}
              trend="up"
              icon={Package}
              color="bg-yellow-100 text-yellow-600"
            />
          </div>

          {/* Warehouse Utilization Chart */}
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
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={warehouseData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis 
                      type="number" 
                      tick={{ fill: 'currentColor', fontSize: 12, className: 'text-gray-600 dark:text-gray-300' }}
                    />
                    <YAxis 
                      type="category"
                      dataKey="name" 
                      tick={{ fill: 'currentColor', fontSize: 12, className: 'text-gray-700 dark:text-gray-200 font-medium' }}
                      width={150}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="utilization" fill="#8B5CF6" radius={[0, 4, 4, 0]} name="Utilization %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
