import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  Boxes,
  TrendingUp,
  AlertTriangle,
  Download,
  Plus,
  Eye,
  Edit,
  ArrowUpDown,
} from 'lucide-react';
import {
  Card,
  Button,
  DataTable,
  Badge,
  Modal,
  Input,
  Select,
  Progress,
  Tabs,
} from '@/components/ui';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import { inventoryApi, warehousesApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import type { InventoryItem, Warehouse } from '@/types';

// Stock Level Indicator
function StockLevelIndicator({ item }: { item: InventoryItem }) {
  const percentage = (item.quantity / item.maxQuantity) * 100;
  let color = 'bg-green-500';
  let status = 'Healthy';

  if (item.quantity <= item.reorderPoint) {
    color = 'bg-red-500';
    status = 'Critical';
  } else if (percentage <= 30) {
    color = 'bg-yellow-500';
    status = 'Low';
  } else if (percentage >= 90) {
    color = 'bg-blue-500';
    status = 'Overstocked';
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={cn(
          'font-medium',
          status === 'Critical' && 'text-red-600 dark:text-red-400',
          status === 'Low' && 'text-yellow-600 dark:text-yellow-400',
          status === 'Healthy' && 'text-green-600 dark:text-green-400',
          status === 'Overstocked' && 'text-blue-600 dark:text-blue-400'
        )}>
          {status}
        </span>
        <span className="text-gray-500 dark:text-gray-400">{percentage.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5 }}
          className={cn('h-full rounded-full', color)}
        />
      </div>
    </div>
  );
}

