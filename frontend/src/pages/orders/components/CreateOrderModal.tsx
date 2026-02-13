import { useState } from 'react';
import { Modal, Button, Input, Select, useToast } from '@/components/ui';
import { api } from '@/api/client';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateOrderModal({ isOpen, onClose, onSuccess }: CreateOrderModalProps) {
  const { success, error } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    priority: 'standard',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    productName: 'Sample Product',
    quantity: 1,
    unitPrice: 1000,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const orderData = {
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone,
        priority: formData.priority,
        shippingAddress: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          postal_code: formData.postalCode,
          country: formData.country,
        },
        items: [{
          productName: formData.productName,
          sku: `SKU-${Date.now()}`,
          quantity: formData.quantity,
          unitPrice: formData.unitPrice,
        }],
      };

      await api.post('/orders', orderData);
      success('Order created successfully!');
      onClose();
      onSuccess?.();
    } catch (err: any) {
      error(err.message || 'Failed to create order');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Order" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Section */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Customer Information</h4>
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Customer Name" 
              placeholder="Enter customer name" 
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              required
            />
            <Input 
              label="Email" 
              type="email" 
              placeholder="customer@example.com" 
              value={formData.customerEmail}
              onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
              required
            />
            <Input 
              label="Phone" 
              placeholder="+91 98765 43210" 
              value={formData.customerPhone}
              onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
              required
            />
            <Select
              label="Priority"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              options={[
                { value: 'standard', label: 'Standard' },
                { value: 'express', label: 'Express' },
                { value: 'bulk', label: 'Bulk' },
              ]}
            />
          </div>
        </div>

        {/* Shipping Address */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Shipping Address</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input 
                label="Street Address" 
                placeholder="123 MG Road" 
                value={formData.street}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                required
              />
            </div>
            <Input 
              label="City" 
              placeholder="Mumbai" 
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              required
            />
            <Input 
              label="State" 
              placeholder="Maharashtra" 
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              required
            />
            <Input 
              label="Postal Code" 
              placeholder="400001" 
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              required
            />
            <Select
              label="Country"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              options={[
                { value: 'India', label: 'India' },
                { value: 'Bangladesh', label: 'Bangladesh' },
                { value: 'Nepal', label: 'Nepal' },
              ]}
            />
          </div>
        </div>

        {/* Product Details */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Product Details</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Input 
                label="Product Name" 
                placeholder="Product name" 
                value={formData.productName}
                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                required
              />
            </div>
            <Input 
              label="Quantity" 
              type="number" 
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
              required
            />
            <div className="col-span-3">
              <Input 
                label="Unit Price (₹)" 
                type="number" 
                min="1"
                value={formData.unitPrice}
                onChange={(e) => setFormData({ ...formData, unitPrice: parseInt(e.target.value) || 0 })}
                required
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="outline" className="flex-1" onClick={onClose} type="button" disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Order'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
