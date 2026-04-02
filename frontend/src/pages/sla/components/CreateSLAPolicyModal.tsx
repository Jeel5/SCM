import { useState } from 'react';
import { Modal, Button, Input } from '@/components/ui';
import { slaApi } from '@/api/services';
import { useToast } from '@/components/ui/Toast';
import type { SLAPolicy } from '@/types';

const SERVICE_TYPE_OPTIONS = [
  { value: 'same_day',  label: 'Same Day' },
  { value: 'express',   label: 'Express' },
  { value: 'standard',  label: 'Standard' },
  { value: 'economy',   label: 'Economy' },
  { value: 'bulk',      label: 'Bulk' },
];

const PENALTY_TYPE_OPTIONS = [
  { value: 'fixed',      label: 'Fixed ₹/hr' },
  { value: 'percentage', label: 'Percentage of order value' },
];

interface FormState {
  name: string;
  serviceType: string;
  deliveryHours: string;
  pickupHours: string;
  penaltyPerHour: string;
  maxPenaltyAmount: string;
  penaltyType: string;
  warningThresholdPercent: string;
  priority: string;
}

const INITIAL_FORM: FormState = {
  name: '',
  serviceType: 'standard',
  deliveryHours: '72',
  pickupHours: '4',
  penaltyPerHour: '0',
  maxPenaltyAmount: '',
  penaltyType: 'fixed',
  warningThresholdPercent: '80',
  priority: '5',
};

export function CreateSLAPolicyModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (policy: SLAPolicy) => void;
}) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      addToast({ type: 'error', title: 'Policy name is required' });
      return;
    }
    if (!form.deliveryHours || parseInt(form.deliveryHours, 10) < 1) {
      addToast({ type: 'error', title: 'Delivery hours must be at least 1' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await slaApi.createSLAPolicy({
        name:                    form.name.trim(),
        serviceType:             form.serviceType,
        targetDeliveryHours:     parseInt(form.deliveryHours, 10),
        penaltyAmount:           parseFloat(form.penaltyPerHour) || 0,
        maxPenaltyAmount:        form.maxPenaltyAmount ? parseFloat(form.maxPenaltyAmount) : null,
        penaltyType:             form.penaltyType as 'fixed' | 'percentage',
        warningThresholdPercent: parseInt(form.warningThresholdPercent, 10) || 80,
        isActive:                true,
        priority:                parseInt(form.priority, 10) || 5,
      });
      addToast({ type: 'success', title: `Policy "${form.name}" created successfully` });
      onCreated(response.data);
      setForm(INITIAL_FORM);
      onClose();
    } catch (err: any) {
      addToast({ type: 'error', title: err?.message || 'Failed to create SLA policy' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create SLA Policy" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Policy Name */}
        <Input
          label="Policy Name"
          placeholder='e.g. "Delhivery Express Metro"'
          value={form.name}
          onChange={set('name')}
          required
        />

        {/* Service Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Service Type <span className="text-red-500">*</span>
          </label>
          <select
            value={form.serviceType}
            onChange={set('serviceType')}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SERVICE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Matches orders with this priority/service type.
          </p>
        </div>

        {/* Transit times */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Max Transit Time (hours) *"
            type="number"
            min="1"
            max="720"
            placeholder="72"
            value={form.deliveryHours}
            onChange={set('deliveryHours')}
            required
          />
          <Input
            label="Pickup Window (hours)"
            type="number"
            min="1"
            max="72"
            placeholder="4"
            value={form.pickupHours}
            onChange={set('pickupHours')}
          />
        </div>

        {/* Warning threshold */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Warning Threshold — {form.warningThresholdPercent}% of transit time
            <span className="text-gray-400 ml-1 font-normal">
              (= {Math.floor((parseInt(form.deliveryHours, 10) || 0) * (parseInt(form.warningThresholdPercent, 10) || 80) / 100)} hrs)
            </span>
          </label>
          <input
            type="range"
            min="50"
            max="95"
            step="5"
            value={form.warningThresholdPercent}
            onChange={set('warningThresholdPercent')}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>50% (early warning)</span>
            <span>95% (late warning)</span>
          </div>
        </div>

        {/* Penalty */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Penalty Configuration</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Penalty Type</label>
              <select
                value={form.penaltyType}
                onChange={set('penaltyType')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PENALTY_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <Input
              label={form.penaltyType === 'fixed' ? 'Penalty ₹/hr' : 'Penalty % per hour'}
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={form.penaltyPerHour}
              onChange={set('penaltyPerHour')}
            />
          </div>
          <Input
            label="Max Penalty Cap (₹) — leave blank for no cap"
            type="number"
            min="0"
            placeholder="No cap"
            value={form.maxPenaltyAmount}
            onChange={set('maxPenaltyAmount')}
          />
        </div>

        {/* Priority */}
        <Input
          label="Priority (1 = highest, matched first when multiple policies apply)"
          type="number"
          min="1"
          max="100"
          value={form.priority}
          onChange={set('priority')}
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting}>
            Create Policy
          </Button>
        </div>
      </form>
    </Modal>
  );
}
