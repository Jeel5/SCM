import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Download, Upload, Plus, Eye } from 'lucide-react';
import { Card, Button, DataTable, Badge, Tabs, PermissionGate, useToast } from '@/components/ui';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { importApi, inventoryApi } from '@/api/services';
import type { InventoryItem } from '@/types';
import {
  StockLevelIndicator,
  InventoryDetailsModal,
  AddItemModal,
  EditItemModal,
  InventoryStats,
  LowStockAlerts,
  AdjustStockModal,
} from './components';
import { useInventory } from './hooks';

export function InventoryPage() {
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const importRef = useRef<HTMLInputElement | null>(null);
  const { success, error } = useToast();

  const pageSize = 10;
  const { inventory, warehouses, totalItems, stats, isLoading, refetch } = useInventory(page, pageSize);

  const handleImportCsv = async (file: File) => {
    try {
      const resp = await importApi.upload(file, 'inventory');
      success('Inventory import started', `Job queued (${resp.totalRows} rows).`);
      setTimeout(() => refetch(), 1500);
    } catch (e: any) {
      error('Import failed', e?.message || 'Could not read CSV file');
    }
  };

  const handleExport = () => {
    if (!inventory.length) return;
    const headers = ['SKU', 'Product Name', 'Warehouse', 'Quantity', 'Reserved', 'Available', 'Reorder Point', 'Unit Cost', 'Low Stock', 'Out of Stock'];
    const rows = inventory.map((item) => [
      item.sku,
      item.productName || item.name || '',
      item.warehouseName || '',
      item.quantity,
      item.reservedQuantity ?? 0,
      item.availableQuantity ?? item.quantity - (item.reservedQuantity ?? 0),
      item.reorderPoint ?? '',
      item.unitCost ?? '',
      item.isLowStock ? 'Yes' : 'No',
      item.isOutOfStock ? 'Yes' : 'No',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Tab badge counts and stats from backend
  const lowStockItems = stats?.lowStockItems || 0;
  const outOfStockItems = stats?.outOfStockItems || 0;
  const totalValue = stats?.totalValue || stats?.totalInventoryValue || 0; // Depends on exact response
  const overstockedItems = 0; // Not returned directly by API stats without custom query

  // Filter list by active tab
  const filteredInventory = inventory.filter((item) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'low_stock') return item.isLowStock;
    if (activeTab === 'out_of_stock') return item.isOutOfStock;
    if (activeTab === 'overstocked') return item.maxStockLevel != null && item.quantity > item.maxStockLevel * 0.9;
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
            <p className="font-medium text-gray-900 dark:text-white">{item.productName || '—'}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {item.sku || 'N/A'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (item: InventoryItem) => (
        <Badge variant="outline" className="capitalize">
          {item.productCategory || '—'}
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
          <p className="text-xs text-gray-500 dark:text-gray-400">{item.availableQuantity} available</p>
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
          {formatCurrency(item.unitCost != null ? item.quantity * item.unitCost : 0)}
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
          <Button variant="outline" leftIcon={<Upload className="h-4 w-4" />} onClick={() => importRef.current?.click()}>
            Import
          </Button>
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={handleExport}>
            Export
          </Button>
          <PermissionGate permission="inventory.update">
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsAddOpen(true)}>
              Add Item
            </Button>
          </PermissionGate>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <InventoryStats
        totalItems={totalItems}
        totalValue={totalValue}
        lowStockItems={lowStockItems}
        warehouses={warehouses}
      />

      {/* Low Stock Alerts */}
      {lowStockItems > 0 && (
        <LowStockAlerts
          onViewAll={() => setActiveTab('low_stock')}
        />
      )}

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
        onAdjustStock={() => {
          setIsDetailsOpen(false);
          setIsAdjustOpen(true);
        }}
        onEdit={() => {
          setIsDetailsOpen(false);
          setIsEditOpen(true);
        }}
      />

      <AdjustStockModal
        item={selectedItem}
        isOpen={isAdjustOpen}
        onClose={() => {
          setIsAdjustOpen(false);
          setSelectedItem(null);
        }}
        onSuccess={() => {
          setIsAdjustOpen(false);
          setSelectedItem(null);
          refetch();
        }}
      />

      <EditItemModal
        item={selectedItem}
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedItem(null);
        }}
        onSuccess={() => {
          setIsEditOpen(false);
          setSelectedItem(null);
          refetch();
        }}
      />

      <AddItemModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        warehouses={warehouses}
        onSuccess={() => {
          setIsAddOpen(false);
          refetch();
        }}
      />
      <input
        ref={importRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportCsv(file);
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
}
