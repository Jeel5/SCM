import { useState } from 'react';
import { Modal, Button, Input, Select } from '@/components/ui';
import { returnsApi } from '@/api/services';
import { useToast } from '@/components/ui/Toast';

export function CreateReturnModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [orderId, setOrderId] = useState('');
  const [returnType, setReturnType] = useState('refund');
  const [reason, setReason] = useState('damaged');
  const [refundAmount, setRefundAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim()) {
      error('Order ID is required');
      return;
    }
    setIsSubmitting(true);
    try {
      await returnsApi.createReturn({
        order_id: orderId.trim(),
        reason,
        reason_details: notes || undefined,
        refund_amount: refundAmount ? parseFloat(refundAmount) : undefined,
        items: [{ product_name: 'Return item', quantity: 1 }],
      } as any);
      success('Return request created successfully');
      setOrderId('');
      setReturnType('refund');
      setReason('damaged');
      setRefundAmount('');
      setNotes('');
      onSuccess?.();
    } catch (err: any) {
      if (!err?.response) {
        error('Failed to create return', err?.message || 'Unexpected error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Return Request" size="lg">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Return Details</p>
          <Input
            label="Order ID"
            placeholder="Enter order ID or order number"
            required
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Return Type"
              value={returnType}
              onChange={(e) => setReturnType(e.target.value)}
              options={[
                { value: 'refund', label: 'Refund' },
                { value: 'exchange', label: 'Exchange' },
                { value: 'store_credit', label: 'Store Credit' },
              ]}
              required
            />
            <Select
              label="Return Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              options={[
                { value: 'damaged', label: 'Item Damaged' },
                { value: 'wrong_item', label: 'Wrong Item Received' },
                { value: 'not_as_described', label: 'Not as Described' },
                { value: 'changed_mind', label: 'Changed Mind' },
                { value: 'quality_issue', label: 'Quality Issue' },
                { value: 'other', label: 'Other' },
              ]}
              required
            />
          </div>
          <Input
            label="Refund Amount"
            type="number"
            placeholder="0.00"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
          />
          <Input
            label="Notes"
            placeholder="Additional information about the return"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1" isLoading={isSubmitting}>
            Create Return
          </Button>
        </div>
      </form>
    </Modal>
  );
}
