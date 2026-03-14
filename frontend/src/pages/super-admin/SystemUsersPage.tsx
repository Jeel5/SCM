import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, LogIn } from 'lucide-react';
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

export function SystemUsersPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setIsLoading(true);
        const response = await superAdminApi.getGlobalUsers({ limit: 200, search: search || undefined });
        if (mounted) {
          setUsers((response.data || []) as GlobalUser[]);
        }
      } catch {
        if (mounted) {
          setUsers([]);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [search]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach((u) => {
      counts[u.role] = (counts[u.role] || 0) + 1;
    });
    return counts;
  }, [users]);

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
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">System Users</h1>
        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
          Global user directory across all organizations.
        </p>
      </div>

      <Card>
        <div className="p-4 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="w-full md:max-w-md">
            <Input
              placeholder="Search users, email, or organization..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Users className="h-4 w-4" />
            {users.length} users
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(roleCounts).map(([role, count]) => (
          <Card key={role} className="p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{role}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{count}</p>
          </Card>
        ))}
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
                      <p className="font-medium text-gray-900 dark:text-white">{u.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="info">{u.role}</Badge>
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
                        disabled={u.role === 'superadmin' || !!impersonatingUserId}
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
