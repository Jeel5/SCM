import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Users,
  RefreshCw,
  CheckCircle,
  XCircle,
  Globe,
} from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Badge,
  Dropdown,
  Modal,
} from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/utils';
import { del } from '@/api/client';
import { toast } from '@/stores/toastStore';
import { useOrganizations } from './hooks/useOrganizations';
import { CreateOrgModal } from './components/CreateOrgModal';
import { EditOrgModal } from './components/EditOrgModal';
import type { Organization } from './types';

const TIER_BADGE: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
  starter: 'default',
  standard: 'info',
  enterprise: 'success',
};

export function CompaniesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { organizations, total, isLoading, refetch } = useOrganizations({
    search: searchQuery || undefined,
    is_active: activeFilter,
  });

  const handleDelete = async () => {
    if (!deletingOrg) return;
    try {
      setIsDeleting(true);
      await del(`/organizations/${deletingOrg.id}`);
      toast.success('Organization Deactivated', `${deletingOrg.name} has been deactivated`);
      setDeletingOrg(null);
      refetch();
    } catch {
      // Error handled by interceptor
    } finally {
      setIsDeleting(false);
    }
  };

  const activeCount = organizations.filter((o) => o.isActive).length;
  const inactiveCount = organizations.filter((o) => !o.isActive).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Organization Management
          </h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
            Manage all tenant organizations and their admin users
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={refetch}
            isLoading={isLoading}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            New Organization
          </Button>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {[
          { label: 'Total Organizations', value: total, icon: Building2, color: 'blue' },
          { label: 'Active', value: activeCount, icon: CheckCircle, color: 'green' },
          { label: 'Inactive', value: inactiveCount, icon: XCircle, color: 'red' },
          { label: 'Enterprise Tier', value: organizations.filter((o) => o.subscriptionTier === 'enterprise').length, icon: Globe, color: 'purple' },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg bg-${stat.color}-100 dark:bg-${stat.color}-900/30 flex items-center justify-center`}>
                <stat.icon className={`h-5 w-5 text-${stat.color}-600 dark:text-${stat.color}-400`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(stat.value)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      {/* Search and Filters */}
      <Card>
        <div className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name, code, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>
            <div className="flex gap-2">
              {[
                { label: 'All', value: undefined },
                { label: 'Active', value: true },
                { label: 'Inactive', value: false },
              ].map((f) => (
                <button
                  key={String(f.label)}
                  onClick={() => setActiveFilter(f.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeFilter === f.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Organizations Table */}
      <Card>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-16 text-center">
              <RefreshCw className="h-8 w-8 mx-auto text-blue-500 animate-spin mb-3" />
              <p className="text-gray-500 dark:text-gray-400">Loading organizations...</p>
            </div>
          ) : organizations.length === 0 ? (
            <div className="py-16 text-center">
              <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">No organizations found</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                {searchQuery ? 'Try a different search term' : 'Create your first organization to get started'}
              </p>
              {!searchQuery && (
                <Button
                  variant="primary"
                  className="mt-4"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  New Organization
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  {['Organization', 'Contact', 'Location', 'Tier', 'Status', 'Created', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="text-left py-4 px-6 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {organizations.map((org) => (
                  <motion.tr
                    key={org.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {/* Organization */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                          {(org.code || org.name).substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{org.name}</div>
                          <code className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                            {org.code}
                          </code>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="py-4 px-6">
                      <div className="text-sm">
                        <div className="text-gray-900 dark:text-white">{org.email || '—'}</div>
                        <div className="text-gray-500 dark:text-gray-400">{org.phone || '—'}</div>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-4 px-6 text-sm text-gray-700 dark:text-gray-300">
                      {[org.city, org.state, org.country].filter(Boolean).join(', ') || '—'}
                    </td>

                    {/* Tier */}
                    <td className="py-4 px-6">
                      <Badge variant={TIER_BADGE[org.subscriptionTier || 'standard'] || 'default'}>
                        {org.subscriptionTier || 'standard'}
                      </Badge>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      <Badge variant={org.isActive ? 'success' : 'warning'}>
                        {org.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>

                    {/* Created */}
                    <td className="py-4 px-6 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(new Date(org.createdAt), 'MMM dd, yyyy')}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6">
                      <Dropdown
                        trigger={
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        }
                        items={[
                          {
                            label: 'Manage Users',
                            value: 'users',
                            icon: <Users className="h-4 w-4" />,
                          },
                          {
                            label: 'Edit',
                            value: 'edit',
                            icon: <Edit className="h-4 w-4" />,
                          },
                          {
                            label: org.isActive ? 'Deactivate' : 'Already Inactive',
                            value: 'delete',
                            icon: <Trash2 className="h-4 w-4" />,
                            danger: true,
                          },
                        ]}
                        onSelect={(value) => {
                          if (value === 'edit') setEditingOrg(org);
                          if (value === 'delete' && org.isActive) setDeletingOrg(org);
                        }}
                      />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Modals */}
      <CreateOrgModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={refetch}
      />

      <EditOrgModal
        isOpen={!!editingOrg}
        onClose={() => setEditingOrg(null)}
        onSuccess={refetch}
        organization={editingOrg}
      />

      {/* Confirm Deactivate Modal */}
      <Modal
        isOpen={!!deletingOrg}
        onClose={() => setDeletingOrg(null)}
        title="Deactivate Organization"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            Are you sure you want to deactivate{' '}
            <span className="font-semibold text-gray-900 dark:text-white">{deletingOrg?.name}</span>?
            All users in this organization will lose access.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeletingOrg(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} isLoading={isDeleting}>
              Deactivate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
