import { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { Button, Input, Modal, Select } from '@/components/ui';
import { toast } from '@/stores/toastStore';
import { put } from '@/api/client';
import type { Organization } from '../types';

interface EditOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organization: Organization | null;
}

const SUBSCRIPTION_TIERS = [
  { value: 'starter', label: 'Starter' },
  { value: 'standard', label: 'Standard' },
  { value: 'enterprise', label: 'Enterprise' },
];

export function EditOrgModal({ isOpen, onClose, onSuccess, organization }: EditOrgModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    postal_code: '',
    subscription_tier: 'standard',
  });

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        email: organization.email || '',
        phone: organization.phone || '',
        website: organization.website || '',
        address: organization.address || '',
        city: organization.city || '',
        state: organization.state || '',
        country: organization.country || 'India',
        postal_code: organization.postalCode || '',
        subscription_tier: organization.subscriptionTier || 'standard',
      });
    }
  }, [organization]);

  const set = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!formData.name || !formData.email) {
      toast.error('Validation Error', 'Name and email are required');
      return;
    }
    if (!organization) return;

    try {
      setIsSubmitting(true);
      await put(`/organizations/${organization.id}`, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        website: formData.website || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        country: formData.country,
        postal_code: formData.postal_code || undefined,
        subscription_tier: formData.subscription_tier,
      });
      toast.success('Organization Updated', `${formData.name} has been updated`);
      onSuccess();
      onClose();
    } catch {
      // Error handled by axios interceptor
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Organization" size="lg">
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-4 w-4 text-blue-600" />
          <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{organization?.code}</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Organization Name *"
            value={formData.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g., Acme Logistics"
          />
          <Input
            label="Email *"
            type="email"
            value={formData.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="contact@company.in"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+91-XX-XXXX-XXXX"
          />
          <Input
            label="Website"
            value={formData.website}
            onChange={(e) => set('website', e.target.value)}
            placeholder="https://company.in"
          />
        </div>

        <Input
          label="Address"
          value={formData.address}
          onChange={(e) => set('address', e.target.value)}
          placeholder="Street address"
        />

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="City"
            value={formData.city}
            onChange={(e) => set('city', e.target.value)}
            placeholder="Mumbai"
          />
          <Input
            label="State"
            value={formData.state}
            onChange={(e) => set('state', e.target.value)}
            placeholder="Maharashtra"
          />
          <Input
            label="PIN Code"
            value={formData.postal_code}
            onChange={(e) => set('postal_code', e.target.value)}
            placeholder="400001"
          />
        </div>

        <Select
          label="Subscription Tier"
          value={formData.subscription_tier}
          onChange={(e) => set('subscription_tier', e.target.value)}
          options={SUBSCRIPTION_TIERS}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
