import { useState, useEffect } from 'react';
import { Modal, Button, Input } from '@/components/ui';
import { inventoryApi } from '@/api/services';
import type { InventoryItem } from '@/types';

interface EditItemModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FormState {
  reorder_point: string;
  max_stock_level: string;
  unit_cost: string;
}

export function EditItemModal({ item, isOpen, onClose, onSuccess }: EditItemModalProps) {
  const [form, setForm] = useState<FormState>({
    reorder_point: '',
    max_stock_level: '',
    unit_cost: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when item changes
  useEffect(() => {
    if (item) {
      setForm({
        reorder_point: item.reorderPoint != null ? String(item.reorderPoint) : '',
        max_stock_level: item.maxStockLevel != null ? String(item.maxStockLevel) : '',
        unit_cost: item.unitCost != null ? String(item.unitCost) : '',
      });
    }
  }, [item]);

  if (!item) return null;

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!item) return;

    const payload: Record<string, unknown> = {};
    if (form.reorder_point !== '')
      payload.reorder_point = Number(form.reorder_point);
    else if (item.reorderPoint != null)
      payload.reorder_point = null;
    if (form.max_stock_level !== '')
      payload.max_stock_level = Number(form.max_stock_level);
    else if (item.maxStockLevel != null)
      payload.max_stock_level = null;
    if (form.unit_cost !== '')
      payload.unit_cost = Number(form.unit_cost);
    else if (item.unitCost != null)
      payload.unit_cost = null;

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    try {
      setIsSubmitting(true);
      await inventoryApi.updateInventoryItem(item.id, payload as Partial<InventoryItem>);
      onClose();
      onSuccess?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string });
      setError(msg?.response?.data?.message || msg?.message || 'Failed to update item.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit: ${item.productName || item.sku || 'Item'}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Update stock threshold settings.
          To change quantity, use <strong>Adjust Stock</strong>.
        </p>

        {/* Thresholds */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
            Stock Thresholds
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Reorder Point"
              type="number"
              min="0"
              placeholder="e.g. 20"
              value={form.reorder_point}
              onChange={set('reorder_point')}
            />
            <Input
              label="Max Stock Level"
              type="number"
              min="0"
              placeholder="e.g. 500"
              value={form.max_stock_level}
              onChange={set('max_stock_level')}
            />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Leave blank to clear the threshold.
          </p>
        </div>

        {/* Unit Cost */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
            Procurement Cost
          </p>
          <Input
            label="Unit Cost (₹)"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 250.00"
            value={form.unit_cost}
            onChange={set('unit_cost')}
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Cost per unit at time of procurement. Used for inventory valuation.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1" isLoading={isSubmitting}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
