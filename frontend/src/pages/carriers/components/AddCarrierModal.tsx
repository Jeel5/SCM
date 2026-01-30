import { useState, FormEvent } from 'react';
import { Modal, Button, Input, Select } from '@/components/ui';
import { carriersApi } from '@/api/services';
import { toast } from '@/stores/toastStore';

export function AddCarrierModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    contactPhone: '',
    contactEmail: '',
    website: '',
    status: 'active',
    services: [] as string[],
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await carriersApi.createCarrier({
        code: formData.code,
        name: formData.name,
        contactPhone: formData.contactPhone,
        contactEmail: formData.contactEmail,
        website: formData.website,
        status: formData.status,
        servicesOffered: formData.services,
      });

      toast.success('Carrier added successfully');
      onClose();
      
      // Reset form
      setFormData({
        code: '',
        name: '',
        contactPhone: '',
        contactEmail: '',
        website: '',
        status: 'active',
        services: [],
      });
      
      // Reload page to refresh data
      window.location.reload();
    } catch (error: any) {
      toast.error('Failed to add carrier', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleServiceToggle = (service: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Carrier" size="lg">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input 
          label="Carrier Code" 
          placeholder="e.g., DHL-001, FEDEX-001" 
          required 
          value={formData.code}
          onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
          helperText="Use format: CARRIER-XXX (e.g., DHL-001)"
          pattern="[A-Z0-9-]+"
          maxLength={50}
        />
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
        <Select
          label="Status"
          value={formData.status}
          onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'pending', label: 'Pending' },
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
            {isSubmitting ? 'Adding...' : 'Add Carrier'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
