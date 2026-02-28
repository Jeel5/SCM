import { TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';

export interface TopProductsTableProps {
  data: Array<{ name: string; sku: string; unitsSold: number; revenue: number }>;
}

export function TopProductsTable({ data }: TopProductsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle subtitle="By units sold">Top Products</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <TrendingUp className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No product data</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Top products will appear when orders exist</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((product, i) => {
              const maxUnits = data[0]?.unitsSold || 1;
              const pct = (product.unitsSold / maxUnits) * 100;
              return (
                <div key={product.sku || i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-400">{product.sku}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {product.unitsSold.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">{formatCurrency(product.revenue)}</p>
                    </div>
                  </div>
                  <div className="ml-7 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
