import { useState, useEffect } from 'react';
import { Modal, Button, Input } from '@/components/ui';
import { productsApi } from '@/api/services';
import type { Product } from '@/types';

const PACKAGE_TYPES = ['box', 'envelope', 'tube', 'pallet', 'crate', 'bag', 'custom'];

const CATEGORIES = [
  'Electronics', 'Clothing', 'Food & Beverage', 'Furniture', 'Health & Beauty',
  'Industrial', 'Office Supplies', 'Sports & Outdoors', 'Toys & Games',
  'Automotive', 'Books & Media', 'Other',
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
}

interface FormState {
  // Basic
  name: string; description: string; category: string; brand: string;
  // Pricing
  selling_price: string; cost_price: string; currency: string;
  // Physical
  weight: string; dim_length: string; dim_width: string; dim_height: string; dim_unit: string;
  // Identification
  country_of_origin: string;
  // Shipping
  package_type: string; handling_instructions: string;
  requires_insurance: boolean;
  // Flags
  is_fragile: boolean; requires_cold_storage: boolean; is_hazmat: boolean; is_perishable: boolean;
  // Order rules
  warranty_period_days: string;
  // Meta
  tags: string; is_active: boolean;
}

const EMPTY: FormState = {
  name: '', description: '', category: '', brand: '',
  selling_price: '', cost_price: '', currency: 'INR',
  weight: '', dim_length: '', dim_width: '', dim_height: '', dim_unit: 'cm',
  country_of_origin: 'India',
  package_type: 'box', handling_instructions: '', requires_insurance: false,
  is_fragile: false, requires_cold_storage: false, is_hazmat: false, is_perishable: false,
  warranty_period_days: '0',
  tags: '', is_active: true,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 p-4">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest border-b border-gray-200 dark:border-gray-700 pb-1">
        {title}
      </p>
      {children}
    </div>
  );
}

function CheckField({ field, label, color, checked, onToggle }: {
  field: string; label: string; color: string; checked: boolean; onToggle: () => void;
}) {
  return (
    <label key={field} className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={onToggle} className="w-4 h-4 rounded accent-indigo-600" />
      <span className={`text-sm font-medium ${color}`}>{label}</span>
    </label>
  );
}

