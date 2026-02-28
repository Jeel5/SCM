import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  UserPlus,
  Search,
  Users,
  Shield,
  MoreVertical,
  Pencil,
  UserX,
  UserCheck,
  RefreshCw,
} from 'lucide-react';
import { Button, Input, Badge, Dropdown } from '@/components/ui';
import { get, del } from '@/api/client';
import { toast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores';
import { InviteUserModal } from './components/InviteUserModal';
import { EditUserModal } from './components/EditUserModal';

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  organization_id: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  operations_manager: 'Operations Manager',
  warehouse_manager: 'Warehouse Manager',
  carrier_partner: 'Carrier Partner',
  finance: 'Finance',
  customer_support: 'Customer Support',
};

const ROLE_COLORS: Record<string, 'info' | 'purple' | 'success' | 'warning' | 'error' | 'default'> = {
  admin: 'info',
  operations_manager: 'purple',
  warehouse_manager: 'success',
  carrier_partner: 'warning',
  finance: 'warning',
  customer_support: 'default',
};

function formatDate(iso: string | null) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function TeamPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<OrgUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = {};
      if (search) params.search = search;
      if (filterStatus !== 'all') params.is_active = filterStatus === 'active';

      const res = await get<{ success: boolean; data: OrgUser[]; total: number }>(
        '/users',
        params
      );
      setUsers(res.data);
      setTotal(res.total);
    } catch {
      toast.error('Error', 'Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  }, [search, filterStatus]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDeactivate = async (user: OrgUser) => {
    try {
      await del(`/users/${user.id}`);
      toast.success('Deactivated', `${user.name} has been deactivated`);
      fetchUsers();
    } catch {
      toast.error('Error', 'Failed to deactivate user');
    }
  };

  const activeCount = users.filter((u) => u.is_active).length;
  const inactiveCount = users.filter((u) => !u.is_active).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Team Members</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage users and their access roles in your organization
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} leftIcon={<UserPlus className="h-4 w-4" />}>
          Add Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Members', value: total, icon: <Users className="h-5 w-5 text-blue-500" />, bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Active', value: activeCount, icon: <UserCheck className="h-5 w-5 text-green-500" />, bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'Inactive', value: inactiveCount, icon: <UserX className="h-5 w-5 text-gray-400" />, bg: 'bg-gray-50 dark:bg-gray-800' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex items-center gap-4"
          >
            <div className={`p-2.5 rounded-lg ${stat.bg}`}>{stat.icon}</div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-50 max-w-sm">
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4 text-gray-400" />}
          />
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {(['all', 'active', 'inactive'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                filterStatus === s
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={fetchUsers}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading team members...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No team members found</p>
            <p className="text-sm text-gray-400 mt-1">
              {search ? 'Try a different search term' : 'Add your first team member to get started'}
            </p>
            {!search && (
              <Button
                className="mt-4"
                size="sm"
                onClick={() => setInviteOpen(true)}
                leftIcon={<UserPlus className="h-4 w-4" />}
              >
                Add Member
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Member</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Last Login</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Joined</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {users.map((user) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  {/* Member */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {getInitials(user.name)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{user.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                      </div>
                      {user.id === currentUser?.id && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                          You
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-gray-400" />
                      <Badge variant={ROLE_COLORS[user.role] ?? 'default'} size="sm">
                        {ROLE_LABELS[user.role] ?? user.role}
                      </Badge>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <Badge variant={user.is_active ? 'success' : 'default'} size="sm">
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>

                  {/* Last login */}
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {formatDate(user.last_login)}
                  </td>

                  {/* Joined */}
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {formatDate(user.created_at)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    {user.id !== currentUser?.id && (
                      <Dropdown
                        trigger={
                          <button className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        }
                        items={[
                          { label: 'Edit', value: 'edit', icon: <Pencil className="h-4 w-4" /> },
                          {
                            label: 'Deactivate',
                            value: 'deactivate',
                            icon: <UserX className="h-4 w-4" />,
                            disabled: !user.is_active,
                            danger: true,
                          },
                        ]}
                        onSelect={(action) => {
                          if (action === 'edit') setEditUser(user);
                          if (action === 'deactivate' && user.is_active) handleDeactivate(user);
                        }}
                        align="right"
                      />
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      <InviteUserModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSuccess={fetchUsers}
      />
      <EditUserModal
        isOpen={!!editUser}
        onClose={() => setEditUser(null)}
        onSuccess={fetchUsers}
        user={editUser}
      />
    </div>
  );
}
