import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, RefreshCw, History } from 'lucide-react';
import { Card, Input, Select, Skeleton, Button, Badge } from '@/components/ui';
import { superAdminApi } from '@/api/services';
import { formatDate } from '@/lib/utils';

interface AuditLogRow {
  id: string;
  organization_id: string;
  organization_name?: string | null;
  organization_code?: string | null;
  action: string;
  performed_by?: string | null;
  performed_by_role?: string | null;
  performed_by_name?: string | null;
  performed_by_email?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'deleted', label: 'Deleted' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'reactivated', label: 'Reactivated' },
  { value: 'impersonated', label: 'Impersonated' },
];

export function SuperAdminAuditPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');

  const loadAudit = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await superAdminApi.getGlobalAudit({ limit: 120, search: search || undefined, action: action || undefined });
      setRows((response.data || []) as AuditLogRow[]);
    } catch {
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, action]);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.action] = (counts[row.action] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [rows]);

  const actionVariant = (value: string) => {
    if (value === 'deleted' || value === 'suspended') return 'error' as const;
    if (value === 'reactivated' || value === 'created') return 'success' as const;
    if (value === 'updated') return 'info' as const;
    return 'default' as const;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Audit Center</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
            Cross-organization superadmin action history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} isLoading={isLoading} onClick={() => void loadAudit()}>
            Refresh
          </Button>
          <Link to="/super-admin/dashboard"><Button variant="outline">Dashboard</Button></Link>
          <Link to="/super-admin/companies"><Button variant="outline">Companies</Button></Link>
          <Link to="/super-admin/users"><Button variant="outline">System Users</Button></Link>
        </div>
      </div>

      <Card>
        <div className="p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="w-full md:max-w-md">
            <Input
              placeholder="Search org, actor, email, or action..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="w-full md:w-56">
            <Select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              options={ACTION_OPTIONS}
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summary.map(([name, count]) => (
          <Card key={name} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">{name}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{count}</p>
              </div>
              <History className="h-4 w-4 text-gray-400" />
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, idx) => <Skeleton key={idx} className="h-10 w-full" />)}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">When</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Organization</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Action</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Actor</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">Role</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-gray-500">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">{formatDate(new Date(r.created_at), 'MMM dd, yyyy HH:mm')}</td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900 dark:text-white">{r.organization_name || 'Unknown Org'}</p>
                      <p className="text-xs text-gray-500">{r.organization_code || r.organization_id}</p>
                    </td>
                    <td className="py-3 px-4"><Badge variant={actionVariant(r.action)}>{r.action}</Badge></td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">{r.performed_by_name || 'System'}</td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">{r.performed_by_role || '—'}</td>
                    <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">{r.ip_address || '—'}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No audit entries found.</td>
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
