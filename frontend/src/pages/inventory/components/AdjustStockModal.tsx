import { useState } from 'react';
import { ArrowUpDown, AlertCircle } from 'lucide-react';
import { Modal, Button, Select, useToast } from '@/components/ui';
import { inventoryApi } from '@/api/services';
import type { InventoryItem } from '@/types';

interface AdjustStockModalProps {
    item: InventoryItem | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function AdjustStockModal({ item, isOpen, onClose, onSuccess }: AdjustStockModalProps) {
    const [type, setType] = useState('add');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { success, error } = useToast();

    if (!item) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
            error('Please enter a valid quantity');
            return;
        }

        setIsSubmitting(true);
        try {
            await inventoryApi.adjustStock(item.id, type, Number(quantity), reason || 'Manual adjustment');
            success('Stock adjusted successfully');
            onSuccess();
            onClose();
            // Reset form
            setType('add');
            setQuantity('');
            setReason('');
        } catch (err: any) {
            error(err.message || 'Failed to adjust stock');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Adjust Stock: ${item.productName || item.sku || 'Item'}`} size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-sm flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>
                        Current available stock is <strong>{item.quantity}</strong>. Adjusting stock will create an inventory movement record.
                    </p>
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Adjustment Type</label>
                    <Select
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        options={[
                            { value: 'add', label: 'Add Stock (+)' },
                            { value: 'remove', label: 'Remove Stock (-)' },
                            { value: 'set', label: 'Set Exact Amount (=)' },
                            { value: 'damaged', label: 'Mark as Damaged' },
                        ]}
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Quantity</label>
                    <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter quantity"
                        required
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Reason</label>
                    <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Stock count correction, Damaged goods"
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" isLoading={isSubmitting} leftIcon={<ArrowUpDown className="h-4 w-4" />}>
                        Adjust Stock
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
