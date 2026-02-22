import { Modal, Button, Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { AlertTriangle, Snowflake, Zap, Edit2, Flame, ShieldCheck } from 'lucide-react';
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

export function ProductDetailsModal({ isOpen, onClose, onEdit, product }: Props) {
  if (!product) return null;

  const dims = product.dimensions;
  const dimStr = dims
    ? [dims.length, dims.width, dims.height].filter(Boolean).join(' × ') + (dims.unit ? ` ${dims.unit}` : '')
    : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Product Details" size="2xl">
      <div className="space-y-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{product.name}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0 justify-end">
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

        {/* Pricing & Physical */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Pricing & Physical</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <Field label="Category" value={product.category} />
            <Field label="Currency" value={product.currency} />
            <Field
              label="Unit Price"
              value={product.unitPrice != null ? formatCurrency(product.unitPrice, product.currency) : null}
            />
            <Field
              label="Cost Price"
              value={product.costPrice != null ? formatCurrency(product.costPrice, product.currency) : null}
            />
            <Field
              label="Weight"
              value={product.weight != null ? `${product.weight} kg` : null}
            />
            <Field label="Dimensions (L × W × H)" value={dimStr} />
            {product.volumetricWeight != null && (
              <Field label="Volumetric Weight" value={`${product.volumetricWeight} kg`} />
            )}
          </div>
        </div>

        {/* Shipping Classification */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Shipping Classification</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <Field label="Item Type" value={product.itemType ? <span className="capitalize">{product.itemType}</span> : null} />
            <Field label="Package Type" value={product.packageType ? <span className="capitalize">{product.packageType}</span> : null} />
            {product.declaredValue != null && (
              <Field label="Declared Value" value={formatCurrency(product.declaredValue, product.currency)} />
            )}
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

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <Field
            label="Created"
            value={product.createdAt ? new Date(product.createdAt).toLocaleString() : null}
          />
          <Field
            label="Last Updated"
            value={product.updatedAt ? new Date(product.updatedAt).toLocaleString() : null}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          {onEdit && (
            <Button variant="primary" onClick={onEdit} className="flex items-center gap-2">
              <Edit2 className="h-4 w-4" /> Edit Product
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
