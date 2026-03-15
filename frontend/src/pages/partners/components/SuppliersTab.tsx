import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Plus, Package, Pencil, Trash2, Eye } from 'lucide-react';
import { Button, Badge, DataTable, Modal, Input, Select, PermissionGate } from '@/components/ui';
import { suppliersApi } from '@/api/services';
import { readCsvFile } from '@/lib/csvImport';
import { toast } from '@/stores/toastStore';

interface Supplier {
  id: string;
  name: string;
  code: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  postal_code: string | null;
  lead_time_days: number;
  payment_terms: string | null;
  reliability_score: number;
  is_active: boolean;
  created_at: string;
}

const emptyForm = {
  name: '', contact_name: '', contact_email: '', contact_phone: '',
  website: '', address: '', city: '', state: '', country: 'India', postal_code: '',
  lead_time_days: '7', payment_terms: '', reliability_score: '0.85',
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
      website: s.website || '',
      address: s.address || '',
      city: s.city || '',
      state: s.state || '',
      country: s.country || 'India',
      postal_code: s.postal_code || '',
      lead_time_days: String(s.lead_time_days),
      payment_terms: s.payment_terms || '',
      reliability_score: String(s.reliability_score),
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        ...formData,
        lead_time_days: parseInt(formData.lead_time_days, 10) || 7,
        reliability_score: parseFloat(formData.reliability_score) || 0.85,
      };
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
      const rows = await readCsvFile(file);
      if (!rows.length) {
        toast.error('CSV is empty', 'Please upload a valid CSV file with headers');
        return;
      }

      let created = 0;
      let failed = 0;
      for (const row of rows) {
        try {
          await suppliersApi.createSupplier({
            name: row.name,
            contact_name: row.contact_name || null,
            contact_email: row.contact_email || null,
            contact_phone: row.contact_phone || null,
            website: row.website || null,
            address: row.address || null,
            city: row.city || null,
            state: row.state || null,
            country: row.country || 'India',
            postal_code: row.postal_code || null,
            lead_time_days: Number(row.lead_time_days) || 7,
            payment_terms: row.payment_terms || null,
            reliability_score: row.reliability_score ? Number(row.reliability_score) : 0.85,
          });
          created += 1;
        } catch {
          failed += 1;
        }
      }

      if (created > 0) {
        toast.success('Suppliers import completed', `${created} created${failed ? `, ${failed} failed` : ''}`);
        fetchSuppliers(true);
      } else {
        toast.error('Suppliers import failed', 'No rows were imported. Check CSV columns.');
      }
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
      key: 'lead_time',
      header: 'Lead Time',
      sortable: true,
      render: (s: Supplier) => (
        <span className="text-sm font-medium dark:text-gray-200">{s.lead_time_days} days</span>
      ),
    },
    {
      key: 'payment',
      header: 'Payment Terms',
      render: (s: Supplier) => (
        <span className="text-sm text-gray-600 dark:text-gray-300">{s.payment_terms || '—'}</span>
      ),
    },
    {
      key: 'reliability',
      header: 'Reliability',
      sortable: true,
      render: (s: Supplier) => {
        const pct = Math.round(parseFloat(String(s.reliability_score)) * 100);
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{pct}%</span>
          </div>
        );
      },
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
        isOpen={!!viewingSupplier}
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
            <p><strong>Lead Time:</strong> {viewingSupplier.lead_time_days} days</p>
            <p><strong>Reliability:</strong> {Math.round(Number(viewingSupplier.reliability_score) * 100)}%</p>
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
            label="Website"
            placeholder="https://www.supplier.com"
            value={formData.website}
            onChange={(e) => setFormData(p => ({ ...p, website: e.target.value }))}
          />

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

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Lead Time (days)"
              type="number"
              min={0}
              max={365}
              value={formData.lead_time_days}
              onChange={(e) => setFormData(p => ({ ...p, lead_time_days: e.target.value }))}
            />
            <Select
              label="Payment Terms"
              value={formData.payment_terms}
              onChange={(e) => setFormData(p => ({ ...p, payment_terms: e.target.value }))}
              options={[
                { value: '', label: '— Select —' },
                { value: 'Net30', label: 'Net 30' },
                { value: 'Net60', label: 'Net 60' },
                { value: 'Net90', label: 'Net 90' },
                { value: 'COD', label: 'Cash on Delivery' },
                { value: 'Advance', label: 'Advance Payment' },
                { value: 'LC', label: 'Letter of Credit' },
              ]}
            />
            <Input
              label="Reliability Score (0-1)"
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={formData.reliability_score}
              onChange={(e) => setFormData(p => ({ ...p, reliability_score: e.target.value }))}
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
