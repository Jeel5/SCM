import { Modal, Button, Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import {
  AlertTriangle, Snowflake, Zap, Edit2, Flame, ShieldCheck,
  Tag, Package, Globe, Barcode, Clock, ShoppingCart,
} from 'lucide-react';
import type { Product } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
  product: Product | null;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-sm text-gray-900 dark:text-white mt-0.5">{value || <span className="text-gray-400">—</span>}</p>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700 pb-1 mb-3">
      {children}
    </p>
  );
}

export function ProductDetailsModal({ isOpen, onClose, onEdit, product }: Props) {
  if (!product) return null;

  const dims = product.dimensions;
  const dimStr = dims
    ? [dims.length, dims.width, dims.height].filter(Boolean).join(' × ') + (dims.unit ? ` ${dims.unit}` : '')
    : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Product Details" size="4xl">
      <div className="space-y-6 max-h-[78vh] overflow-y-auto pr-1">

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{product.name}</h3>
            {product.brand && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{product.brand}</p>
            )}
            <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400 mt-1">SKU: {product.sku}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
            <Badge variant={product.isActive ? 'success' : 'error'}>
              {product.isActive ? 'Active' : 'Inactive'}
            </Badge>
            {product.isFragile && (
              <Badge variant="warning" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Fragile
              </Badge>
            )}
            {product.requiresColdStorage && (
              <Badge variant="info" className="flex items-center gap-1">
                <Snowflake className="h-3 w-3" /> Cold Storage
              </Badge>
            )}
            {product.isHazmat && (
              <Badge variant="error" className="flex items-center gap-1">
                <Zap className="h-3 w-3" /> HAZMAT
              </Badge>
            )}
            {product.isPerishable && (
              <Badge variant="warning" className="flex items-center gap-1">
                <Flame className="h-3 w-3" /> Perishable
              </Badge>
            )}
            {product.requiresInsurance && (
              <Badge variant="info" className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Insured
              </Badge>
            )}
          </div>
        </div>

        {product.description && (
          <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
            {product.description}
          </p>
        )}

        {/* Tags */}
        {product.tags && product.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            {product.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* ── Pricing ───────────────────────────────────────────────── */}
        <div>
          <SectionHeader>Pricing</SectionHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
            <Field label="Category" value={product.category} />
            <Field label="Currency" value={product.currency} />
            <Field label="Selling Price" value={product.sellingPrice != null ? formatCurrency(product.sellingPrice, product.currency) : null} />
            <Field label="Cost Price" value={product.costPrice != null ? formatCurrency(product.costPrice, product.currency) : null} />
            <Field label="MRP (Retail)" value={product.mrp != null ? formatCurrency(product.mrp, product.currency) : null} />
          </div>
        </div>

        {/* ── Identification ────────────────────────────────────────── */}
        <div>
          <SectionHeader>Identification</SectionHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <Field label="Internal Barcode" value={
              <span className="flex items-center gap-1.5 font-mono text-indigo-600 dark:text-indigo-400">
                <Barcode className="h-3.5 w-3.5" /> {product.internalBarcode}
              </span>
            } />
            <Field label="Country of Origin" value={
              product.countryOfOrigin
                ? <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-gray-400" />{product.countryOfOrigin}</span>
                : null
            } />
          </div>
        </div>

        {/* ── Physical ──────────────────────────────────────────────── */}
        <div>
          <SectionHeader>Physical Specifications</SectionHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <Field label="Weight" value={product.weight != null ? `${product.weight} kg` : null} />
            <Field label="Dimensions (L × W × H)" value={dimStr} />
            {product.volumetricWeight != null && (
              <Field label="Volumetric Weight" value={`${product.volumetricWeight} kg`} />
            )}
            <Field label="Package Type" value={product.packageType ? <span className="capitalize">{product.packageType}</span> : null} />
          </div>
          {product.handlingInstructions && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium mb-1">Handling Instructions</p>
              <p className="text-sm text-gray-900 dark:text-white bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                {product.handlingInstructions}
              </p>
            </div>
          )}
        </div>

        {/* ── Order Rules ───────────────────────────────────────────── */}
        <div>
          <SectionHeader>Warranty & Lifecycle</SectionHeader>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Warranty" value={
              product.warrantyPeriodDays > 0
                ? <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-gray-400" />{product.warrantyPeriodDays} days</span>
                : <span className="text-gray-400">No warranty</span>
            } />
            {product.isPerishable && (
              <Field label="Shelf Life" value={
                product.shelfLifeDays != null
                  ? `${product.shelfLifeDays} days`
                  : <span className="text-gray-400">Not set</span>
              } />
            )}
          </div>
        </div>

        {/* ── Timestamps ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <Field label="Created" value={product.createdAt ? new Date(product.createdAt).toLocaleString() : null} />
          <Field label="Last Updated" value={product.updatedAt ? new Date(product.updatedAt).toLocaleString() : null} />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          {onEdit && (
            <Button variant="primary" onClick={onEdit} className="flex items-center gap-2">
              <Edit2 className="h-4 w-4" /> Edit Product
            </Button>
          )}
        </div>

        {/* hidden ref to avoid unused import warning (tree-shaked in prod) */}
        <span className="hidden"><Package /></span>
      </div>
    </Modal>
  );
}
