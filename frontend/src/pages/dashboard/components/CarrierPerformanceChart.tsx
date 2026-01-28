import { Truck } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import type { CarrierPerformance } from '@/types';

export interface CarrierPerformanceChartProps {
  data: CarrierPerformance[];
}

export function CarrierPerformanceChart({ data }: CarrierPerformanceChartProps) {
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
        )}
      </CardContent>
    </Card>
  );
}
