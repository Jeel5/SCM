import { useState, useEffect, type FormEvent } from 'react';
import { Modal, Button, Input, Select } from '@/components/ui';
import { carriersApi } from '@/api/services';
import { toast } from '@/stores/toastStore';
import type { Carrier } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  carrier: Carrier | null;
}

export function EditCarrierModal({ isOpen, onClose, onSuccess, carrier }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contactPhone: '',
    contactEmail: '',
    website: '',
    apiEndpoint: '',
    webhookUrl: '',
    status: 'active',
    services: [] as string[],
  });

  // Populate form when carrier changes
  useEffect(() => {
    if (carrier) {
      setFormData({
        name: carrier.name || '',
        contactPhone: carrier.contactPhone || '',
        contactEmail: carrier.contactEmail || '',
        website: carrier.website || '',
        apiEndpoint: carrier.apiEndpoint || '',
        webhookUrl: carrier.webhookUrl || '',
        status: carrier.status || 'active',
        services: carrier.services ?? carrier.servicesOffered ?? [],
      });
    }
  }, [carrier]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!carrier) return;
    setIsSubmitting(true);

    try {
      await carriersApi.updateCarrier(carrier.id, {
        name: formData.name,
        contactEmail: formData.contactEmail,
        contactPhone: formData.contactPhone,
        website: formData.website,
        apiEndpoint: formData.apiEndpoint,
        webhookUrl: formData.webhookUrl,
        status: formData.status as Carrier['status'],
        servicesOffered: formData.services,
      });

      toast.success('Carrier updated successfully');
      onClose();
      onSuccess?.();
    } catch (error: any) {
      if (!error.response) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        toast.error('Failed to update carrier', msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleServiceToggle = (service: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service],
    }));
  };

  if (!carrier) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit ${carrier.name}`} size="lg">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Carrier Name"
          placeholder="Enter carrier name"
          required
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Contact Phone"
            placeholder="+1 (555) 000-0000"
            required
            value={formData.contactPhone}
            onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
          />
          <Input
            label="Contact Email"
            type="email"
            placeholder="contact@carrier.com"
            required
            value={formData.contactEmail}
            onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
          />
        </div>
        <Input
          label="Website"
          placeholder="https://www.carrier.com"
          value={formData.website}
          onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="API Endpoint"
            placeholder="https://api.carrier.com/v1"
            value={formData.apiEndpoint}
            onChange={(e) => setFormData(prev => ({ ...prev, apiEndpoint: e.target.value }))}
          />
          <Input
            label="Webhook URL"
            placeholder="https://carrier.com/webhooks/scm"
            value={formData.webhookUrl}
            onChange={(e) => setFormData(prev => ({ ...prev, webhookUrl: e.target.value }))}
          />
        </div>
        <Select
          label="Status"
          value={formData.status}
          onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'suspended', label: 'Suspended' },
          ]}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Services Offered</label>
          <div className="grid grid-cols-3 gap-2">
            {['express', 'standard', 'economy', 'freight', 'cold_chain', 'hazmat'].map((service) => (
              <label
                key={service}
                className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <input
                  type="checkbox"
                  className="rounded text-blue-600"
                  checked={formData.services.includes(service)}
                  onChange={() => handleServiceToggle(service)}
                />
                <span className="text-sm capitalize">{service.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
