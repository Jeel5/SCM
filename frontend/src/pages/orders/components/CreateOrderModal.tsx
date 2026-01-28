import { Modal, Button, Input, Select } from '@/components/ui';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateOrderModal({ isOpen, onClose }: CreateOrderModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Order" size="lg">
      <form className="space-y-6">
        {/* Customer Section */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Customer Information</h4>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Customer Name" placeholder="Enter customer name" />
            <Input label="Email" type="email" placeholder="customer@example.com" />
            <Input label="Phone" placeholder="+1 (555) 000-0000" />
            <Select
              label="Priority"
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
              <Input label="Street Address" placeholder="123 Main St" />
            </div>
            <Input label="City" placeholder="New York" />
            <Input label="State" placeholder="NY" />
            <Input label="Postal Code" placeholder="10001" />
            <Select
              label="Country"
              options={[
                { value: 'USA', label: 'United States' },
                { value: 'CAN', label: 'Canada' },
                { value: 'UK', label: 'United Kingdom' },
              ]}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1">
            Create Order
          </Button>
        </div>
      </form>
    </Modal>
  );
}
