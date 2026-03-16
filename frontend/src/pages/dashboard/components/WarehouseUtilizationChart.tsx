import { Package, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import type { WarehouseUtilization } from '@/types';

export interface WarehouseUtilizationChartProps {
  data: WarehouseUtilization[];
}

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    const wh = payload[0]?.payload;
    return (
      <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 min-w-45">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{label}</p>
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Capacity</span>
            <span className="font-medium text-gray-900 dark:text-white">{wh?.capacity?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Used</span>
            <span className="font-medium text-blue-600">{wh?.used?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Utilization</span>
            <span className="font-bold text-blue-600">{wh?.utilizationRate?.toFixed(1)}%</span>
          </div>
          <hr className="border-gray-200 dark:border-gray-700" />
          <div className="flex justify-between text-sm">
            <span className="text-emerald-600 flex items-center gap-1"><ArrowDownToLine className="h-3 w-3" /> Inbound</span>
            <span className="font-medium">{wh?.inbound?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-orange-500 flex items-center gap-1"><ArrowUpFromLine className="h-3 w-3" /> Outbound</span>
            <span className="font-medium">{wh?.outbound?.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function WarehouseUtilizationChart({ data }: WarehouseUtilizationChartProps) {
  const chartData = data.map(wh => ({
    name: wh.warehouseName.length > 12 ? wh.warehouseName.slice(0, 12) + '…' : wh.warehouseName,
    fullName: wh.warehouseName,
    used: wh.used,
    available: Math.max((wh.capacity || 0) - wh.used, 0),
    capacity: wh.capacity || 0,
    utilizationRate: wh.utilizationRate,
    inbound: wh.inboundToday,
    outbound: wh.outboundToday,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle subtitle="Capacity & activity">Warehouse Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <Package className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No warehouse data</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Utilization data will appear when available</p>
          </div>
        ) : (
          <>
            {/* Stacked bar chart: used vs available capacity */}
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-gray-500" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fontSize: 12, fill: 'currentColor' }}
                  className="text-gray-700 dark:text-gray-200"
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="used" stackId="cap" fill="#3B82F6" name="Used" radius={[0, 0, 0, 0]} />
                <Bar dataKey="available" stackId="cap" fill="#E5E7EB" name="Available" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Inbound / Outbound summary per warehouse */}
            <div className="mt-4 space-y-2">
              {data.map(wh => (
                <div key={wh.warehouseId} className="flex items-center justify-between px-1">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300 truncate max-w-[40%]">
                    {wh.warehouseName}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 text-xs text-emerald-600" title="Inbound units">
                      <ArrowDownToLine className="h-3 w-3" /> {wh.inboundToday.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-orange-500" title="Outbound units">
                      <ArrowUpFromLine className="h-3 w-3" /> {wh.outboundToday.toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white w-10 text-right">
                      {wh.utilizationRate.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
