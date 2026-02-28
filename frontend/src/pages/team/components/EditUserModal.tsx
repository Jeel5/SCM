import { useState, useEffect } from 'react';
import { Button, Input, Modal, Select } from '@/components/ui';
import { put } from '@/api/client';
import { toast } from '@/stores/toastStore';

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: OrgUser | null;
}

const ROLE_OPTIONS = [
  { value: 'operations_manager', label: 'Operations Manager' },
  { value: 'warehouse_manager', label: 'Warehouse Manager' },
  { value: 'carrier_partner', label: 'Carrier Partner' },
  { value: 'finance', label: 'Finance' },
  { value: 'customer_support', label: 'Customer Support' },
];

const STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

export function EditUserModal({ isOpen, onClose, onSuccess, user }: EditUserModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', is_active: 'true' });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name,
        role: user.role,
        is_active: String(user.is_active),
      });
    }
  }, [user]);

  const set = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!user) return;
    if (!form.name.trim()) {
      toast.error('Validation Error', 'Name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await put(`/users/${user.id}`, {
        name: form.name,
        role: form.role,
        is_active: form.is_active === 'true',
      });
      toast.success('User Updated', `${form.name} has been updated`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error('Failed', msg || 'Could not update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Team Member" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Full Name
          </label>
          <Input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Full name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Role
          </label>
          <Select
            value={form.role}
            onChange={(e) => set('role', e.target.value)}
            options={ROLE_OPTIONS}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <Select
            value={form.is_active}
            onChange={(e) => set('is_active', e.target.value)}
            options={STATUS_OPTIONS}
          />
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">Email:</span> {user?.email}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            To change a user's email or password, the user must do so from their profile settings.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} isLoading={isSubmitting}>
          Save Changes
        </Button>
      </div>
    </Modal>
  );
}
