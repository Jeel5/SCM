import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Plus, Package, Pencil, Trash2, Eye } from 'lucide-react';
import { Button, Badge, DataTable, Modal, Input, PermissionGate } from '@/components/ui';
import { importApi, suppliersApi } from '@/api/services';
import { toast } from '@/stores/toastStore';

interface Supplier {
  id: string;
  name: string;
  code: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  postal_code: string | null;
  is_active: boolean;
  created_at: string;
  api_endpoint: string | null;
  inbound_contact_name: string | null;
  inbound_contact_email: string | null;
}

const emptyForm = {
  name: '', contact_name: '', contact_email: '', contact_phone: '',
  address: '', city: '', state: '', country: 'India', postal_code: '',
  api_endpoint: '', inbound_contact_name: '', inbound_contact_email: '',
};

export function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

    const hasLoaded = useRef(false);

    const fetchSuppliers = async (soft = false) => {
      if (!soft && !hasLoaded.current) setIsLoading(true);
    try {
      const response = await suppliersApi.getSuppliers({ limit: 100 });
      setSuppliers(response.data);
        hasLoaded.current = true;
    } catch {
      toast.error('Failed to load suppliers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const openAddModal = () => {
    setEditingSupplier(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (s: Supplier) => {
    setEditingSupplier(s);
    setFormData({
      name: s.name,
      contact_name: s.contact_name || '',
      contact_email: s.contact_email || '',
      contact_phone: s.contact_phone || '',
      address: s.address || '',
      city: s.city || '',
      state: s.state || '',
      country: s.country || 'India',
      postal_code: s.postal_code || '',
      api_endpoint: s.api_endpoint || '',
      inbound_contact_name: s.inbound_contact_name || '',
      inbound_contact_email: s.inbound_contact_email || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = formData;
      if (editingSupplier) {
        await suppliersApi.updateSupplier(editingSupplier.id, payload);
        toast.success('Supplier updated');
      } else {
        await suppliersApi.createSupplier(payload);
        toast.success('Supplier created');
      }
      setIsModalOpen(false);
        fetchSuppliers(true);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to save supplier');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`Delete supplier "${s.name}"? This cannot be undone.`)) return;
    try {
      await suppliersApi.deleteSupplier(s.id);
      toast.success('Supplier deleted');
        fetchSuppliers(true);
    } catch {
      toast.error('Failed to delete supplier');
    }
  };

  const handleImportCsv = async (file: File) => {
    try {
      const resp = await importApi.upload(file, 'suppliers');
      toast.success('Suppliers import started', `Job queued (${resp.totalRows} rows).`);
      setTimeout(() => fetchSuppliers(true), 1500);
    } catch (e: any) {
      toast.error('Import failed', e?.message || 'Could not read CSV file');
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Supplier',
      sortable: true,
      render: (s: Supplier) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Package className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{s.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (s: Supplier) => (
        <div>
          <p className="text-sm text-gray-900 dark:text-white">{s.contact_name || '—'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{s.contact_email || ''}</p>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (s: Supplier) => (
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {[s.city, s.state].filter(Boolean).join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s: Supplier) => (
        <Badge variant={s.is_active ? 'success' : 'error'}>
          {s.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '130px',
      render: (s: Supplier) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setViewingSupplier(s); }}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            title="View"
          >
            <Eye className="h-4 w-4" />
          </button>
          <PermissionGate permission="suppliers.manage">
            <button
              onClick={(e) => { e.stopPropagation(); openEditModal(s); }}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(s); }}
              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Inbound vendors for purchase orders and inventory replenishment
        </p>
        <PermissionGate permission="suppliers.manage">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
              Import
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={openAddModal}>
              Add Supplier
            </Button>
          </div>
        </PermissionGate>
      </div>

      <DataTable
        columns={columns}
        data={suppliers}
        isLoading={isLoading}
        searchPlaceholder="Search suppliers..."
        emptyMessage="No suppliers configured yet"
        className="border-0 rounded-none"
      />
      <input
        ref={importRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportCsv(file);
          e.currentTarget.value = '';
        }}
      />

      <Modal
        isOpen={Boolean(viewingSupplier)}
        onClose={() => setViewingSupplier(null)}
        title="Supplier Details"
        size="md"
      >
        {viewingSupplier && (
          <div className="space-y-2 text-sm">
            <p><strong>Name:</strong> {viewingSupplier.name}</p>
            <p><strong>Code:</strong> {viewingSupplier.code}</p>
            <p><strong>Contact:</strong> {viewingSupplier.contact_name || '—'}</p>
            <p><strong>Email:</strong> {viewingSupplier.contact_email || '—'}</p>
            <p><strong>Phone:</strong> {viewingSupplier.contact_phone || '—'}</p>
            <p><strong>API Endpoint:</strong> {viewingSupplier.api_endpoint || '—'}</p>
            <p><strong>Inbound Contact:</strong> {viewingSupplier.inbound_contact_name || '—'}</p>
            <p><strong>Inbound Email:</strong> {viewingSupplier.inbound_contact_email || '—'}</p>
            <div className="flex justify-end pt-3">
              <Button variant="outline" onClick={() => setViewingSupplier(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
        size="lg"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Supplier Name"
              placeholder="e.g., ABC Electronics"
              required
              value={formData.name}
              onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Contact Name"
              placeholder="Sales Manager"
              value={formData.contact_name}
              onChange={(e) => setFormData(p => ({ ...p, contact_name: e.target.value }))}
            />
            <Input
              label="Contact Email"
              type="email"
              placeholder="sales@supplier.com"
              value={formData.contact_email}
              onChange={(e) => setFormData(p => ({ ...p, contact_email: e.target.value }))}
            />
            <Input
              label="Contact Phone"
              placeholder="+91 98765 43210"
              value={formData.contact_phone}
              onChange={(e) => setFormData(p => ({ ...p, contact_phone: e.target.value }))}
            />
          </div>

          <Input
            label="API Endpoint (for webhook)"
            placeholder="https://api.supplier.com/webhooks/shipment"
            value={formData.api_endpoint}
            onChange={(e) => setFormData(p => ({ ...p, api_endpoint: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Inbound Contact Name"
              placeholder="Order Manager"
              value={formData.inbound_contact_name}
              onChange={(e) => setFormData(p => ({ ...p, inbound_contact_name: e.target.value }))}
            />
            <Input
              label="Inbound Contact Email"
              type="email"
              placeholder="orders@supplier.com"
              value={formData.inbound_contact_email}
              onChange={(e) => setFormData(p => ({ ...p, inbound_contact_email: e.target.value }))}
            />
          </div>
          <Input
            label="Address"
            placeholder="Full street address"
            value={formData.address}
            onChange={(e) => setFormData(p => ({ ...p, address: e.target.value }))}
          />

          <div className="grid grid-cols-4 gap-4">
            <Input
              label="City"
              placeholder="Mumbai"
              value={formData.city}
              onChange={(e) => setFormData(p => ({ ...p, city: e.target.value }))}
            />
            <Input
              label="State"
              placeholder="Maharashtra"
              value={formData.state}
              onChange={(e) => setFormData(p => ({ ...p, state: e.target.value }))}
            />
            <Input
              label="Country"
              value={formData.country}
              onChange={(e) => setFormData(p => ({ ...p, country: e.target.value }))}
            />
            <Input
              label="Postal Code"
              placeholder="400001"
              value={formData.postal_code}
              onChange={(e) => setFormData(p => ({ ...p, postal_code: e.target.value }))}
            />
          </div>


          <div className="flex items-center gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editingSupplier ? 'Update Supplier' : 'Add Supplier'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