// Inventory Details Modal
function InventoryDetailsModal({
  item,
  isOpen,
  onClose,
}: {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!item) return null;

  const stockPercentage = (item.quantity / item.maxQuantity) * 100;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Inventory Details" size="lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-white dark:bg-gray-900 flex items-center justify-center shadow-sm">
              <Boxes className="h-8 w-8 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{item.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {item.sku}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={item.category === 'electronics' ? 'info' : 'default'}>
                  {item.category}
                </Badge>
                <Badge variant="outline">{item.unit}</Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(item.quantity)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">in stock</p>
          </div>
        </div>

        {/* Stock Level Visual */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Stock Level</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {formatNumber(item.quantity)} / {formatNumber(item.maxQuantity)}
            </span>
          </div>
          <Progress value={stockPercentage} size="lg" showLabel />
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500 dark:text-gray-400">
            <span>Min: {formatNumber(item.minQuantity)}</span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-yellow-500" />
              Reorder: {formatNumber(item.reorderPoint)}
            </span>
            <span>Max: {formatNumber(item.maxQuantity)}</span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Unit Cost</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">{formatCurrency(item.unitCost)}</p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Value</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">
              {formatCurrency(item.quantity * item.unitCost)}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Warehouse</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{item.warehouseName}</p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Location</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{item.location}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button variant="primary" className="flex-1" leftIcon={<ArrowUpDown className="h-4 w-4" />}>
            Adjust Stock
          </Button>
          <Button variant="outline" className="flex-1" leftIcon={<Edit className="h-4 w-4" />}>
            Edit Item
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Add Item Modal
function AddItemModal({
  isOpen,
  onClose,
  warehouses,
}: {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Inventory Item" size="lg">
      <form className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Product Name" placeholder="Enter product name" required />
          <Input label="SKU" placeholder="Enter SKU" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Category"
            options={[
              { value: 'electronics', label: 'Electronics' },
              { value: 'clothing', label: 'Clothing' },
              { value: 'food', label: 'Food & Beverages' },
              { value: 'furniture', label: 'Furniture' },
              { value: 'other', label: 'Other' },
            ]}
          />
          <Select
            label="Warehouse"
            options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input label="Quantity" type="number" placeholder="0" required />
          <Input label="Unit Cost" type="number" placeholder="0.00" required />
          <Select
            label="Unit"
            options={[
              { value: 'pieces', label: 'Pieces' },
              { value: 'boxes', label: 'Boxes' },
              { value: 'pallets', label: 'Pallets' },
              { value: 'kg', label: 'Kilograms' },
            ]}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input label="Min Qty" type="number" placeholder="0" />
          <Input label="Reorder Point" type="number" placeholder="0" />
          <Input label="Max Qty" type="number" placeholder="0" />
        </div>
        <Input label="Storage Location" placeholder="e.g., Aisle A, Rack 3, Shelf 2" />
        <div className="flex items-center gap-3 pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1">
            Add Item
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Main Inventory Page
export function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const pageSize = 10;

  // Calculate stats
  const lowStockItems = inventory.filter((i) => i.quantity <= i.reorderPoint).length;
  const totalValue = inventory.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);

  const tabs = [
    { id: 'all', label: 'All Items', count: totalItems },
    { id: 'low_stock', label: 'Low Stock', count: lowStockItems },
    { id: 'out_of_stock', label: 'Out of Stock' },
    { id: 'overstocked', label: 'Overstocked' },
  ];

  const columns = [
    {
      key: 'product',
      header: 'Product',
      sortable: true,
      render: (item: InventoryItem) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {item.sku}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (item: InventoryItem) => (
        <Badge variant="outline" className="capitalize">
          {item.category}
        </Badge>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      sortable: true,
      render: (item: InventoryItem) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{formatNumber(item.quantity)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{item.unit}</p>
        </div>
      ),
    },
    {
      key: 'stockLevel',
      header: 'Stock Level',
      width: '180px',
      render: (item: InventoryItem) => <StockLevelIndicator item={item} />,
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (item: InventoryItem) => (
        <span className="text-gray-700 dark:text-gray-300">{item.warehouseName}</span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      sortable: true,
      render: (item: InventoryItem) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {formatCurrency(item.quantity * item.unitCost)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      render: (item: InventoryItem) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedItem(item);
            setIsDetailsOpen(true);
          }}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <Eye className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </button>
      ),
    },
  ];

  useEffect(() => {
    const fetchData = async () => {
      const useMockApi = localStorage.getItem('useMockApi') === 'true';
      setIsLoading(true);
      try {
        const [inventoryRes, warehouseRes] = useMockApi
          ? await Promise.all([
              mockApi.getInventory(page, pageSize),
              mockApi.getWarehouses(),
            ])
          : await Promise.all([
              inventoryApi.getInventory(page, pageSize),
              warehousesApi.getWarehouses(),
            ]);
        setInventory(inventoryRes.data);
        setTotalItems(inventoryRes.total);
        setWarehouses(warehouseRes.data);
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
        setInventory([]);
        setTotalItems(0);
        setWarehouses([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [page]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track stock levels and manage inventory across warehouses</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />}>
            Export
          </Button>
          <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsAddOpen(true)}>
            Add Item
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Items',
            value: formatNumber(totalItems),
            icon: Boxes,
            color: 'bg-blue-100 text-blue-600',
          },
          {
            label: 'Total Value',
            value: formatCurrency(totalValue),
            icon: TrendingUp,
            color: 'bg-green-100 text-green-600',
          },
          {
            label: 'Low Stock',
            value: lowStockItems,
            icon: AlertTriangle,
            color: 'bg-yellow-100 text-yellow-600',
          },
          {
            label: 'Warehouses',
            value: warehouses.length,
            icon: Package,
            color: 'bg-purple-100 text-purple-600',
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', stat.color)}>
                <stat.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Data Table */}
      <Card padding="none">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        <DataTable
          columns={columns}
          data={inventory}
          isLoading={isLoading}
          searchPlaceholder="Search by product name or SKU..."
          pagination={{
            page,
            pageSize,
            total: totalItems,
            onPageChange: setPage,
          }}
          onRowClick={(item) => {
            setSelectedItem(item);
            setIsDetailsOpen(true);
          }}
          emptyMessage="No inventory items found"
          className="border-0 rounded-none"
        />
      </Card>

      {/* Modals */}
      <InventoryDetailsModal
        item={selectedItem}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedItem(null);
        }}
      />

      <AddItemModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        warehouses={warehouses}
      />
    </div>
  );
}
