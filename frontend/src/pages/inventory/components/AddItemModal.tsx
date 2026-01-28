import { Modal, Button, Input, Select } from '@/components/ui';
import type { Warehouse } from '@/types';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
}

export function AddItemModal({ isOpen, onClose, warehouses }: AddItemModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Inventory Item" size="lg">
      <form className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Product Name" placeholder="Enter product name" required />
          <Input label="SKU" placeholder="Enter SKU" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Category"
            options={[
              { value: 'electronics', label: 'Electronics' },
              { value: 'clothing', label: 'Clothing' },
              { value: 'food', label: 'Food & Beverages' },
              { value: 'furniture', label: 'Furniture' },
              { value: 'other', label: 'Other' },
            ]}
          />
          <Select
            label="Warehouse"
            options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input label="Quantity" type="number" placeholder="0" required />
          <Input label="Unit Cost" type="number" placeholder="0.00" required />
          <Select
            label="Unit"
            options={[
              { value: 'pieces', label: 'Pieces' },
              { value: 'boxes', label: 'Boxes' },
              { value: 'pallets', label: 'Pallets' },
              { value: 'kg', label: 'Kilograms' },
            ]}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input label="Min Qty" type="number" placeholder="0" />
          <Input label="Reorder Point" type="number" placeholder="0" />
          <Input label="Max Qty" type="number" placeholder="0" />
        </div>
        <Input label="Storage Location" placeholder="e.g., Aisle A, Rack 3, Shelf 2" />
        <div className="flex items-center gap-3 pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1">
            Add Item
          </Button>
        </div>
      </form>
    </Modal>
  );
}
