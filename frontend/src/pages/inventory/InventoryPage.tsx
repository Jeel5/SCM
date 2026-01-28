import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Download, Plus, Eye } from 'lucide-react';
import { Card, Button, DataTable, Badge, Tabs } from '@/components/ui';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { InventoryItem } from '@/types';
import {
  StockLevelIndicator,
  InventoryDetailsModal,
  AddItemModal,
  InventoryStats,
} from './components';
import { useInventory } from './hooks';

export function InventoryPage() {
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const pageSize = 10;
  const { inventory, warehouses, totalItems, isLoading } = useInventory(page, pageSize);

  // Tab badge counts
  const lowStockItems = inventory.filter((i) => i.quantity <= i.reorderPoint).length;
  const outOfStockItems = inventory.filter((i) => i.quantity === 0).length;
  const overstockedItems = inventory.filter((i) => i.quantity > i.reorderPoint * 2).length;
  const totalValue = inventory.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);

  // Filter list by active tab
  const filteredInventory = inventory.filter((item) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'low_stock') return item.quantity <= item.reorderPoint;
    if (activeTab === 'out_of_stock') return item.quantity === 0;
    if (activeTab === 'overstocked') return item.quantity > item.reorderPoint * 2;
    return true;
  });

  const tabs = [
    { id: 'all', label: 'All Items', count: inventory.length },
    { id: 'low_stock', label: 'Low Stock', count: lowStockItems },
    { id: 'out_of_stock', label: 'Out of Stock', count: outOfStockItems },
    { id: 'overstocked', label: 'Overstocked', count: overstockedItems },
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
      <InventoryStats
        totalItems={totalItems}
        totalValue={totalValue}
        lowStockItems={lowStockItems}
        warehouses={warehouses}
      />

      {/* Data Table */}
      <Card padding="none">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        <DataTable
          columns={columns}
          data={filteredInventory}
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
