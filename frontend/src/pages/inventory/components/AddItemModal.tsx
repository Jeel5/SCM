import { useState, useEffect, useRef } from 'react';
import { Modal, Button, Input, Select } from '@/components/ui';
import { inventoryApi, productsApi } from '@/api/services';
import { formatCurrency } from '@/lib/utils';
import { Search, Package2, X, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Warehouse, Product } from '@/types';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  onSuccess?: () => void;
}

interface InventoryFields {
  warehouse_id: string;
  quantity: string;
  reorder_point: string;
  max_stock_level: string;
}

const INITIAL_FIELDS: InventoryFields = {
  warehouse_id: '',
  quantity: '',
  reorder_point: '',
  max_stock_level: '',
};

export function AddItemModal({ isOpen, onClose, warehouses, onSuccess }: AddItemModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [fields, setFields] = useState<InventoryFields>(INITIAL_FIELDS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Product search with debounce
  useEffect(() => {
    if (!searchQuery.trim() || selectedProduct) {
      setSearchResults([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await productsApi.getProducts({ search: searchQuery, is_active: 'true', limit: 10 });
        setSearchResults(res.data);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [searchQuery, selectedProduct]);

  function setField(f: keyof InventoryFields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFields(prev => ({ ...prev, [f]: e.target.value }));
  }

  function selectProduct(p: Product) {
    setSelectedProduct(p);
    setSearchQuery('');
    setSearchResults([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedProduct) { setError('Please select a product from the catalog.'); return; }
    if (!fields.warehouse_id) { setError('Please select a warehouse.'); return; }
    if (!fields.quantity || Number(fields.quantity) < 0) { setError('Quantity must be 0 or greater.'); return; }

    const payload: Record<string, unknown> = {
      product_id: selectedProduct.id,
      warehouse_id: fields.warehouse_id,
      quantity: Number(fields.quantity),
    };
    if (fields.reorder_point !== '') payload.reorder_point = Number(fields.reorder_point);
    if (fields.max_stock_level !== '') payload.max_stock_level = Number(fields.max_stock_level);

    try {
      setIsSubmitting(true);
      await inventoryApi.createInventoryItem(payload as any);
      resetAndClose();
      onSuccess?.();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || 'Failed to add stock.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetAndClose() {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedProduct(null);
    setFields(INITIAL_FIELDS);
    setError(null);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title="Add Stock to Inventory" size="2xl">
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Step 1: Product selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              1. Select Product
            </p>
            <Link
              to="/products"
              onClick={resetAndClose}
              className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Manage Catalog
            </Link>
          </div>

          {selectedProduct ? (
            /* Selected product card */
            <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20">
              <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                <Package2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate">{selectedProduct.name}</p>
                <p className="text-xs text-gray-500 font-mono">{selectedProduct.sku}{selectedProduct.category ? ` · ${selectedProduct.category}` : ''}</p>
              </div>
              {selectedProduct.sellingPrice != null && (
                <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 shrink-0">
                  {formatCurrency(selectedProduct.sellingPrice, selectedProduct.currency)}
                </p>
              )}
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="p-1 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 text-indigo-500 shrink-0"
                title="Change product"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* Product search */
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by product name or SKU…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {/* Search dropdown */}
              {(searchResults.length > 0 || isSearching) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden max-h-56 overflow-y-auto">
                  {isSearching ? (
                    <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-400">No products found</div>
                  ) : (
                    searchResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectProduct(p)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-left transition-colors"
                      >
                        <Package2 className="h-4 w-4 text-indigo-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{p.sku}{p.category ? ` · ${p.category}` : ''}</p>
                        </div>
                        {p.sellingPrice != null && (
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-300 shrink-0">
                            {formatCurrency(p.sellingPrice, p.currency)}
                          </p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
              {searchQuery && !isSearching && searchResults.length === 0 && (
                <p className="mt-1.5 text-xs text-gray-400">
                  Product not found?{' '}
                  <Link to="/products" onClick={resetAndClose} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                    Create it in the catalog first
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Inventory placement (only shown after product selected) */}
        {selectedProduct && (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                2. Storage Location
              </p>
              <div className="grid grid-cols-1 gap-4">
                <Select
                  label="Warehouse *"
                  value={fields.warehouse_id}
                  onChange={setField('warehouse_id')}
                  options={[
                    { value: '', label: 'Select warehouse…' },
                    ...warehouses.map(w => ({ value: w.id, label: w.name })),
                  ]}
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                3. Stock Levels
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Input
                  label="Quantity *"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={fields.quantity}
                  onChange={setField('quantity')}
                  required
                />
                <Input
                  label="Reorder Point"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={fields.reorder_point}
                  onChange={setField('reorder_point')}
                />
                <Input
                  label="Max Stock Level"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={fields.max_stock_level}
                  onChange={setField('max_stock_level')}
                />
              </div>
            </div>
          </>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="outline" onClick={resetAndClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={isSubmitting || !selectedProduct}>
            {isSubmitting ? 'Adding…' : 'Add to Inventory'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