export function AddEditProductModal({ isOpen, onClose, onSuccess, product }: Props) {
  const isEdit = Boolean(product);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '',
        description: product.description || '',
        category: product.category || '',
        brand: product.brand || '',
        selling_price: product.sellingPrice != null ? String(product.sellingPrice) : '',
        cost_price: product.costPrice != null ? String(product.costPrice) : '',
        currency: product.currency || 'INR',
        weight: product.weight != null ? String(product.weight) : '',
        dim_length: product.dimensions?.length != null ? String(product.dimensions.length) : '',
        dim_width: product.dimensions?.width != null ? String(product.dimensions.width) : '',
        dim_height: product.dimensions?.height != null ? String(product.dimensions.height) : '',
        dim_unit: product.dimensions?.unit || 'cm',
        country_of_origin: product.countryOfOrigin || 'India',
        package_type: product.packageType || 'box',
        handling_instructions: product.handlingInstructions || '',
        requires_insurance: Boolean(product.requiresInsurance),
        is_fragile: Boolean(product.isFragile),
        requires_cold_storage: Boolean(product.requiresColdStorage),
        is_hazmat: Boolean(product.isHazmat),
        is_perishable: Boolean(product.isPerishable),
        warranty_period_days: product.warrantyPeriodDays != null ? String(product.warrantyPeriodDays) : '0',
        tags: (product.tags || []).join(', '),
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

  const sels = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none';
  const lbl  = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Product name is required'); return; }
    setIsSaving(true);
    setError(null);
    try {
      const hasDims = form.dim_length || form.dim_width || form.dim_height;
      const tagsArr = form.tags.split(',').map(t => t.trim()).filter(Boolean);

      const payload: Partial<Product> & { name: string } = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        category: form.category || undefined,
        brand: form.brand.trim() || undefined,
        sellingPrice: form.selling_price ? parseFloat(form.selling_price) : undefined,
        costPrice: form.cost_price ? parseFloat(form.cost_price) : undefined,
        currency: form.currency,
        weight: form.weight ? parseFloat(form.weight) : undefined,
        dimensions: hasDims ? {
          length: form.dim_length ? parseFloat(form.dim_length) : undefined,
          width:  form.dim_width  ? parseFloat(form.dim_width)  : undefined,
          height: form.dim_height ? parseFloat(form.dim_height) : undefined,
          unit: form.dim_unit,
        } : undefined,
        countryOfOrigin: form.country_of_origin || undefined,
        packageType: form.package_type as Product['packageType'] || undefined,
        handlingInstructions: form.handling_instructions.trim() || undefined,
        requiresInsurance: form.requires_insurance,
        isFragile: form.is_fragile,
        requiresColdStorage: form.requires_cold_storage,
        isHazmat: form.is_hazmat,
        isPerishable: form.is_perishable,
        warrantyPeriodDays: form.warranty_period_days ? parseInt(form.warranty_period_days, 10) : 0,
        tags: tagsArr,
        isActive: form.is_active,
      };

      if (isEdit && product) {
        await productsApi.updateProduct(product.id, payload);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await productsApi.createProduct(payload as any);
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || 'Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Product' : 'Add New Product'} size="6xl">
      <form onSubmit={handleSubmit} className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">

        {/* BASIC */}
        <Section title="Basic Information">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={lbl}>Product Name <span className="text-red-500">*</span></label>
              <Input value={form.name} onChange={set('name')} placeholder="e.g. Wireless Headset" required />
            </div>
            <div>
              <label className={lbl}>Brand / Manufacturer</label>
              <Input value={form.brand} onChange={set('brand')} placeholder="e.g. Samsung, Dell" />
            </div>
            <div>
              <label className={lbl}>Category</label>
              <select value={form.category} onChange={set('category')} className={sels}>
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Description</label>
            <textarea value={form.description} onChange={set('description')} rows={2} placeholder="Optional product description"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
          <div>
            <label className={lbl}>Tags <span className="text-xs font-normal text-gray-400">(comma-separated)</span></label>
            <Input value={form.tags} onChange={set('tags')} placeholder="summer, new-arrival, featured" />
          </div>
        </Section>

        {/* PRICING */}
        <Section title="Pricing">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Selling Price</label>
              <Input type="number" min="0" step="0.01" value={form.selling_price} onChange={set('selling_price')} placeholder="0.00" />
            </div>
            <div>
              <label className={lbl}>Cost Price</label>
              <Input type="number" min="0" step="0.01" value={form.cost_price} onChange={set('cost_price')} placeholder="0.00" />
            </div>
            <div>
              <label className={lbl}>Currency</label>
              <select value={form.currency} onChange={set('currency')} className={sels}>
                <option value="INR">INR ₹</option>
                <option value="USD">USD $</option>
                <option value="EUR">EUR €</option>
                <option value="GBP">GBP £</option>
              </select>
            </div>
          </div>
        </Section>

        {/* IDENTIFICATION */}
        <Section title="Identification">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Country of Origin</label>
              <Input value={form.country_of_origin} onChange={set('country_of_origin')} placeholder="India" />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            <span className="font-medium">Note:</span> Internal warehouse barcode (IB-xxx) is auto-generated for scanning
          </p>
        </Section>

        {/* PHYSICAL */}
        <Section title="Physical Specifications">
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
              <select value={form.dim_unit} onChange={set('dim_unit')} className={sels}>
                {['cm','mm','in','ft'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
        </Section>

        {/* SHIPPING */}
        <Section title="Shipping & Packaging">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={lbl}>Package Type</label>
              <select value={form.package_type} onChange={set('package_type')} className={sels}>
                {PACKAGE_TYPES.map(pt => (
                  <option key={pt} value={pt}>{pt.charAt(0).toUpperCase() + pt.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Handling Instructions</label>
            <textarea value={form.handling_instructions} onChange={set('handling_instructions')} rows={2}
              placeholder="e.g. Keep upright. Do not stack more than 3 high."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
        </Section>

        {/* HANDLING FLAGS */}
        <Section title="Handling Flags">
          <div className="grid grid-cols-2 gap-3">
            <CheckField field="is_fragile"            label="Fragile"               color="text-orange-600" checked={form.is_fragile}            onToggle={toggle('is_fragile')} />
            <CheckField field="requires_cold_storage" label="Requires Cold Storage" color="text-blue-600"   checked={form.requires_cold_storage} onToggle={toggle('requires_cold_storage')} />
            <CheckField field="is_hazmat"             label="Hazardous (HAZMAT)"    color="text-red-600"    checked={form.is_hazmat}             onToggle={toggle('is_hazmat')} />
            <CheckField field="is_perishable"         label="Perishable"            color="text-yellow-600" checked={form.is_perishable}         onToggle={toggle('is_perishable')} />
            <CheckField field="requires_insurance"    label="Requires Insurance"    color="text-purple-600" checked={form.requires_insurance}    onToggle={toggle('requires_insurance')} />
          </div>
        </Section>

        {/* ORDER RULES */}
        <Section title="Warranty">
          <div>
            <label className={lbl}>Warranty (days) <span className="text-xs font-normal text-gray-400">0 = none</span></label>
            <Input type="number" min="0" step="1" value={form.warranty_period_days} onChange={set('warranty_period_days')} placeholder="365" />
          </div>
        </Section>

        {/* ACTIVE STATUS (edit only) */}
        {isEdit && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={toggle('is_active')} className="w-4 h-4 rounded accent-indigo-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active Product</span>
          </label>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
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
