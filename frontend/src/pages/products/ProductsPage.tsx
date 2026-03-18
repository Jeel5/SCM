import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Package2, Plus, Upload, AlertTriangle, Snowflake, Zap,
  CheckCircle, XCircle, Tag, Edit2, Eye, Trash2, Flame,
} from 'lucide-react';
import { Card, Button, Badge, DataTable, useToast } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { extractSafeErrorMessage } from '@/lib/apiErrors';
import type { Product } from '@/types';
import { AddEditProductModal, ProductDetailsModal } from './components';
import { useProducts } from './hooks';
import { importApi, productsApi } from '@/api/services';

const PAGE_SIZE = 20;
const CATEGORIES = [
  'Electronics', 'Clothing', 'Food & Beverage', 'Furniture', 'Health & Beauty',
  'Industrial', 'Office Supplies', 'Sports & Outdoors', 'Toys & Games',
  'Automotive', 'Books & Media', 'Other',
];

export function ProductsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'true' | 'false'>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const importRef = useRef<HTMLInputElement | null>(null);
  const { success, error } = useToast();

  const filters: Record<string, unknown> = {};
  if (search) filters.search = search;
  if (categoryFilter) filters.category = categoryFilter;
  if (statusFilter !== '') filters.is_active = statusFilter;

  const { products, totalItems, stats, isLoading, refetch } = useProducts(page, PAGE_SIZE, filters);

  const openAdd = () => { setSelectedProduct(null); setIsAddEditOpen(true); };
  const openEdit = (p: Product) => { setSelectedProduct(p); setIsAddEditOpen(true); setIsDetailsOpen(false); };
  const openDetails = (p: Product) => { setSelectedProduct(p); setIsDetailsOpen(true); };

  const handleDelete = async (p: Product) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await productsApi.deleteProduct(p.id);
      success('Product deleted', `"${p.name}" has been removed.`);
      refetch();
    } catch (err: unknown) {
      error('Failed to delete product', extractSafeErrorMessage(err, 'Could not delete the product'));
    }
  };

  const handleImportCsv = async (file: File) => {
    try {
      const resp = await importApi.upload(file, 'products');
      success('Products import started', `Job queued (${resp.totalRows} rows).`);
      setTimeout(() => refetch(), 1500);
    } catch (e: any) {
      error('Import failed', e?.message || 'Could not read CSV file');
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Product',
      render: (p: Product) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
            <Package2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{p.name}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (p: Product) => (
        p.category
          ? <Badge variant="outline">{p.category}</Badge>
          : <span className="text-gray-400">—</span>
      ),
    },
    {
      key: 'sellingPrice',
      header: 'Selling Price',
      render: (p: Product) => (
        p.sellingPrice != null
          ? <span className="font-medium">{formatCurrency(p.sellingPrice, p.currency)}</span>
          : <span className="text-gray-400">—</span>
      ),
    },
    {
      key: 'weight',
      header: 'Weight',
      render: (p: Product) => (
        p.weight != null
          ? <span>{p.weight} kg</span>
          : <span className="text-gray-400">—</span>
      ),
    },
    {
      key: 'flags',
      header: 'Flags',
      render: (p: Product) => (
        <div className="flex items-center gap-1">
          {p.isFragile && (
            <span title="Fragile" className="text-orange-500">
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
          )}
          {p.requiresColdStorage && (
            <span title="Cold Storage" className="text-blue-500">
              <Snowflake className="h-3.5 w-3.5" />
            </span>
          )}
          {p.isHazmat && (
            <span title="HAZMAT" className="text-red-500">
              <Zap className="h-3.5 w-3.5" />
            </span>
          )}
          {p.isPerishable && (
            <span title="Perishable" className="text-yellow-500">
              <Flame className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (p: Product) => (
        <Badge variant={p.isActive ? 'success' : 'error'}>
          {p.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p: Product) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => openDetails(p)}
            title="View"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => openEdit(p)}
            title="Edit"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(p)}
            title="Delete"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const statCards = [
    {
      label: 'Total Products', value: stats.totalProducts,
      icon: Package2, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    },
    {
      label: 'Active', value: stats.active,
      icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      label: 'Inactive', value: stats.inactive,
      icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30',
    },
    {
      label: 'Categories', value: stats.categories,
      icon: Tag, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Package2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Product Catalog</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage your product master data</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => importRef.current?.click()} className="flex items-center gap-2">
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button variant="primary" onClick={openAdd} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`h-9 w-9 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value as '' | 'true' | 'false'); setPage(1); }}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          {(categoryFilter || statusFilter) && (
            <button
              onClick={() => { setCategoryFilter(''); setStatusFilter(''); setPage(1); }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <DataTable
        columns={columns}
        data={products}
        isLoading={isLoading}
        searchable
        searchPlaceholder="Search products…"
        onSearch={q => { setSearch(q); setPage(1); }}
        onRowClick={openDetails}
        emptyMessage="No products found. Add your first product to get started."
        pagination={
          totalItems > PAGE_SIZE
            ? { page, pageSize: PAGE_SIZE, total: totalItems, onPageChange: setPage }
            : undefined
        }
      />

      {/* Modals */}
      <AddEditProductModal
        isOpen={isAddEditOpen}
        onClose={() => setIsAddEditOpen(false)}
        onSuccess={refetch}
        product={selectedProduct}
      />
      <ProductDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        onEdit={selectedProduct ? () => openEdit(selectedProduct) : undefined}
        product={selectedProduct}
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
