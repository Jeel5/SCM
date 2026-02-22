import { useState } from 'react';
import { Building2, User, Lock } from 'lucide-react';
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

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'IST (Asia/Kolkata)' },
  { value: 'Asia/Dubai', label: 'GST (Asia/Dubai)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'EST (America/New_York)' },
  { value: 'Europe/London', label: 'GMT (Europe/London)' },
];

export function CreateOrgModal({ isOpen, onClose, onSuccess }: CreateOrgModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    // Organization
    name: '',
    code: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    postal_code: '',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    subscription_tier: 'standard',
    // Admin user
    admin_name: '',
    admin_email: '',
    admin_password: '',
    admin_phone: '',
  });

  const set = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.admin_name || !formData.admin_email || !formData.admin_password) {
      toast.error('Validation Error', 'Please fill all required fields');
      return;
    }
    if (formData.admin_password.length < 8) {
      toast.error('Validation Error', 'Admin password must be at least 8 characters');
      return;
    }

    try {
      setIsSubmitting(true);
      await post('/organizations', {
        name: formData.name,
        code: formData.code || undefined,
        email: formData.email,
        phone: formData.phone || undefined,
        website: formData.website || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        country: formData.country,
        postal_code: formData.postal_code || undefined,
        timezone: formData.timezone,
        currency: formData.currency,
        subscription_tier: formData.subscription_tier,
        admin_user: {
          name: formData.admin_name,
          email: formData.admin_email,
          password: formData.admin_password,
          phone: formData.admin_phone || undefined,
        },
      });
      toast.success('Organization Created', `${formData.name} has been created successfully`);
      onSuccess();
      onClose();
      setFormData({
        name: '', code: '', email: '', phone: '', website: '',
        address: '', city: '', state: '', country: 'India', postal_code: '',
        timezone: 'Asia/Kolkata', currency: 'INR', subscription_tier: 'standard',
        admin_name: '', admin_email: '', admin_password: '', admin_phone: '',
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
        <div>
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
              label="Code (auto-generated if empty)"
              value={formData.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              placeholder="e.g., ORG-26-001"
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input
              label="Email *"
              type="email"
              value={formData.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="contact@company.in"
            />
            <Input
              label="Phone"
              value={formData.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+91-XX-XXXX-XXXX"
            />
          </div>
          <div className="mt-4">
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
              label="Timezone"
              value={formData.timezone}
              onChange={(e) => set('timezone', e.target.value)}
              options={TIMEZONES}
            />
            <Select
              label="Subscription Tier"
              value={formData.subscription_tier}
              onChange={(e) => set('subscription_tier', e.target.value)}
              options={SUBSCRIPTION_TIERS}
            />
          </div>
        </div>

        {/* Admin User */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
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
            <Input
              label="Admin Password *"
              type="password"
              value={formData.admin_password}
              onChange={(e) => set('admin_password', e.target.value)}
              placeholder="Min 8 characters"
              leftIcon={<Lock className="h-4 w-4" />}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
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
