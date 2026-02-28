import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button, Input, Select, useToast } from '@/components/ui';
import { api } from '@/api/client';
import { productsApi } from '@/api/services';
import type { Product } from '@/types';
import { Package, Plus, Trash2, Search, AlertTriangle, CheckCircle } from 'lucide-react';

interface StockInfo {
  warehouseId: string;
  warehouseName: string;
  availableQuantity: number;
  reservedQuantity: number;
  sku: string;
}

interface OrderItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  stock: StockInfo[];        // stock across warehouses
  totalAvailable: number;    // sum of available across all warehouses
}

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateOrderModal({ isOpen, onClose, onSuccess }: CreateOrderModalProps) {
  const { success, error } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    priority: 'standard',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
  });

  // Product search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Multi-item state
  const [items, setItems] = useState<OrderItem[]>([]);

  // Product search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await productsApi.getProducts({ search: searchQuery, is_active: 'true', limit: 10 });
        setSearchResults(res.data);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch stock info for a product
  const fetchStockForProduct = useCallback(async (product: Product): Promise<{ stock: StockInfo[]; totalAvailable: number }> => {
    try {
      const res = await api.get('/inventory', { params: { search: product.sku, limit: 50 } });
      const inventoryData = res.data?.data || [];
      const stock: StockInfo[] = inventoryData.map((inv: Record<string, unknown>) => ({
        warehouseId: inv.warehouseId || inv.warehouse_id,
        warehouseName: inv.warehouseName || inv.warehouse_name || 'Unknown',
        availableQuantity: parseInt(String(inv.availableQuantity ?? inv.available_quantity ?? 0)),
        reservedQuantity: parseInt(String(inv.reservedQuantity ?? inv.reserved_quantity ?? 0)),
        sku: (inv.sku || product.sku) as string,
      }));
      const totalAvailable = stock.reduce((s, w) => s + w.availableQuantity, 0);
      return { stock, totalAvailable };
    } catch {
      return { stock: [], totalAvailable: 0 };
    }
  }, []);

  // Add a product to the order
  const addProduct = useCallback(async (product: Product) => {
    // Don't add the same product twice
    if (items.some(i => i.product.id === product.id)) {
      error(`"${product.name}" is already in the order`);
      setSearchQuery('');
      setShowDropdown(false);
      return;
    }

    const { stock, totalAvailable } = await fetchStockForProduct(product);

    setItems(prev => [...prev, {
      product,
      quantity: 1,
      unitPrice: product.unitPrice ?? 0,
      stock,
      totalAvailable,
    }]);
    setSearchQuery('');
    setShowDropdown(false);
  }, [items, fetchStockForProduct, error]);

  // Remove item
  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Update item quantity
  const updateItemQuantity = (index: number, qty: number) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, quantity: Math.max(1, qty) } : item));
  };

  // Update item price
  const updateItemPrice = (index: number, price: number) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, unitPrice: Math.max(0, price) } : item));
  };

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

  const resetForm = () => {
    setFormData({
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      priority: 'standard',
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
    });
    setItems([]);
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      error('Add at least one product to the order');
      return;
    }

    // Validate stock
    const outOfStock = items.filter(i => i.quantity > i.totalAvailable);
    if (outOfStock.length > 0) {
      error(`Insufficient stock for: ${outOfStock.map(i => i.product.name).join(', ')}`);
      return;
    }

    setIsLoading(true);
    try {
      const orderData = {
        customer_name: formData.customerName,
        customer_email: formData.customerEmail,
        customer_phone: formData.customerPhone,
        priority: formData.priority,
        total_amount: subtotal,
        currency: 'INR',
        shipping_address: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          postal_code: formData.postalCode,
          country: formData.country,
        },
        items: items.map(item => ({
          product_id: item.product.id,
          sku: item.product.sku,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          weight: item.product.weight,
        })),
      };

      await api.post('/orders', orderData);
      success('Order created successfully!');
      resetForm();
      onClose();
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as Record<string, string>)?.message || 'Failed to create order';
      error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Order" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
        {/* Customer Section */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Customer Information</h4>
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Customer Name" 
              placeholder="Enter customer name" 
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              required
            />
            <Input 
              label="Email" 
              type="email" 
              placeholder="customer@example.com" 
              value={formData.customerEmail}
              onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
              required
            />
            <Input 
              label="Phone" 
              placeholder="+91 98765 43210" 
              value={formData.customerPhone}
              onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
              required
            />
            <Select
              label="Priority"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              options={[
                { value: 'standard', label: 'Standard' },
                { value: 'express', label: 'Express' },
                { value: 'bulk', label: 'Bulk' },
              ]}
            />
          </div>
        </div>

        {/* Shipping Address */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Shipping Address</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input 
                label="Street Address" 
                placeholder="123 MG Road" 
                value={formData.street}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                required
              />
            </div>
            <Input 
              label="City" 
              placeholder="Anand" 
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              required
            />
            <Input 
              label="State" 
              placeholder="Gujarat" 
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              required
            />
            <Input 
              label="Postal Code" 
              placeholder="400001" 
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              required
            />
            <Select
              label="Country"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              options={[
                { value: 'India', label: 'India' },
              ]}
            />
          </div>
        </div>

        {/* Product Items */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Order Items</h4>

          {/* Product Search */}
          <div className="relative mb-4" ref={dropdownRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Search products by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                </div>
              )}
            </div>

            {/* Search Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map(product => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white text-sm">{product.name}</span>
                        <span className="ml-2 text-xs text-gray-500 font-mono">{product.sku}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {product.unitPrice != null ? `₹${product.unitPrice.toLocaleString('en-IN')}` : '—'}
                      </span>
                    </div>
                    {product.category && (
                      <span className="text-xs text-gray-400 mt-0.5 block">{product.category}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {showDropdown && searchQuery && searchResults.length === 0 && !isSearching && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 text-center text-sm text-gray-500">
                No products found. Create products in the Products section first.
              </div>
            )}
          </div>

          {/* Selected Items List */}
          {items.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
              <Package className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Search and add products above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => {
                const exceedsStock = item.quantity > item.totalAvailable;
                return (
                  <div
                    key={item.product.id}
                    className={`border rounded-lg p-4 ${
                      exceedsStock
                        ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                          {item.product.name}
                        </h5>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{item.product.sku}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Stock indicator */}
                    <div className="mb-3">
                      {item.totalAvailable > 0 ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          <span className="text-green-700 dark:text-green-400">
                            {item.totalAvailable} available
                          </span>
                          {item.stock.length > 1 && (
                            <span className="text-gray-400">
                              ({item.stock.map(s => `${s.warehouseName}: ${s.availableQuantity}`).join(', ')})
                            </span>
                          )}
                          {item.stock.length === 1 && item.stock[0].warehouseName && (
                            <span className="text-gray-400">
                              at {item.stock[0].warehouseName}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                          <span className="text-red-600 dark:text-red-400">Out of stock</span>
                        </div>
                      )}
                      {exceedsStock && item.totalAvailable > 0 && (
                        <div className="flex items-center gap-1.5 text-xs mt-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                          <span className="text-red-600 dark:text-red-400">
                            Requested {item.quantity}, only {item.totalAvailable} available
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Quantity + Price */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Qty</label>
                        <input
                          type="number"
                          min="1"
                          max={item.totalAvailable || undefined}
                          value={item.quantity}
                          onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                          className={`w-full px-3 py-1.5 border rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 ${
                            exceedsStock ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Unit Price (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Line Total</label>
                        <div className="px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-white">
                          ₹{(item.unitPrice * item.quantity).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Order Summary */}
              <div className="flex justify-between items-center px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </span>
                <span className="text-base font-semibold text-gray-900 dark:text-white">
                  Total: ₹{subtotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="outline" className="flex-1" onClick={onClose} type="button" disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" type="submit" disabled={isLoading || items.length === 0}>
            {isLoading ? 'Creating...' : `Create Order (₹${subtotal.toLocaleString('en-IN')})`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
