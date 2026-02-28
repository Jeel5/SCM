import { useState, useEffect, type FormEvent } from 'react';
import { Plus, Store, Pencil, Trash2, Copy, CheckCircle } from 'lucide-react';
import { Button, Badge, DataTable, Modal, Input, Select, PermissionGate } from '@/components/ui';
import { channelsApi, warehousesApi } from '@/api/services';
import { toast } from '@/stores/toastStore';

interface Channel {
  id: string;
  name: string;
  code: string;
  platform_type: string;
  webhook_token: string;
  api_endpoint: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  default_warehouse_id: string | null;
  warehouse_name: string | null;
  is_active: boolean;
  created_at: string;
}

const PLATFORM_TYPES = [
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'd2c', label: 'Direct to Consumer (D2C)' },
  { value: 'b2b', label: 'Business to Business (B2B)' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'internal', label: 'Internal' },
];

const emptyForm = {
  name: '', platform_type: 'marketplace',
  api_endpoint: '', contact_name: '', contact_email: '', contact_phone: '',
  default_warehouse_id: '',
};

export function ChannelsTab() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchChannels = async () => {
    setIsLoading(true);
    try {
      const response = await channelsApi.getChannels({ limit: 100 });
      setChannels(response.data);
    } catch {
      toast.error('Failed to load sales channels');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await warehousesApi.getWarehouses();
      setWarehouses(res.data.map((w: { id: string; name?: string; code?: string }) => ({ id: w.id, name: w.name || w.code || '' })));
    } catch { /* ok — optional */ }
  };

  useEffect(() => { fetchChannels(); fetchWarehouses(); }, []);

  const openAddModal = () => {
    setEditingChannel(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (ch: Channel) => {
    setEditingChannel(ch);
    setFormData({
      name: ch.name,
      platform_type: ch.platform_type,
      api_endpoint: ch.api_endpoint || '',
      contact_name: ch.contact_name || '',
      contact_email: ch.contact_email || '',
      contact_phone: ch.contact_phone || '',
      default_warehouse_id: ch.default_warehouse_id || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        ...formData,
        default_warehouse_id: formData.default_warehouse_id || null,
      };
      if (editingChannel) {
        await channelsApi.updateChannel(editingChannel.id, payload);
        toast.success('Channel updated');
      } else {
        await channelsApi.createChannel(payload);
        toast.success('Channel created');
      }
      setIsModalOpen(false);
      fetchChannels();
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to save channel');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (ch: Channel) => {
    if (!confirm(`Delete channel "${ch.name}"? This cannot be undone.`)) return;
    try {
      await channelsApi.deleteChannel(ch.id);
      toast.success('Channel deleted');
      fetchChannels();
    } catch {
      toast.error('Failed to delete channel');
    }
  };

  const copyToken = (token: string, id: string) => {
    navigator.clipboard.writeText(token);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const columns = [
    {
      key: 'name',
      header: 'Channel',
      sortable: true,
      render: (ch: Channel) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Store className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{ch.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{ch.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'platform_type',
      header: 'Type',
      render: (ch: Channel) => (
        <Badge variant="default" className="capitalize">{ch.platform_type.replace('_', ' ')}</Badge>
      ),
    },
    {
      key: 'webhook_token',
      header: 'Webhook Token',
      render: (ch: Channel) => (
        <div className="flex items-center gap-2">
          <code className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
            {ch.webhook_token?.substring(0, 16)}...
          </code>
          <button
            onClick={(e) => { e.stopPropagation(); copyToken(ch.webhook_token, ch.id); }}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500"
            title="Copy full token"
          >
            {copiedId === ch.id ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      ),
    },
    {
      key: 'warehouse',
      header: 'Default Warehouse',
      render: (ch: Channel) => (
        <span className="text-sm text-gray-600 dark:text-gray-300">{ch.warehouse_name || '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (ch: Channel) => (
        <Badge variant={ch.is_active ? 'success' : 'error'}>
          {ch.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '100px',
      render: (ch: Channel) => (
        <PermissionGate permission="channels.manage">
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); openEditModal(ch); }}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(ch); }}
              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </PermissionGate>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          E-commerce platforms and marketplaces that send orders via webhooks
        </p>
        <PermissionGate permission="channels.manage">
          <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={openAddModal}>
            Add Channel
          </Button>
        </PermissionGate>
      </div>

      <DataTable
        columns={columns}
        data={channels}
        isLoading={isLoading}
        searchPlaceholder="Search channels..."
        emptyMessage="No sales channels configured yet"
        className="border-0 rounded-none"
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingChannel ? 'Edit Sales Channel' : 'Add Sales Channel'}
        size="lg"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Channel Name"
              placeholder="e.g., Croma, Amazon, Shopify"
              required
              value={formData.name}
              onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
            />
          </div>
          <Select
            label="Platform Type"
            value={formData.platform_type}
            onChange={(e) => setFormData(p => ({ ...p, platform_type: e.target.value }))}
            options={PLATFORM_TYPES}
          />
          <Input
            label="API Endpoint"
            placeholder="https://api.platform.com/orders"
            value={formData.api_endpoint}
            onChange={(e) => setFormData(p => ({ ...p, api_endpoint: e.target.value }))}
          />
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Contact Name"
              placeholder="Account Manager"
              value={formData.contact_name}
              onChange={(e) => setFormData(p => ({ ...p, contact_name: e.target.value }))}
            />
            <Input
              label="Contact Email"
              type="email"
              placeholder="contact@platform.com"
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
          {warehouses.length > 0 && (
            <Select
              label="Default Warehouse"
              value={formData.default_warehouse_id}
              onChange={(e) => setFormData(p => ({ ...p, default_warehouse_id: e.target.value }))}
              options={[{ value: '', label: '— None —' }, ...warehouses.map(w => ({ value: w.id, label: w.name }))]}
            />
          )}
          <div className="flex items-center gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editingChannel ? 'Update Channel' : 'Add Channel'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
