import type { InventoryItem } from '@/types';

export type InventoryStockState = 'out_of_stock' | 'low_stock' | 'healthy' | 'overstocked';

export interface InventoryStockStatus {
  state: InventoryStockState;
  label: string;
  percentage: number;
}

const clampPercentage = (value: number) => Math.max(0, Math.min(value, 100));

export function getInventoryStockStatus(item: InventoryItem): InventoryStockStatus {
  const quantity = Math.max(item.quantity || 0, 0);
  const availableQuantity = Math.max(item.availableQuantity ?? quantity, 0);
  const reorderPoint = item.reorderPoint;
  const maxStockLevel = item.maxStockLevel;

  if (availableQuantity <= 0) {
    return { state: 'out_of_stock', label: 'Out of Stock', percentage: 0 };
  }

  if (maxStockLevel != null && maxStockLevel > 0 && quantity > maxStockLevel) {
    return {
      state: 'overstocked',
      label: 'Overstocked',
      percentage: clampPercentage((quantity / maxStockLevel) * 100),
    };
  }

  if (reorderPoint != null && reorderPoint >= 0 && availableQuantity <= reorderPoint) {
    const percentage = maxStockLevel != null && maxStockLevel > 0
      ? (quantity / maxStockLevel) * 100
      : reorderPoint > 0
        ? (availableQuantity / reorderPoint) * 100
        : 0;

    return {
      state: 'low_stock',
      label: 'Low Stock',
      percentage: clampPercentage(percentage),
    };
  }

  const percentage = maxStockLevel != null && maxStockLevel > 0
    ? (quantity / maxStockLevel) * 100
    : reorderPoint != null && reorderPoint > 0
      ? (availableQuantity / reorderPoint) * 100
      : availableQuantity > 0
        ? 100
        : 0;

  return {
    state: 'healthy',
    label: 'Healthy',
    percentage: clampPercentage(percentage),
  };
}