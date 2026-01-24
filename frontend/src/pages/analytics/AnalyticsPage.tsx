import { useEffect, useState } from 'react';
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
import { dashboardApi } from '@/api/services';
import { mockApi } from '@/api/mockData';

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
      className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all duration-300"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
          <div className="flex items-center gap-1 mt-2">
            {trend === 'up' ? (
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            )}
            <span className={cn('text-sm font-medium', trend === 'up' ? 'text-green-500' : 'text-red-500')}>
              {Math.abs(change)}%
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">vs last period</span>
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
  const [orderTrendData, setOrderTrendData] = useState<Array<{ date: string; orders: number; revenue: number }>>([]);
  const [carrierData, setCarrierData] = useState<Array<{ name: string; count: number }>>([]);
  const [warehouseData, setWarehouseData] = useState<Array<{ name: string; utilization: number }>>([]);
  const [kpiData, setKpiData] = useState({
    totalOrders: 0,
    ordersChange: 0,
    totalRevenue: 0,
    revenueChange: 0,
    activeShipments: 0,
    shipmentsChange: 0,
    avgDeliveryTime: 0,
    deliveryTimeChange: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'orders', label: 'Orders' },
    { id: 'shipments', label: 'Shipments' },
    { id: 'carriers', label: 'Carriers' },
    { id: 'warehouses', label: 'Warehouses' },
  ];

  const [deliveryPerformance, setDeliveryPerformance] = useState([
    { name: 'On Time', value: 85 },
    { name: 'Late', value: 10 },
    { name: 'Early', value: 5 },
  ]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const useMock = localStorage.getItem('useMockApi') === 'true';

      try {
        if (useMock) {
          const [metricsRes, ordersRes, carrierRes, warehouseRes] = await Promise.all([
            mockApi.getDashboardMetrics(),
            mockApi.getOrdersChart(parseInt(timeRange) || 30),
            mockApi.getCarrierPerformance(),
            mockApi.getWarehouseUtilization(),
          ]);

          setKpiData({
            totalOrders: metricsRes.data.totalOrders || 0,
            ordersChange: metricsRes.data.ordersChange || 0,
            totalRevenue: metricsRes.data.revenue || metricsRes.data.totalRevenue || 0,
            revenueChange: metricsRes.data.revenueChange || 0,
            activeShipments: metricsRes.data.activeShipments || 0,
            shipmentsChange: metricsRes.data.shipmentsChange || 0,
            avgDeliveryTime: metricsRes.data.avgDeliveryTime || 0,
            deliveryTimeChange: metricsRes.data.deliveryTimeChange || 0,
          });

          const onTimeRate = metricsRes.data.deliveryRate || 85;
          setDeliveryPerformance([
            { name: 'On Time', value: onTimeRate },
            { name: 'Late', value: Math.max(0, 100 - onTimeRate - 5) },
            { name: 'Early', value: 5 },
          ]);

          setOrderTrendData(
            ordersRes.data.map((item) => ({
              date: item.date,
              orders: 'value' in item ? (item as any).value ?? 0 : (item as any).count ?? 0,
              revenue: 'value' in item ? (item as any).value ?? 0 : 0,
            }))
          );

          setCarrierData(
            carrierRes.data.map((c) => ({
              name: (c as any).carrierName || (c as any).carrier || (c as any).name,
              count: (c as any).totalShipments || (c as any).onTimeRate || 0,
            }))
          );

          setWarehouseData(
            warehouseRes.data.map((w) => ({
              name: (w as any).warehouseName || (w as any).name,
              utilization: (w as any).utilizationRate || (w as any).utilization || 0,
            }))
          );
        } else {
          const analyticsRes = await dashboardApi.getAnalytics(timeRange);
          const data = analyticsRes.data || {};

          const orders = (data.ordersOverTime || []).map((item: any) => ({
            date: item.date,
            orders: item.count || 0,
            revenue: item.value || 0,
          }));
          setOrderTrendData(orders);

          const totalOrders = orders.reduce((sum, item) => sum + (item.orders || 0), 0);
          const totalRevenue = orders.reduce((sum, item) => sum + (item.revenue || 0), 0);
          const carrier = (data.shipmentsByCarrier || []).map((c: any) => ({ name: c.carrier, count: c.count || 0 }));
          setCarrierData(carrier);

          const warehouse = (data.warehouseUtilization || []).map((w: any) => ({
            name: w.name,
            utilization: w.utilization || (w.capacity ? Math.round(((w.currentStock || 0) / w.capacity) * 100) : 0),
          }));
          setWarehouseData(warehouse);

          setKpiData({
            totalOrders,
            ordersChange: 0,
            totalRevenue,
            revenueChange: 0,
            activeShipments: carrier.reduce((sum, c) => sum + (c.count || 0), 0),
            shipmentsChange: 0,
            avgDeliveryTime: 0,
            deliveryTimeChange: 0,
          });

          // Try to get on-time rate from analytics or calculate
          const onTimeRate = 85; // Default if not available
          setDeliveryPerformance([
            { name: 'On Time', value: onTimeRate },
            { name: 'Late', value: Math.max(0, 100 - onTimeRate - 5) },
            { name: 'Early', value: 5 },
          ]);
        }
      } catch (error) {
        console.error('Failed to load analytics:', error);
        setOrderTrendData([]);
        setCarrierData([]);
        setWarehouseData([]);
        setKpiData({
          totalOrders: 0,
          ordersChange: 0,
          totalRevenue: 0,
          revenueChange: 0,
          activeShipments: 0,
          shipmentsChange: 0,
          avgDeliveryTime: 0,
          deliveryTimeChange: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

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
