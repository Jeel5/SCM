import { Modal, Button, Input, Select } from '@/components/ui';

export function AddCarrierModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Carrier" size="lg">
      <form className="space-y-4">
        <Input label="Carrier Name" placeholder="Enter carrier name" required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Contact Phone" placeholder="+1 (555) 000-0000" required />
          <Input label="Contact Email" type="email" placeholder="contact@carrier.com" required />
        </div>
        <Input label="Website" placeholder="https://www.carrier.com" />
        <Select
          label="Status"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'pending', label: 'Pending' },
            { value: 'suspended', label: 'Suspended' },
          ]}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Services Offered</label>
          <div className="grid grid-cols-3 gap-2">
            {['express', 'standard', 'economy', 'freight', 'cold_chain', 'hazmat'].map((service) => (
              <label
                key={service}
                className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50"
              >
                <input type="checkbox" className="rounded text-blue-600" />
                <span className="text-sm capitalize">{service.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1">
            Add Carrier
          </Button>
        </div>
      </form>
    </Modal>
  );
}
