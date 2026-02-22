import { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '@/components/ui';
import { productsApi } from '@/api/services';
import type { Product } from '@/types';

const CATEGORIES = [
  'Electronics',
  'Clothing',
  'Food & Beverage',
  'Furniture',
  'Health & Beauty',
  'Industrial',
  'Office Supplies',
  'Sports & Outdoors',
  'Toys & Games',
  'Automotive',
  'Books & Media',
  'Other',
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
}

interface FormState {
  name: string;
  description: string;
  category: string;
  unit_price: string;
  cost_price: string;
  currency: string;
  weight: string;
  dim_length: string;
  dim_width: string;
  dim_height: string;
  dim_unit: string;
  is_fragile: boolean;
  requires_cold_storage: boolean;
  is_hazmat: boolean;
  is_active: boolean;
}

const EMPTY: FormState = {
  name: '',
  description: '',
  category: '',
  unit_price: '',
  cost_price: '',
  currency: 'INR',
  weight: '',
  dim_length: '',
  dim_width: '',
  dim_height: '',
  dim_unit: 'cm',
  is_fragile: false,
  requires_cold_storage: false,
  is_hazmat: false,
  is_active: true,
};

export function AddEditProductModal({ isOpen, onClose, onSuccess, product }: Props) {
  const isEdit = Boolean(product);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when editing
  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '',
        description: product.description || '',
        category: product.category || '',
        unit_price: product.unitPrice != null ? String(product.unitPrice) : '',
        cost_price: product.costPrice != null ? String(product.costPrice) : '',
        currency: product.currency || 'INR',
        weight: product.weight != null ? String(product.weight) : '',
        dim_length: product.dimensions?.length != null ? String(product.dimensions.length) : '',
        dim_width: product.dimensions?.width != null ? String(product.dimensions.width) : '',
        dim_height: product.dimensions?.height != null ? String(product.dimensions.height) : '',
        dim_unit: product.dimensions?.unit || 'cm',
        is_fragile: Boolean(product.isFragile),
        requires_cold_storage: Boolean(product.requiresColdStorage),
        is_hazmat: Boolean(product.isHazmat),
        is_active: product.isActive !== false,
      });
    } else {
      setForm(EMPTY);
    }
    setError(null);
  }, [product, isOpen]);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const toggle = (field: keyof FormState) =>
    () => setForm(prev => ({ ...prev, [field]: !prev[field] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Product name is required'); return; }

    setIsSaving(true);
    setError(null);
    try {
      const hasDims = form.dim_length || form.dim_width || form.dim_height;
      const payload: Partial<Product> & { name: string } = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        category: form.category || undefined,
        unitPrice: form.unit_price ? parseFloat(form.unit_price) : undefined,
        costPrice: form.cost_price ? parseFloat(form.cost_price) : undefined,
        currency: form.currency,
        weight: form.weight ? parseFloat(form.weight) : undefined,
        dimensions: hasDims ? {
          length: form.dim_length ? parseFloat(form.dim_length) : undefined,
          width: form.dim_width ? parseFloat(form.dim_width) : undefined,
          height: form.dim_height ? parseFloat(form.dim_height) : undefined,
          unit: form.dim_unit,
        } : undefined,
        isFragile: form.is_fragile,
        requiresColdStorage: form.requires_cold_storage,
        isHazmat: form.is_hazmat,
        isActive: form.is_active,
      };

      if (isEdit && product) {
        await productsApi.updateProduct(product.id, payload);
      } else {
        await productsApi.createProduct(payload as any);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Product' : 'Add New Product'}
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Product Name <span className="text-red-500">*</span>
            </label>
            <Input value={form.name} onChange={set('name')} placeholder="e.g. Wireless Headset" required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select
              value={form.category}
              onChange={set('category')}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Select category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency</label>
            <select
              value={form.currency}
              onChange={set('currency')}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={set('description')}
            rows={2}
            placeholder="Optional product description"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit Price ({form.currency})</label>
            <Input type="number" min="0" step="0.01" value={form.unit_price} onChange={set('unit_price')} placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cost Price ({form.currency})</label>
            <Input type="number" min="0" step="0.01" value={form.cost_price} onChange={set('cost_price')} placeholder="0.00" />
          </div>
        </div>

        {/* Weight + Dimensions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Weight & Dimensions</label>
          <div className="grid grid-cols-5 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Weight (kg)</label>
              <Input type="number" min="0" step="0.001" value={form.weight} onChange={set('weight')} placeholder="0.000" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Length</label>
              <Input type="number" min="0" step="0.1" value={form.dim_length} onChange={set('dim_length')} placeholder="L" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Width</label>
              <Input type="number" min="0" step="0.1" value={form.dim_width} onChange={set('dim_width')} placeholder="W" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Height</label>
              <Input type="number" min="0" step="0.1" value={form.dim_height} onChange={set('dim_height')} placeholder="H" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Unit</label>
              <select
                value={form.dim_unit}
                onChange={set('dim_unit')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="cm">cm</option>
                <option value="mm">mm</option>
                <option value="in">in</option>
                <option value="ft">ft</option>
              </select>
            </div>
          </div>
        </div>

        {/* Flags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Product Flags</label>
          <div className="flex flex-wrap gap-4">
            {([
              { field: 'is_fragile' as const, label: 'Fragile', color: 'text-orange-600' },
              { field: 'requires_cold_storage' as const, label: 'Requires Cold Storage', color: 'text-blue-600' },
              { field: 'is_hazmat' as const, label: 'Hazardous (HAZMAT)', color: 'text-red-600' },
            ]).map(({ field, label, color }) => (
              <label key={field} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[field] as boolean}
                  onChange={toggle(field)}
                  className="w-4 h-4 rounded accent-indigo-600"
                />
                <span className={`text-sm font-medium ${color}`}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Active toggle (edit only) */}
        {isEdit && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={toggle('is_active')}
              className="w-4 h-4 rounded accent-indigo-600"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active Product</span>
          </label>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
