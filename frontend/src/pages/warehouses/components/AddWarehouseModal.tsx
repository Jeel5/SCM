import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input, Select, useToast, LocationPicker } from '@/components/ui';
import { warehousesApi } from '@/api/services';

import type { Warehouse } from '@/types';

interface AddWarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: Warehouse | null;
}

export function AddWarehouseModal({ isOpen, onClose, onSuccess, initialData }: AddWarehouseModalProps) {
  const { success, error: showError } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    warehouse_type: initialData?.type || 'standard',
    street: initialData?.address?.street || '',
    city: initialData?.address?.city || '',
    state: initialData?.address?.state || '',
    postal_code: initialData?.address?.postalCode || '',
    country: initialData?.address?.country || 'India',
    lat: initialData?.location?.lat || null as number | null,
    lng: initialData?.location?.lng || null as number | null,
    capacity: initialData?.capacity?.toString() || '',
    contact_email: initialData?.contactEmail || '',
    contact_phone: initialData?.contactPhone || '',
    is_active: initialData ? initialData.status === 'active' : true,
    // SCM operational fields
    temperature_min_celsius: initialData?.temperatureMinCelsius?.toString() || '',
    temperature_max_celsius: initialData?.temperatureMaxCelsius?.toString() || '',
  });

  // Effect removed as updating initialData dynamically without warning is tricky, we can just use key to remount the modal or set state on open.

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload: Partial<Warehouse> & Record<string, any> = {
        name: formData.name,
        warehouse_type: formData.warehouse_type,
        address: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          postal_code: formData.postal_code,
          country: formData.country,
        },
        coordinates: formData.lat && formData.lng ? {
          lat: formData.lat,
          lng: formData.lng,
        } : null,
        capacity: formData.capacity ? parseInt(formData.capacity, 10) : 10000,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone || null,
        is_active: formData.is_active,
        // SCM operational fields
        has_cold_storage: formData.warehouse_type === 'cold_storage',
        temperature_min_celsius: formData.temperature_min_celsius ? parseFloat(formData.temperature_min_celsius) : null,
        temperature_max_celsius: formData.temperature_max_celsius ? parseFloat(formData.temperature_max_celsius) : null,
        customs_bonded_warehouse: formData.warehouse_type === 'bonded_customs',
      };

      if (initialData) {
        await warehousesApi.updateWarehouse(initialData.id, payload);
        success('Warehouse updated successfully!');
      } else {
        await warehousesApi.createWarehouse(payload);
        success('Warehouse created successfully!');
      }

      // Reset form if creating
      if (!initialData) {
        setFormData({
          name: '',
          warehouse_type: 'standard',
          street: '',
          city: '',
          state: '',
          postal_code: '',
          country: 'India',
          lat: null,
          lng: null,
          capacity: '',
          contact_email: '',
          contact_phone: '',
          is_active: true,
          temperature_min_celsius: '',
          temperature_max_celsius: '',
        });
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to save warehouse');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Edit Warehouse" : "Add New Warehouse"} size="4xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Warehouse Name"
          placeholder="Enter warehouse name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Warehouse Type"
            value={formData.warehouse_type}
            onChange={(e) => handleChange('warehouse_type', e.target.value)}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'cold_storage', label: 'Cold Storage' },
              { value: 'hazmat', label: 'Hazmat' },
              { value: 'distribution', label: 'Distribution' },
              { value: 'fulfillment', label: 'Fulfillment Center' },
              { value: 'bonded_customs', label: 'Bonded Customs' },
              { value: 'returns_center', label: 'Returns Center' },
            ]}
          />
          <Select
            label="Status"
            value={formData.is_active ? 'active' : 'inactive'}
            onChange={(e) => handleChange('is_active', e.target.value === 'active')}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Address</h4>
          <Input
            label="Street Address"
            placeholder="123 Main Street"
            value={formData.street}
            onChange={(e) => handleChange('street', e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="City"
              placeholder="Mumbai"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              required
            />
            <Input
              label="State"
              placeholder="Maharashtra"
              value={formData.state}
              onChange={(e) => handleChange('state', e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Postal Code"
              placeholder="400001"
              value={formData.postal_code}
              onChange={(e) => handleChange('postal_code', e.target.value)}
              required
            />
            <Select
              label="Country"
              value={formData.country}
              onChange={(e) => handleChange('country', e.target.value)}
              options={[
                { value: 'India', label: 'India' },
              ]}
            />
          </div>
        </div>

        <LocationPicker
          latitude={formData.lat || undefined}
          longitude={formData.lng || undefined}
          onLocationChange={(lat, lng) => {
            setFormData(prev => ({ ...prev, lat, lng }));
          }}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Capacity (units)"
            type="number"
            placeholder="10000"
            value={formData.capacity}
            onChange={(e) => handleChange('capacity', e.target.value)}
          />
        </div>


        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Contact Email"
              type="email"
              placeholder="warehouse@company.com"
              value={formData.contact_email}
              onChange={(e) => handleChange('contact_email', e.target.value)}
              required
            />
            <Input
              label="Contact Phone"
              type="tel"
              placeholder="+91 98765 43210"
              value={formData.contact_phone}
              onChange={(e) => handleChange('contact_phone', e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Add Warehouse'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
