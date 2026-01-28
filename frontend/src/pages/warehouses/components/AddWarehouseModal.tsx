import { Modal, Button, Input, Select } from '@/components/ui';

export function AddWarehouseModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Warehouse" size="lg">
      <form className="space-y-4">
        <Input label="Warehouse Name" placeholder="Enter warehouse name" required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Address" placeholder="Street address" required />
          <Input label="City" placeholder="City" required />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input label="State" placeholder="State" required />
          <Input label="Zip Code" placeholder="Zip" required />
          <Select
            label="Country"
            options={[
              { value: 'US', label: 'United States' },
              { value: 'CA', label: 'Canada' },
              { value: 'UK', label: 'United Kingdom' },
              { value: 'DE', label: 'Germany' },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Capacity" type="number" placeholder="Total capacity" required />
          <Select
            label="Status"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Manager Name" placeholder="Warehouse manager" required />
          <Input label="Manager Email" type="email" placeholder="Email" required />
        </div>
        <div className="flex items-center gap-3 pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1">
            Add Warehouse
          </Button>
        </div>
      </form>
    </Modal>
  );
}
