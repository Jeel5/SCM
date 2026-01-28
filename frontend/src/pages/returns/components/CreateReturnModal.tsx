import { Modal, Button, Input, Select } from '@/components/ui';

export function CreateReturnModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Return Request" size="lg">
      <form className="space-y-4">
        <Input label="Order ID" placeholder="Enter order ID" required />
        <Select
          label="Return Type"
          options={[
            { value: 'refund', label: 'Refund' },
            { value: 'exchange', label: 'Exchange' },
            { value: 'store_credit', label: 'Store Credit' },
          ]}
          required
        />
        <Select
          label="Return Reason"
          options={[
            { value: 'damaged', label: 'Item Damaged' },
            { value: 'wrong_item', label: 'Wrong Item Received' },
            { value: 'not_as_described', label: 'Not as Described' },
            { value: 'changed_mind', label: 'Changed Mind' },
            { value: 'defective', label: 'Defective Product' },
            { value: 'other', label: 'Other' },
          ]}
          required
        />
        <Input label="Refund Amount" type="number" placeholder="0.00" required />
        <Input label="Notes" placeholder="Additional information about the return" />
        <div className="flex items-center gap-3 pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1">
            Create Return
          </Button>
        </div>
      </form>
    </Modal>
  );
}
