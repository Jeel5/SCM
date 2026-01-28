import { Package } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import type { WarehouseUtilization } from '@/types';

export interface WarehouseUtilizationChartProps {
  data: WarehouseUtilization[];
}

const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B'];

export function WarehouseUtilizationChart({ data }: WarehouseUtilizationChartProps) {
  // Cast data for Recharts compatibility
  const chartData = data as unknown as Array<Record<string, unknown>>;

  return (
    <Card>
      <CardHeader>
        <CardTitle subtitle="Capacity usage">Warehouse Utilization</CardTitle>
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
        <div className="flex items-center justify-center mb-4">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="utilizationRate"
                nameKey="warehouseName"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Utilization']}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {data.map((warehouse, index) => (
            <div key={warehouse.warehouseId} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm text-gray-600 truncate">{warehouse.warehouseName.split(' ')[0]}</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{warehouse.utilizationRate.toFixed(0)}%</span>
            </div>
          ))}
        </div>
        </>
        )}
      </CardContent>
    </Card>
  );
}
