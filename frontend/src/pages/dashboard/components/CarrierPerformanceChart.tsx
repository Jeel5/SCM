import { Truck } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import type { CarrierPerformance } from '@/types';

export interface CarrierPerformanceChartProps {
  data: CarrierPerformance[];
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
          {payload[0].payload.name}
        </p>
        <p className="text-lg font-bold text-green-600 dark:text-green-400">
          {Number(payload[0].value).toFixed(1)}%
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">On-time delivery</p>
      </div>
    );
  }
  return null;
};

export function CarrierPerformanceChart({ data }: CarrierPerformanceChartProps) {
  const chartData = data.map((d) => ({
    name: d.carrierName.split(' ')[0],
    fullName: d.carrierName,
    onTime: d.onTimeRate,
    late: 100 - d.onTimeRate,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle subtitle="On-time delivery rates">Carrier Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <Truck className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No carrier data available</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Performance metrics will appear when available</p>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis 
              type="number" 
              domain={[0, 100]} 
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: 'currentColor', fontSize: 12 }}
              className="text-gray-600 dark:text-gray-300"
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={70}
              tick={{ fill: 'currentColor', fontSize: 13 }}
              className="text-gray-700 dark:text-gray-200 font-medium"
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
            <Bar dataKey="onTime" stackId="a" fill="#10B981" radius={[0, 4, 4, 0]} name="On Time" />
          </BarChart>
        </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
