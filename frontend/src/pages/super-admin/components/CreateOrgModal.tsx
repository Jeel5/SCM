import { useState } from 'react';
import { Building2, User } from 'lucide-react';
import { Button, Input, Modal, Select } from '@/components/ui';
import { toast } from '@/stores/toastStore';
import { post } from '@/api/client';

interface CreateOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SUBSCRIPTION_TIERS = [
  { value: 'starter', label: 'Starter' },
  { value: 'standard', label: 'Standard' },
  { value: 'enterprise', label: 'Enterprise' },
];

export function CreateOrgModal({ isOpen, onClose, onSuccess }: CreateOrgModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    // Organization
    name: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    postal_code: '',
    currency: 'INR',
    subscription_tier: 'standard',
    // Admin user
    admin_name: '',
    admin_email: '',
    admin_phone: '',
  });

  const set = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.admin_name || !formData.admin_email) {
      toast.error('Validation Error', 'Please fill all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await post<{ success: boolean; data?: { adminUser?: { temporaryPassword?: string } } }>('/organizations', {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        website: formData.website || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        country: formData.country,
        postal_code: formData.postal_code || undefined,
        currency: formData.currency,
        subscription_tier: formData.subscription_tier,
        admin_user: {
          name: formData.admin_name,
          email: formData.admin_email,
          phone: formData.admin_phone || undefined,
        },
      });

      const temporaryPassword = response?.data?.adminUser?.temporaryPassword;
      if (temporaryPassword) {
        toast.success('Organization Created', `Admin temporary password: ${temporaryPassword}`);
      } else {
        toast.success('Organization Created', `${formData.name} has been created successfully`);
      }

      onSuccess();
      onClose();
      setFormData({
        name: '', email: '', phone: '', website: '',
        address: '', city: '', state: '', country: 'India', postal_code: '',
        currency: 'INR', subscription_tier: 'standard',
        admin_name: '', admin_email: '', admin_phone: '',
      });
    } catch {
      // Error handled by axios interceptor
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Organization" size="lg">
      <div className="space-y-6">
        {/* Organization Details */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Organization Details</h3>
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
          <div className="grid grid-cols-2 gap-4 mt-4">
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
          <div className="mt-4">
            <Input
              label="Address"
              value={formData.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="Street address"
            />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
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
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Select
              label="Subscription Tier"
              value={formData.subscription_tier}
              onChange={(e) => set('subscription_tier', e.target.value)}
              options={SUBSCRIPTION_TIERS}
            />
            <div />
          </div>
        </div>

        {/* Admin User */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-green-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Admin User (auto-created)</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Admin Name *"
              value={formData.admin_name}
              onChange={(e) => set('admin_name', e.target.value)}
              placeholder="John Doe"
            />
            <Input
              label="Admin Phone"
              value={formData.admin_phone}
              onChange={(e) => set('admin_phone', e.target.value)}
              placeholder="+91-XXXXX-XXXXX"
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input
              label="Admin Email *"
              type="email"
              value={formData.admin_email}
              onChange={(e) => set('admin_email', e.target.value)}
              placeholder="admin@company.in"
            />
            <div />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            Create Organization
          </Button>
        </div>
      </div>
    </Modal>
  );
}
