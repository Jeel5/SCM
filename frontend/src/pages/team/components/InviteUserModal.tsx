import { useState } from 'react';
import { UserPlus, Mail, Phone } from 'lucide-react';
import { Button, Input, Modal, Select } from '@/components/ui';
import { post } from '@/api/client';
import { toast } from '@/stores/toastStore';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLE_OPTIONS = [
  { value: 'operations_manager', label: 'Operations Manager' },
  { value: 'warehouse_manager', label: 'Warehouse Manager' },
  { value: 'carrier_partner', label: 'Carrier Manager' },
  { value: 'finance', label: 'Finance' },
  { value: 'customer_support', label: 'Customer Support' },
];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  operations_manager: 'Manages orders, shipments, SLA and exceptions',
  warehouse_manager: 'Handles inventory, warehouses and returns',
  carrier_partner: 'Views and updates shipment/tracking status',
  finance: 'Access to financial reports and invoices',
  customer_support: 'Handles returns and exceptions',
};

export function InviteUserModal({ isOpen, onClose, onSuccess }: InviteUserModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'operations_manager',
  });

  const set = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleClose = () => {
    setForm({ name: '', email: '', phone: '', role: 'operations_manager' });
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email) {
      toast.error('Validation Error', 'Name and email are required');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error('Validation Error', 'Invalid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await post<{ success: boolean; data?: { temporary_password?: string } }>('/users', form);
      const tempPassword = response?.data?.temporary_password;

      if (tempPassword) {
        toast.success('User Added', `Temporary password: ${tempPassword}`);
      } else {
        toast.success('User Added', `${form.name} has been added to your team`);
      }

      onSuccess();
      handleClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error('Failed', msg || 'Could not create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Team Member" size="md">
      <div className="space-y-5">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Role & Access</p>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Role <span className="text-red-500">*</span>
          </label>
          <Select
            value={form.role}
            onChange={(e) => set('role', e.target.value)}
            options={ROLE_OPTIONS}
          />
          {form.role && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {ROLE_DESCRIPTIONS[form.role]}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Member Profile</p>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <Input
            placeholder="Jane Smith"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            leftIcon={<UserPlus className="h-4 w-4 text-gray-400" />}
            autoComplete="name"
          />

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <Input
            type="email"
            placeholder="jane@yourcompany.com"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            leftIcon={<Mail className="h-4 w-4 text-gray-400" />}
            autoComplete="off"
          />

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Phone Number
          </label>
          <Input
            type="tel"
            placeholder="+91 98765 43210"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            leftIcon={<Phone className="h-4 w-4 text-gray-400" />}
          />
        </div>

        <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            A strong temporary password will be auto-generated and shown once after user creation.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
        <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} isLoading={isSubmitting}>
          Add Member
        </Button>
      </div>
    </Modal>
  );
}
