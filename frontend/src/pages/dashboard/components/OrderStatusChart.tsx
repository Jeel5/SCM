import { ShoppingBag } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import type { DashboardMetrics } from '@/types';

export interface OrderStatusChartProps {
  metrics: DashboardMetrics | null;
}

const STATUS_CONFIG: { key: keyof DashboardMetrics; label: string; color: string }[] = [
  { key: 'ordersPending',    label: 'Pending',    color: '#F59E0B' },
  { key: 'ordersProcessing', label: 'Processing', color: '#3B82F6' },
  { key: 'ordersShipped',    label: 'Shipped',    color: '#8B5CF6' },
  { key: 'ordersDelivered',  label: 'Delivered',  color: '#10B981' },
  { key: 'ordersCancelled',  label: 'Cancelled',  color: '#EF4444' },
  { key: 'ordersReturned',   label: 'Returned',   color: '#F97316' },
];

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number; payload?: Record<string, unknown> }> }) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{item.name}</p>
        <p className="text-lg font-bold" style={{ color: (item.payload?.color as string) ?? undefined }}>
          {item.value}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">orders</p>
      </div>
    );
  }
  return null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderLegend = (props: any) => {
  const payload = props?.payload as Array<{ value: string; color: string }> | undefined;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
      {payload?.map((entry, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-xs text-gray-600 dark:text-gray-300">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export function OrderStatusChart({ metrics }: OrderStatusChartProps) {
  if (!metrics) return null;

  const chartData = STATUS_CONFIG
    .map(cfg => ({
      name: cfg.label,
      value: (metrics[cfg.key] as number) || 0,
      color: cfg.color,
    }))
    .filter(d => d.value > 0);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle subtitle="By current status">Order Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <ShoppingBag className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No order data</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Orders will appear when available</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend content={renderLegend} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center mt-1">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{total}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Orders</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
