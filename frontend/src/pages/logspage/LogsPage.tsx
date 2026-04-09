import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, RefreshCw } from 'lucide-react';
import { Card, DataTable, Button, Badge } from '@/components/ui';
import { logsApi } from '@/api/services';
import { useApiMode } from '@/hooks/useApiMode';
import { mockApi } from '@/api/mockData';
import { formatRelativeTime } from '@/lib/utils';
import type { AuditLogEntry } from '@/types';

export function LogsPage() {
  const { useMockApi } = useApiMode();
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      if (useMockApi) {
        const notifications = await mockApi.getNotifications();
        const synthesized: AuditLogEntry[] = notifications.data.map((n, idx) => ({
          id: `mock-log-${idx}`,
          userId: '1',
          userName: 'Demo User',
          userEmail: 'admin@twinchain.in',
          organizationId: 'org-1',
          organizationName: 'TwinChain Demo Org',
          action: `notification.${n.type}`,
          entityType: 'notification',
          entityId: n.id,
          changes: null,
          ipAddress: null,
          userAgent: 'Mock Demo Session',
          createdAt: n.createdAt,
        }));
        setLogs(synthesized);
        setTotal(synthesized.length);
        return;
      }

      const response = await logsApi.getLogs({ page, limit: pageSize });
      setLogs(response.data);
      setTotal(response.total);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, useMockApi]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const columns = useMemo(() => [
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      render: (row: AuditLogEntry) => (
        <div className="flex items-center gap-2">
          <Badge variant="default" className="capitalize">{row.entityType || 'system'}</Badge>
          <span className="font-medium">{row.action}</span>
        </div>
      ),
    },
    {
      key: 'userName',
      header: 'User',
      sortable: true,
      render: (row: AuditLogEntry) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">{row.userName}</p>
          {row.userEmail ? <p className="text-xs text-gray-500 dark:text-gray-400">{row.userEmail}</p> : null}
        </div>
      ),
    },
    {
      key: 'organizationName',
      header: 'Organization',
      render: (row: AuditLogEntry) => row.organizationName || '-',
    },
    {
      key: 'ipAddress',
      header: 'IP',
      render: (row: AuditLogEntry) => row.ipAddress || '-',
    },
    {
      key: 'createdAt',
      header: 'Time',
      sortable: true,
      render: (row: AuditLogEntry) => (
        <div>
          <p className="text-sm">{new Date(row.createdAt).toLocaleString()}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{formatRelativeTime(row.createdAt)}</p>
        </div>
      ),
    },
  ], []);

  return (
    <div className="p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Activity Logs</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Audit timeline of account and system actions based on your permission scope.
          </p>
        </div>
        <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => void loadLogs()}>
          Refresh
        </Button>
      </motion.div>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Audit Events</p>
        </div>

        <DataTable
          columns={columns}
          data={logs}
          isLoading={isLoading}
          searchable
          searchPlaceholder="Search actions, users, or entities"
          pagination={{
            page,
            pageSize,
            total,
            onPageChange: setPage,
          }}
          emptyMessage="No logs found for your current scope"
        />
      </Card>
    </div>
  );
}
