import { ShoppingCart } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { ChartDataPoint } from '@/types';

export interface OrdersTrendChartProps {
  data: ChartDataPoint[];
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          {formatDate(label, 'MMM dd, yyyy')}
        </p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {payload[0].value}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">orders</p>
        </div>
      </div>
    );
  }
  return null;
};

export function OrdersTrendChart({ data }: OrdersTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle subtitle="Last 30 days">Orders Trend</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <ShoppingCart className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No order data available</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Order trends will appear when available</p>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => formatDate(value, 'MMM dd')}
              tick={{ fontSize: 12, fill: 'currentColor', className: 'text-gray-600 dark:text-gray-400' }}
            />
            <YAxis tick={{ fontSize: 12, fill: 'currentColor', className: 'text-gray-600 dark:text-gray-400' }} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3B82F6', strokeWidth: 1, strokeDasharray: '5 5' }} />
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
        )}
      </CardContent>
    </Card>
  );
}
