import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Package, Truck, DollarSign, Clock, Download, BarChart3,
  TrendingUp, AlertTriangle, RotateCcw, ShoppingCart, Warehouse, RefreshCw,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line,
  TooltipProps,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, Button, Select, Tabs } from '@/components/ui';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import { KPICard } from './components/KPICard';
import { useAnalytics } from './hooks/useAnalytics';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        {label && <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{label}</p>}
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 mb-1">
            <span className="text-sm text-gray-600 dark:text-gray-300">{entry.name}:</span>
            <span className="text-sm font-bold" style={{ color: entry.color }}>
              {typeof entry.value === 'number' && entry.value > 1000
                ? formatCurrency(entry.value)
                : typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Helper for "no data" empty states
function EmptyChart({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-80 text-center">
      <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
      <p className="text-gray-500 dark:text-gray-400 font-medium">{label}</p>
    </div>
  );
}

export function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('30d');
  const [isExporting, setIsExporting] = useState(false);
  const {
    orderTrendData, carrierData, warehouseData, deliveryPerformance,
    topProducts, slaViolations, exceptionsByType, returnsAnalysis,
    financialMetrics, kpiData, isLoading, refetch,
  } = useAnalytics(timeRange);

  const rangeMap: Record<string, string> = { '7d': 'week', '30d': 'month', '90d': 'month', '1y': 'year' };
  const typeMap: Record<string, string> = {
    overview: 'orders', orders: 'orders', shipments: 'shipments',
    carriers: 'shipments', warehouses: 'orders', returns: 'returns',
    sla: 'violations', financial: 'orders',
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const exportType = typeMap[activeTab] ?? 'orders';
      const exportRange = rangeMap[timeRange] ?? 'month';
      const resp = await fetch(`${apiBase}/analytics/export?type=${exportType}&range=${exportRange}`, {
        credentials: 'include',
      });
      if (!resp.ok) throw new Error(`Export failed: ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportType}-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'orders', label: 'Orders' },
    { id: 'shipments', label: 'Shipments' },
    { id: 'carriers', label: 'Carriers' },
    { id: 'warehouses', label: 'Warehouses' },
    { id: 'products', label: 'Products' },
    { id: 'financial', label: 'Financial' },
    { id: 'sla', label: 'SLA & Exceptions' },
  ];

  // ── Derived values ────────────────────────────────────────
  const totalShipments = carrierData.reduce((s, c) => s + c.totalShipments, 0);
  const weightedOnTimeRate = totalShipments > 0
    ? Math.round(carrierData.reduce((s, c) => s + c.onTimeRate * c.totalShipments, 0) / totalShipments * 10) / 10
    : 0;
  const totalCapacity = warehouseData.reduce((s, w) => s + w.capacity, 0);
  const totalStock = warehouseData.reduce((s, w) => s + w.currentStock, 0);
  const availableCapacity = totalCapacity - totalStock;
  const sortedByUtil = [...warehouseData].sort((a, b) => b.utilization - a.utilization);
  const returnRate = financialMetrics.totalOrders > 0
    ? Math.round(returnsAnalysis.totalReturns / financialMetrics.totalOrders * 1000) / 10
    : 0;
  const netRevenue = financialMetrics.totalRevenue - financialMetrics.totalShippingCost - financialMetrics.totalPenalties - financialMetrics.totalRefunds;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
            Daily aggregated reporting for operational, carrier, SLA, and finance trends
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}
            options={[
              { value: '7d', label: 'Last 7 days' },
              { value: '30d', label: 'Last 30 days' },
              { value: '90d', label: 'Last 90 days' },
              { value: '1y', label: 'Last year' },
            ]}
            className="w-36 sm:w-40"
          />
          <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={refetch}>Refresh</Button>
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={handleExport} disabled={isExporting}>
            <span className="hidden sm:inline">{isExporting ? 'Exporting…' : 'Export'}</span>
            <span className="sm:hidden">{isExporting ? '…' : 'Export'}</span>
          </Button>
        </div>
      </motion.div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {isLoading && (
        <div className="w-full p-6 text-center text-gray-500 dark:text-gray-400">Loading analytics...</div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Net Revenue', value: formatCurrency(netRevenue), icon: DollarSign, tone: 'bg-green-100 text-green-600' },
            { label: 'Return Rate', value: `${returnRate}%`, icon: RotateCcw, tone: 'bg-amber-100 text-amber-600' },
            { label: 'Penalty Exposure', value: formatCurrency(financialMetrics.totalPenalties), icon: AlertTriangle, tone: 'bg-red-100 text-red-600' },
            { label: 'Capacity Headroom', value: formatNumber(Math.max(availableCapacity, 0)), icon: Warehouse, tone: 'bg-blue-100 text-blue-600' },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', card.tone)}>
                  <card.icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ═══════ OVERVIEW TAB ═══════ */}
      {activeTab === 'overview' && !isLoading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Total Orders" value={formatNumber(kpiData.totalOrders)} change={kpiData.ordersChange} trend={kpiData.ordersChange >= 0 ? 'up' : 'down'} icon={Package} color="bg-blue-100 text-blue-600" />
            <KPICard title="Total Revenue" value={formatCurrency(kpiData.totalRevenue)} change={kpiData.revenueChange} trend={kpiData.revenueChange >= 0 ? 'up' : 'down'} icon={DollarSign} color="bg-green-100 text-green-600" />
            <KPICard title="Total Shipments" value={formatNumber(kpiData.activeShipments)} change={kpiData.shipmentsChange} trend={kpiData.shipmentsChange >= 0 ? 'up' : 'down'} icon={Truck} color="bg-purple-100 text-purple-600" />
            <KPICard title="On-Time Rate" value={`${weightedOnTimeRate}%`} change={0} trend="up" icon={Clock} color="bg-yellow-100 text-yellow-600" />
          </div>

          {/* Row 1: Order Trends + Delivery Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Order & Revenue Trends</CardTitle></CardHeader>
              <CardContent>
                {orderTrendData.length === 0 ? <EmptyChart icon={Package} label="No order data available" /> : (
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
                        <XAxis dataKey="date" tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <YAxis yAxisId="left" tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area yAxisId="left" type="monotone" dataKey="orders" stroke="#3B82F6" fillOpacity={1} fill="url(#colorOrders)" name="Orders" />
                        <Area yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Delivery Performance</CardTitle></CardHeader>
              <CardContent>
                <div className="h-80 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={deliveryPerformance} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
                        {deliveryPerformance.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Carrier Performance + Warehouse Utilization */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Carrier Performance</CardTitle></CardHeader>
              <CardContent>
                {carrierData.length === 0 ? <EmptyChart icon={Truck} label="No carrier data available" /> : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={carrierData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis type="number" tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <YAxis dataKey="name" type="category" tick={{ fill: 'currentColor', fontSize: 12 }} width={120} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="totalShipments" fill="#3B82F6" radius={[0, 4, 4, 0]} name="Shipments" />
                        <Bar dataKey="onTimeRate" fill="#10B981" radius={[0, 4, 4, 0]} name="On-Time %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Warehouse Utilization</CardTitle></CardHeader>
              <CardContent>
                {warehouseData.length === 0 ? <EmptyChart icon={Warehouse} label="No warehouse data available" /> : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={warehouseData} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis type="number" tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" tick={{ fill: 'currentColor', fontSize: 12 }} width={150} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="utilization" fill="#8B5CF6" radius={[0, 4, 4, 0]} name="Utilization %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row 3: Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { label: 'Avg. Order Value', value: financialMetrics.avgOrderValue ? formatCurrency(financialMetrics.avgOrderValue) : formatCurrency(kpiData.totalRevenue / Math.max(kpiData.totalOrders, 1)), color: 'text-blue-600' },
              { label: 'Shipping Costs', value: formatCurrency(financialMetrics.totalShippingCost), color: 'text-orange-600' },
              { label: 'Penalties', value: formatCurrency(financialMetrics.totalPenalties), color: 'text-red-600' },
              { label: 'Net Revenue', value: formatCurrency(netRevenue), color: netRevenue >= 0 ? 'text-green-600' : 'text-red-600' },
              { label: 'Return Rate', value: returnsAnalysis.totalReturns > 0 ? `${returnRate}%` : '0%', color: 'text-yellow-600' },
              { label: 'Total Refunds', value: formatCurrency(returnsAnalysis.totalRefundAmount), color: 'text-purple-600' },
            ].map((m, i) => (
              <motion.div key={m.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">{m.label}</p>
                <p className={cn('text-lg font-bold mt-1', m.color)}>{m.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Row 4: Top Products + SLA Violations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products Table */}
            <Card>
              <CardHeader><CardTitle>Top Products by Revenue</CardTitle></CardHeader>
              <CardContent>
                {topProducts.length === 0 ? <EmptyChart icon={ShoppingCart} label="No product data available" /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Product</th>
                          <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Units</th>
                          <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Revenue</th>
                          <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Orders</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProducts.slice(0, 8).map((p, i) => (
                          <tr key={i} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="py-2 px-3">
                              <div className="font-medium text-gray-900 dark:text-white">{p.name}</div>
                              <div className="text-xs text-gray-400">{p.sku}</div>
                            </td>
                            <td className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">{formatNumber(p.unitsSold)}</td>
                            <td className="text-right py-2 px-3 font-medium text-green-600">{formatCurrency(p.revenue)}</td>
                            <td className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">{formatNumber(p.orderCount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SLA Violations Trend */}
            <Card>
              <CardHeader><CardTitle>SLA Violations Over Time</CardTitle></CardHeader>
              <CardContent>
                {slaViolations.length === 0 ? <EmptyChart icon={AlertTriangle} label="No SLA violation data" /> : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={slaViolations}>
                        <defs>
                          <linearGradient id="colorViol" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis dataKey="date" tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <YAxis tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="violations" stroke="#EF4444" fillOpacity={1} fill="url(#colorViol)" name="Violations" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row 5: Exceptions + Returns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Exceptions by Type */}
            <Card>
              <CardHeader><CardTitle>Exceptions by Type</CardTitle></CardHeader>
              <CardContent>
                {exceptionsByType.length === 0 ? <EmptyChart icon={AlertTriangle} label="No exception data" /> : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={exceptionsByType}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis dataKey="type" tick={{ fill: 'currentColor', fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" fill="#F59E0B" name="Total" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="resolved" fill="#10B981" name="Resolved" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Returns Summary */}
            <Card>
              <CardHeader><CardTitle>Returns Analysis</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {[
                    { label: 'Total Returns', value: formatNumber(returnsAnalysis.totalReturns), color: 'text-blue-600' },
                    { label: 'Refunded', value: formatNumber(returnsAnalysis.refunded), color: 'text-green-600' },
                    { label: 'Total Refund Amount', value: formatCurrency(returnsAnalysis.totalRefundAmount), color: 'text-purple-600' },
                    { label: 'Avg Refund', value: formatCurrency(returnsAnalysis.avgRefundAmount), color: 'text-orange-600' },
                  ].map((m) => (
                    <div key={m.label} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{m.label}</p>
                      <p className={cn('text-lg font-bold mt-1', m.color)}>{m.value}</p>
                    </div>
                  ))}
                </div>
                {(returnsAnalysis.qualityPassed > 0 || returnsAnalysis.qualityFailed > 0) && (
                  <div className="h-48">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quality Check Results</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={[
                          { name: 'Passed', value: returnsAnalysis.qualityPassed },
                          { name: 'Failed', value: returnsAnalysis.qualityFailed },
                        ]} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          <Cell fill="#10B981" />
                          <Cell fill="#EF4444" />
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ═══════ ORDERS TAB ═══════ */}
      {activeTab === 'orders' && !isLoading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Total Orders" value={formatNumber(kpiData.totalOrders)} change={kpiData.ordersChange} trend="up" icon={Package} color="bg-blue-100 text-blue-600" />
            <KPICard title="Total Revenue" value={formatCurrency(kpiData.totalRevenue)} change={kpiData.revenueChange} trend="up" icon={DollarSign} color="bg-green-100 text-green-600" />
            <KPICard title="Avg. Order Value" value={formatCurrency(financialMetrics.avgOrderValue || kpiData.totalRevenue / Math.max(kpiData.totalOrders, 1))} change={0} trend="up" icon={DollarSign} color="bg-purple-100 text-purple-600" />
            <KPICard title="Avg. Delivery Time" value={`${kpiData.avgDeliveryTime}d`} change={kpiData.deliveryTimeChange} trend={kpiData.deliveryTimeChange <= 0 ? 'up' : 'down'} icon={Clock} color="bg-yellow-100 text-yellow-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Order & Revenue Trends</CardTitle></CardHeader>
              <CardContent>
                {orderTrendData.length === 0 ? <EmptyChart icon={Package} label="No order data" /> : (
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={orderTrendData}>
                        <defs>
                          <linearGradient id="colorOrders2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3B82F6" stopOpacity={0} /></linearGradient>
                          <linearGradient id="colorRevenue2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10B981" stopOpacity={0} /></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis dataKey="date" tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <YAxis yAxisId="left" tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area yAxisId="left" type="monotone" dataKey="orders" stroke="#3B82F6" fillOpacity={1} fill="url(#colorOrders2)" name="Orders" />
                        <Area yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" fillOpacity={1} fill="url(#colorRevenue2)" name="Revenue" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Status Breakdown */}
            <Card>
              <CardHeader><CardTitle>Order Status Breakdown</CardTitle></CardHeader>
              <CardContent>
                {orderTrendData.length === 0 ? <EmptyChart icon={Package} label="No order data" /> : (
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={orderTrendData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis dataKey="date" tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <YAxis tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="delivered" stackId="a" fill="#10B981" name="Delivered" />
                        <Bar dataKey="inTransit" stackId="a" fill="#3B82F6" name="In Transit" />
                        <Bar dataKey="pending" stackId="a" fill="#F59E0B" name="Pending" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ═══════ SHIPMENTS TAB ═══════ */}
      {activeTab === 'shipments' && !isLoading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Total Shipments" value={formatNumber(totalShipments)} change={kpiData.shipmentsChange} trend="up" icon={Truck} color="bg-blue-100 text-blue-600" />
            <KPICard title="Avg. Delivery Time" value={`${kpiData.avgDeliveryTime}d`} change={kpiData.deliveryTimeChange} trend={kpiData.deliveryTimeChange <= 0 ? 'up' : 'down'} icon={Clock} color="bg-green-100 text-green-600" />
            <KPICard title="On-Time Rate" value={`${weightedOnTimeRate}%`} change={0} trend="up" icon={Package} color="bg-purple-100 text-purple-600" />
            <KPICard title="Total Shipping Cost" value={formatCurrency(financialMetrics.totalShippingCost)} change={0} trend="up" icon={DollarSign} color="bg-yellow-100 text-yellow-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Delivery Performance</CardTitle></CardHeader>
              <CardContent>
                <div className="h-96 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={deliveryPerformance} cx="50%" cy="50%" innerRadius={100} outerRadius={140} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
                        {deliveryPerformance.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Carrier cost breakdown */}
            <Card>
              <CardHeader><CardTitle>Shipping Cost by Carrier</CardTitle></CardHeader>
              <CardContent>
                {carrierData.length === 0 ? <EmptyChart icon={Truck} label="No carrier data" /> : (
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={carrierData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis type="number" tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <YAxis dataKey="name" type="category" tick={{ fill: 'currentColor', fontSize: 12 }} width={120} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="totalCost" fill="#F59E0B" radius={[0, 4, 4, 0]} name="Cost" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ═══════ CARRIERS TAB ═══════ */}
      {activeTab === 'carriers' && !isLoading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Total Carriers" value={formatNumber(carrierData.length)} change={0} trend="up" icon={Truck} color="bg-blue-100 text-blue-600" />
            <KPICard title="Total Shipments" value={formatNumber(totalShipments)} change={0} trend="up" icon={Package} color="bg-green-100 text-green-600" />
            <KPICard title="Avg. On-Time Rate" value={`${weightedOnTimeRate}%`} change={0} trend="up" icon={BarChart3} color="bg-purple-100 text-purple-600" />
            <KPICard title="Best Carrier" value={carrierData.length > 0 ? [...carrierData].sort((a, b) => b.onTimeRate - a.onTimeRate)[0].name : '—'} change={0} trend="up" icon={Truck} color="bg-yellow-100 text-yellow-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Shipments by Carrier</CardTitle></CardHeader>
              <CardContent>
                {carrierData.length === 0 ? <EmptyChart icon={Truck} label="No carrier data" /> : (
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={carrierData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis type="number" tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <YAxis dataKey="name" type="category" tick={{ fill: 'currentColor', fontSize: 12 }} width={120} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="totalShipments" fill="#3B82F6" radius={[0, 4, 4, 0]} name="Shipments" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Carrier On-Time Performance</CardTitle></CardHeader>
              <CardContent>
                {carrierData.length === 0 ? <EmptyChart icon={Truck} label="No carrier data" /> : (
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={carrierData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis type="number" domain={[0, 100]} tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <YAxis dataKey="name" type="category" tick={{ fill: 'currentColor', fontSize: 12 }} width={120} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="onTimeRate" fill="#10B981" radius={[0, 4, 4, 0]} name="On-Time %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Carrier detail table */}
          {carrierData.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Carrier Details</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-500 font-medium">Carrier</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium">Shipments</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium">Delivered</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium">On-Time %</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium">Avg Delay</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {carrierData.map((c, i) => (
                        <tr key={i} className="border-b border-gray-50 dark:border-gray-800">
                          <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">{c.name}</td>
                          <td className="text-right py-2 px-3">{formatNumber(c.totalShipments)}</td>
                          <td className="text-right py-2 px-3">{formatNumber(c.delivered)}</td>
                          <td className="text-right py-2 px-3">
                            <span className={cn('font-medium', c.onTimeRate >= 90 ? 'text-green-600' : c.onTimeRate >= 75 ? 'text-yellow-600' : 'text-red-600')}>
                              {c.onTimeRate}%
                            </span>
                          </td>
                          <td className="text-right py-2 px-3">{c.avgDelayHours.toFixed(1)}h</td>
                          <td className="text-right py-2 px-3">{formatCurrency(c.totalCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ═══════ WAREHOUSES TAB ═══════ */}
      {activeTab === 'warehouses' && !isLoading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Total Warehouses" value={formatNumber(warehouseData.length)} change={0} trend="up" icon={Warehouse} color="bg-blue-100 text-blue-600" />
            <KPICard title="Avg. Utilization" value={warehouseData.length > 0 ? `${(warehouseData.reduce((s, w) => s + w.utilization, 0) / warehouseData.length).toFixed(1)}%` : '0%'} change={0} trend="up" icon={BarChart3} color="bg-green-100 text-green-600" />
            <KPICard title="Highest Utilization" value={sortedByUtil.length > 0 ? `${sortedByUtil[0].name} (${sortedByUtil[0].utilization}%)` : '—'} change={0} trend="up" icon={Package} color="bg-purple-100 text-purple-600" />
            <KPICard title="Available Capacity" value={formatNumber(availableCapacity)} change={0} trend="up" icon={Package} color="bg-yellow-100 text-yellow-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Utilization Overview</CardTitle></CardHeader>
              <CardContent>
                {warehouseData.length === 0 ? <EmptyChart icon={Warehouse} label="No warehouse data" /> : (
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sortedByUtil} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis type="number" domain={[0, 100]} tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" tick={{ fill: 'currentColor', fontSize: 12 }} width={150} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="utilization" fill="#8B5CF6" radius={[0, 4, 4, 0]} name="Utilization %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Warehouse Activity</CardTitle></CardHeader>
              <CardContent>
                {warehouseData.length === 0 ? <EmptyChart icon={Warehouse} label="No warehouse data" /> : (
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={warehouseData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis dataKey="name" tick={{ fill: 'currentColor', fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="shipmentsProcessed" fill="#3B82F6" name="Shipments Processed" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="ordersFulfilled" fill="#10B981" name="Orders Fulfilled" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Warehouse detail table */}
          {warehouseData.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Warehouse Details</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-500 font-medium">Warehouse</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-medium">Code</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium">Capacity</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium">Stock</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium">Utilization</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium">Shipments</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium">Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedByUtil.map((w, i) => (
                        <tr key={i} className="border-b border-gray-50 dark:border-gray-800">
                          <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">{w.name}</td>
                          <td className="py-2 px-3 text-gray-500">{w.code}</td>
                          <td className="text-right py-2 px-3">{formatNumber(w.capacity)}</td>
                          <td className="text-right py-2 px-3">{formatNumber(w.currentStock)}</td>
                          <td className="text-right py-2 px-3">
                            <span className={cn('font-medium', w.utilization > 90 ? 'text-red-600' : w.utilization > 70 ? 'text-yellow-600' : 'text-green-600')}>
                              {w.utilization}%
                            </span>
                          </td>
                          <td className="text-right py-2 px-3">{formatNumber(w.shipmentsProcessed)}</td>
                          <td className="text-right py-2 px-3">{formatNumber(w.ordersFulfilled)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ═══════ PRODUCTS TAB ═══════ */}
      {activeTab === 'products' && !isLoading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Total Products" value={formatNumber(topProducts.length)} change={0} trend="up" icon={ShoppingCart} color="bg-blue-100 text-blue-600" />
            <KPICard title="Total Units Sold" value={formatNumber(topProducts.reduce((s, p) => s + p.unitsSold, 0))} change={0} trend="up" icon={Package} color="bg-green-100 text-green-600" />
            <KPICard title="Product Revenue" value={formatCurrency(topProducts.reduce((s, p) => s + p.revenue, 0))} change={0} trend="up" icon={DollarSign} color="bg-purple-100 text-purple-600" />
            <KPICard title="Top Product" value={topProducts.length > 0 ? topProducts[0].name : '—'} change={0} trend="up" icon={TrendingUp} color="bg-yellow-100 text-yellow-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by Product */}
            <Card>
              <CardHeader><CardTitle>Revenue by Product</CardTitle></CardHeader>
              <CardContent>
                {topProducts.length === 0 ? <EmptyChart icon={ShoppingCart} label="No product data" /> : (
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProducts.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis type="number" tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <YAxis dataKey="name" type="category" tick={{ fill: 'currentColor', fontSize: 11 }} width={140} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="revenue" fill="#10B981" radius={[0, 4, 4, 0]} name="Revenue" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Units sold pie */}
            <Card>
              <CardHeader><CardTitle>Units Sold Distribution</CardTitle></CardHeader>
              <CardContent>
                {topProducts.length === 0 ? <EmptyChart icon={ShoppingCart} label="No product data" /> : (
                  <div className="h-96 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={topProducts.slice(0, 6)} cx="50%" cy="50%" outerRadius={130} dataKey="unitsSold" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                          {topProducts.slice(0, 6).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Products Table */}
          {topProducts.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Product Performance Details</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-500 font-medium">#</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-medium">Product</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-medium">SKU</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-medium">Category</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium">Units Sold</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium">Revenue</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium">Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((p, i) => (
                        <tr key={i} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-2 px-3 text-gray-400">{i + 1}</td>
                          <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">{p.name}</td>
                          <td className="py-2 px-3 text-gray-500 font-mono text-xs">{p.sku}</td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{p.category || '—'}</span>
                          </td>
                          <td className="text-right py-2 px-3">{formatNumber(p.unitsSold)}</td>
                          <td className="text-right py-2 px-3 font-medium text-green-600">{formatCurrency(p.revenue)}</td>
                          <td className="text-right py-2 px-3">{formatNumber(p.orderCount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ═══════ FINANCIAL TAB ═══════ */}
      {activeTab === 'financial' && !isLoading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Total Revenue" value={formatCurrency(financialMetrics.totalRevenue)} change={0} trend="up" icon={DollarSign} color="bg-green-100 text-green-600" />
            <KPICard title="Shipping Costs" value={formatCurrency(financialMetrics.totalShippingCost)} change={0} trend="down" icon={Truck} color="bg-orange-100 text-orange-600" />
            <KPICard title="Penalties & Refunds" value={formatCurrency(financialMetrics.totalPenalties + financialMetrics.totalRefunds)} change={0} trend="down" icon={AlertTriangle} color="bg-red-100 text-red-600" />
            <KPICard title="Net Revenue" value={formatCurrency(netRevenue)} change={0} trend={netRevenue >= 0 ? 'up' : 'down'} icon={TrendingUp} color="bg-blue-100 text-blue-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Breakdown Pie */}
            <Card>
              <CardHeader><CardTitle>Cost Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="h-96 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Net Revenue', value: Math.max(0, netRevenue) },
                          { name: 'Shipping', value: financialMetrics.totalShippingCost },
                          { name: 'Penalties', value: financialMetrics.totalPenalties },
                          { name: 'Refunds', value: financialMetrics.totalRefunds },
                        ].filter(d => d.value > 0)}
                        cx="50%" cy="50%" innerRadius={80} outerRadius={130} paddingAngle={3} dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                      >
                        <Cell fill="#10B981" />
                        <Cell fill="#F59E0B" />
                        <Cell fill="#EF4444" />
                        <Cell fill="#8B5CF6" />
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary Cards */}
            <Card>
              <CardHeader><CardTitle>Financial Summary</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: 'Gross Revenue', value: formatCurrency(financialMetrics.totalRevenue), color: 'bg-green-500', pct: 100 },
                    { label: 'Shipping Costs', value: `-${formatCurrency(financialMetrics.totalShippingCost)}`, color: 'bg-orange-500', pct: financialMetrics.totalRevenue > 0 ? (financialMetrics.totalShippingCost / financialMetrics.totalRevenue) * 100 : 0 },
                    { label: 'Penalties', value: `-${formatCurrency(financialMetrics.totalPenalties)}`, color: 'bg-red-500', pct: financialMetrics.totalRevenue > 0 ? (financialMetrics.totalPenalties / financialMetrics.totalRevenue) * 100 : 0 },
                    { label: 'Refunds', value: `-${formatCurrency(financialMetrics.totalRefunds)}`, color: 'bg-purple-500', pct: financialMetrics.totalRevenue > 0 ? (financialMetrics.totalRefunds / financialMetrics.totalRevenue) * 100 : 0 },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{item.label}</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{item.value}</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                        <div className={cn('h-2 rounded-full', item.color)} style={{ width: `${Math.min(item.pct, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-semibold text-gray-900 dark:text-white">Net Revenue</span>
                      <span className={cn('text-lg font-bold', netRevenue >= 0 ? 'text-green-600' : 'text-red-600')}>
                        {formatCurrency(netRevenue)}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-center">
                      <p className="text-xs text-gray-500">Total Orders</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{formatNumber(financialMetrics.totalOrders)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-center">
                      <p className="text-xs text-gray-500">Avg. Order Value</p>
                      <p className="text-lg font-bold text-blue-600">{formatCurrency(financialMetrics.avgOrderValue)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ═══════ SLA & EXCEPTIONS TAB ═══════ */}
      {activeTab === 'sla' && !isLoading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Total Violations" value={formatNumber(slaViolations.reduce((s, v) => s + v.violations, 0))} change={0} trend="down" icon={AlertTriangle} color="bg-red-100 text-red-600" />
            <KPICard title="Total Penalties" value={formatCurrency(slaViolations.reduce((s, v) => s + v.totalPenalties, 0))} change={0} trend="down" icon={DollarSign} color="bg-orange-100 text-orange-600" />
            <KPICard title="Exception Types" value={formatNumber(exceptionsByType.length)} change={0} trend="up" icon={BarChart3} color="bg-purple-100 text-purple-600" />
            <KPICard title="Resolution Rate" value={exceptionsByType.length > 0 ? `${Math.round(exceptionsByType.reduce((s, e) => s + e.resolved, 0) / Math.max(exceptionsByType.reduce((s, e) => s + e.count, 0), 1) * 100)}%` : '—'} change={0} trend="up" icon={RotateCcw} color="bg-green-100 text-green-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SLA Violations Trend */}
            <Card>
              <CardHeader><CardTitle>SLA Violations Over Time</CardTitle></CardHeader>
              <CardContent>
                {slaViolations.length === 0 ? <EmptyChart icon={AlertTriangle} label="No SLA violation data" /> : (
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={slaViolations}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis dataKey="date" tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <YAxis yAxisId="left" tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line yAxisId="left" type="monotone" dataKey="violations" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} name="Violations" />
                        <Line yAxisId="right" type="monotone" dataKey="totalPenalties" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} name="Penalties ($)" />
                        <Legend />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Exceptions Breakdown */}
            <Card>
              <CardHeader><CardTitle>Exceptions by Type & Resolution</CardTitle></CardHeader>
              <CardContent>
                {exceptionsByType.length === 0 ? <EmptyChart icon={AlertTriangle} label="No exception data" /> : (
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={exceptionsByType}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis dataKey="type" tick={{ fill: 'currentColor', fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis tick={{ fill: 'currentColor', fontSize: 12 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" fill="#F59E0B" name="Total" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="resolved" fill="#10B981" name="Resolved" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Exceptions detail table */}
          {exceptionsByType.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Exception Details</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-500 font-medium">Type</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-medium">Severity</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium">Count</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium">Resolved</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium">Pending</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium">Avg Resolution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exceptionsByType.map((e, i) => (
                        <tr key={i} className="border-b border-gray-50 dark:border-gray-800">
                          <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">{e.type}</td>
                          <td className="py-2 px-3">
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                              e.severity === 'critical' ? 'bg-red-100 text-red-700' :
                              e.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                              e.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-blue-100 text-blue-700'
                            )}>{e.severity}</span>
                          </td>
                          <td className="text-right py-2 px-3">{e.count}</td>
                          <td className="text-right py-2 px-3 text-green-600">{e.resolved}</td>
                          <td className="text-right py-2 px-3 text-red-600">{e.count - e.resolved}</td>
                          <td className="text-right py-2 px-3">{e.avgResolutionHours.toFixed(1)}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
