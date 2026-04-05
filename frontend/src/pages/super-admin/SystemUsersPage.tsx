import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Users, LogIn, RefreshCw, ShieldCheck, UserCog, User, Briefcase, CheckCircle2, UserX, Building2 } from 'lucide-react';
import { Card, Input, Badge, Skeleton, Button } from '@/components/ui';
import { superAdminApi } from '@/api/services';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores';
import { toast } from '@/stores/toastStore';

interface GlobalUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  last_login?: string | null;
  created_at: string;
  organization_id: string;
  organization_name: string;
  organization_code: string;
}

const getRoleCardMeta = (role: string) => {
  switch (role) {
    case 'superadmin':
      return {
        icon: <ShieldCheck className="h-4 w-4 text-rose-600" />,
        iconBg: 'bg-rose-100 dark:bg-rose-900/30',
      };
    case 'admin':
      return {
        icon: <UserCog className="h-4 w-4 text-indigo-600" />,
        iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      };
    case 'manager':
      return {
        icon: <Briefcase className="h-4 w-4 text-emerald-600" />,
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      };
    default:
      return {
        icon: <User className="h-4 w-4 text-blue-600" />,
        iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      };
  }
};

const getRoleBadgeVariant = (role: string): 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'outline' => {
  switch (role) {
    case 'superadmin':
      return 'purple';
    case 'admin':
      return 'info';
    case 'manager':
      return 'success';
    default:
      return 'default';
  }
};

const toTitleCase = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

export function SystemUsersPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await superAdminApi.getGlobalUsers({ limit: 200, search: search || undefined });
      setUsers((response.data || []) as GlobalUser[]);
    } catch {
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach((u) => {
      counts[u.role] = (counts[u.role] || 0) + 1;
    });
    return counts;
  }, [users]);

  const activeUsers = useMemo(() => users.filter((u) => u.is_active).length, [users]);
  const inactiveUsers = useMemo(() => users.length - activeUsers, [users, activeUsers]);
  const organizationCount = useMemo(
    () => new Set(users.map((u) => u.organization_id).filter(Boolean)).size,
    [users]
  );
  const sortedRoleCounts = useMemo(
    () => Object.entries(roleCounts).sort((a, b) => b[1] - a[1]),
    [roleCounts]
  );

  const handleImpersonate = async (u: GlobalUser) => {
    if (u.role === 'superadmin') return;
    try {
      setImpersonatingUserId(u.id);
      const response = await superAdminApi.startImpersonation(u.id);
      const nextUser = response.data?.user;
      if (nextUser) {
        setUser(nextUser);
        toast.success('Impersonation Active', `You are now acting as ${u.name}`);
        navigate('/dashboard');
      }
    } catch {
      // handled by interceptor
    } finally {
      setImpersonatingUserId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">System Users</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
            Global directory and impersonation control across all organizations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} isLoading={isLoading} onClick={() => void loadUsers()}>
            Refresh
          </Button>
          <Link to="/super-admin/dashboard">
            <Button variant="outline">Dashboard</Button>
          </Link>
          <Link to="/super-admin/companies">
            <Button variant="outline">Companies</Button>
          </Link>
          <Link to="/super-admin/health">
            <Button variant="outline">System Health</Button>
          </Link>
        </div>
      </div>

      <Card>
        <div className="p-4 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="w-full md:max-w-md">
            <Input
              placeholder="Search users, email, or organization..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {users.length} users in {organizationCount} orgs
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{users.length}</p>
            </div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users className="h-4 w-4 text-blue-600" />
            </span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Active</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{activeUsers}</p>
            </div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Inactive</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{inactiveUsers}</p>
            </div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <UserX className="h-4 w-4 text-amber-600" />
            </span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Organizations</p>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{organizationCount}</p>
            </div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <Building2 className="h-4 w-4 text-indigo-600" />
            </span>
          </div>
        </Card>

        {sortedRoleCounts.map(([role, count]) => {
          const meta = getRoleCardMeta(role);
          return (
            <Card key={role} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{toTitleCase(role)}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{count}</p>
                </div>
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${meta.iconBg}`}>
                  {meta.icon}
                </span>
              </div>
            </Card>
          );
        })}

      </div>

      <Card>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">User</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Role</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Organization</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Last Login</th>
                  <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200">
                          {(u.name || u.email || 'U').substring(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{u.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={getRoleBadgeVariant(u.role)}>{toTitleCase(u.role)}</Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {u.organization_name}
                      <span className="ml-2 text-xs text-gray-500">{u.organization_code}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={u.is_active ? 'success' : 'warning'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {u.last_login ? formatDate(new Date(u.last_login), 'MMM dd, yyyy HH:mm') : 'Never'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<LogIn className="h-3.5 w-3.5" />}
                        disabled={u.role === 'superadmin' || Boolean(impersonatingUserId)}
                        isLoading={impersonatingUserId === u.id}
                        onClick={() => void handleImpersonate(u)}
                      >
                        Impersonate
                      </Button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No users found for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
