import { useState, useEffect } from 'react';
import { Package, Plus, Trash2, AlertCircle } from 'lucide-react';
import { Modal, Button, Input } from '@/components/ui';
import { ordersApi, warehousesApi, inventoryApi } from '@/api/services';
import type { Warehouse } from '@/types';

interface TransferOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  sourceWarehouseId?: string;
}

interface TransferItem {
  product_id: string;
  sku: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  available: number;
}

export function TransferOrderModal({ isOpen, onClose, onSuccess, sourceWarehouseId }: TransferOrderModalProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [availableProducts, setAvailableProducts] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    from_warehouse_id: sourceWarehouseId || '',
    to_warehouse_id: '',
    priority: 'standard',
    reason: '',
    requested_by: '',
    notes: '',
    expected_delivery_date: '',
  });

  const [items, setItems] = useState<TransferItem[]>([]);

  // Fetch warehouses on mount
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await warehousesApi.getWarehouses();
        setWarehouses(response.data);
      } catch (err) {
        console.error('Failed to fetch warehouses:', err);
      }
    };
    fetchWarehouses();
  }, []);

  // Fetch available products when source warehouse changes
  useEffect(() => {
    const fetchInventory = async () => {
      if (!formData.from_warehouse_id) return;
      
      try {
        const response = await inventoryApi.getInventory(1, 100, {
          warehouse_id: formData.from_warehouse_id,
        });
        setAvailableProducts(response.data as unknown[]);
      } catch (err) {
        console.error('Failed to fetch inventory:', err);
      }
    };
    fetchInventory();
  }, [formData.from_warehouse_id]);

  const handleAddItem = () => {
    setItems([...items, {
      product_id: '',
      sku: '',
      product_name: '',
      quantity: 1,
      unit_cost: 0,
      available: 0,
    }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof TransferItem, value: string | number) => {
    const newItems = [...items];
    
    // If changing product, update all fields
    if (field === 'sku') {
      const product = (availableProducts as Array<Record<string, unknown>>).find((p) => (p.sku as string) === value);
      if (product) {
        newItems[index] = {
          ...newItems[index],
          product_id: product.id as string,
          sku: product.sku as string,
          product_name: (product.productName) as string,
          unit_cost: Number(product.unitPrice) || 0,
          available: Number(product.availableQuantity || product.quantity) || 0,
        };
      }
    } else {
      newItems[index][field] = value as never;
    }
    
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (!formData.from_warehouse_id) {
      setError('Please select a source warehouse');
      return;
    }
    if (!formData.to_warehouse_id) {
      setError('Please select a destination warehouse');
      return;
    }
    if (formData.from_warehouse_id === formData.to_warehouse_id) {
      setError('Source and destination warehouses must be different');
      return;
    }
    if (items.length === 0) {
      setError('Please add at least one item');
      return;
    }
    if (!formData.reason || formData.reason.length < 5) {
      setError('Please provide a reason (minimum 5 characters)');
      return;
    }

    // Check stock availability
    for (const item of items) {
      if (item.quantity > item.available) {
        setError(`Insufficient stock for ${item.product_name}. Available: ${item.available}, Requested: ${item.quantity}`);
        return;
      }
    }

    setLoading(true);
    try {
      await ordersApi.createTransferOrder({
        ...formData,
        items: items.map(item => ({
          product_id: item.product_id,
          sku: item.sku,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
        })),
      });

      onSuccess?.();
      onClose();
      
      // Reset form
      setFormData({
        from_warehouse_id: sourceWarehouseId || '',
        to_warehouse_id: '',
        priority: 'standard',
        reason: '',
        requested_by: '',
        notes: '',
        expected_delivery_date: '',
      });
      setItems([]);
    } catch (err) {
      setError((err as {message: string}).message || 'Failed to create transfer order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Transfer Order" size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Warehouse Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              From Warehouse *
            </label>
            <select
              value={formData.from_warehouse_id}
              onChange={(e) => setFormData({ ...formData, from_warehouse_id: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            >
              <option value="">Select source warehouse</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              To Warehouse *
            </label>
            <select
              value={formData.to_warehouse_id}
              onChange={(e) => setFormData({ ...formData, to_warehouse_id: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            >
              <option value="">Select destination warehouse</option>
              {warehouses
                .filter((wh) => wh.id !== formData.from_warehouse_id)
                .map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name} ({wh.code})
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Priority and Expected Delivery */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            >
              <option value="standard">Standard (3 days)</option>
              <option value="express">Express (1 day)</option>
              <option value="bulk">Bulk (5 days)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Expected Delivery Date
            </label>
            <Input
              type="date"
              value={formData.expected_delivery_date}
              onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>

        {/* Items Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Items to Transfer *
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddItem}
              disabled={!formData.from_warehouse_id}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
              <Package className="h-12 w-12 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No items added. Click "Add Item" to start.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {items.map((item, index) => (
                <div key={index} className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                    <select
                      value={item.sku}
                      onChange={(e) => handleItemChange(index, 'sku', e.target.value)}
                      required
                      className="md:col-span-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    >
                      <option value="">Select product</option>
                      {(availableProducts as Array<Record<string, unknown>>).map((p) => (
                        <option key={p.id as string} value={p.sku as string}>
                          {(p.productName || p.name) as string} ({p.sku as string})
                        </option>
                      ))}
                    </select>

                    <Input
                      type="number"
                      min="1"
                      max={item.available}
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                      placeholder="Qty"
                      required
                    />

                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      Avail: {item.available}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reason and Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Reason for Transfer *
          </label>
          <textarea
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            rows={2}
            placeholder="e.g., Restocking high-demand warehouse, balancing inventory..."
            required
            minLength={5}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Minimum 5 characters. Explain why this transfer is needed.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Additional Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            rows={2}
            placeholder="Any special handling instructions..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Requested By
          </label>
          <Input
            value={formData.requested_by}
            onChange={(e) => setFormData({ ...formData, requested_by: e.target.value })}
            placeholder="Your name or employee ID"
          />
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || items.length === 0}
          >
            {loading ? 'Creating...' : 'Create Transfer Order'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
