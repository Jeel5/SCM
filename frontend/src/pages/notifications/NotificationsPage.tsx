import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  CheckCheck,
  Trash2,
  RefreshCw,
  Package,
  Truck,
  AlertTriangle,
  Clock,
  RotateCcw,
  Info,
  Filter,
} from 'lucide-react';
import { Button, Badge, Card, Tabs } from '@/components/ui';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useNotificationStore } from '@/stores';
import { notificationsApi } from '@/api/services';
import { toast } from '@/stores/toastStore';
import type { Notification, NotificationType } from '@/types';

const typeConfig: Record<NotificationType, { icon: typeof Bell; color: string; bgColor: string }> = {
  order: { icon: Package, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  shipment: { icon: Truck, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  sla: { icon: Clock, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  exception: { icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  return: { icon: RotateCcw, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  system: { icon: Info, color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-900/30' },
};

export function NotificationsPage() {
  const { notifications, unreadCount, setNotifications, markAsRead, markAllAsRead, removeNotification, clearAll } = useNotificationStore();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await notificationsApi.getNotifications({ page: 1, limit: 100 });
      if (resp.success) setNotifications(resp.data);
    } catch {
      // May fail if no notifications table yet
    } finally {
      setIsLoading(false);
    }
  }, [setNotifications]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    markAllAsRead();
    try {
      await notificationsApi.markAllNotificationsRead();
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const handleMarkRead = async (id: string) => {
    markAsRead(id);
    try {
      await notificationsApi.markNotificationRead(id);
    } catch {
      // Silently fail
    }
  };

  const handleDelete = async (id: string) => {
    removeNotification(id);
    try {
      await notificationsApi.deleteNotification(id);
      toast.success('Notification deleted');
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Delete all notifications? This cannot be undone.')) return;
    clearAll();
    try {
      await notificationsApi.deleteAllNotifications();
      toast.success('All notifications cleared');
    } catch {
      toast.error('Failed to clear notifications');
      fetchNotifications();
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !n.isRead;
    return n.type === activeTab;
  });

  const tabs = [
    { id: 'all', label: 'All', count: notifications.length },
    { id: 'unread', label: 'Unread', count: unreadCount },
    { id: 'order', label: 'Orders', count: notifications.filter(n => n.type === 'order').length },
    { id: 'shipment', label: 'Shipments', count: notifications.filter(n => n.type === 'shipment').length },
    { id: 'exception', label: 'Exceptions', count: notifications.filter(n => n.type === 'exception').length },
    { id: 'sla', label: 'SLA', count: notifications.filter(n => n.type === 'sla').length },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'You\'re all caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={fetchNotifications}
          >
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              leftIcon={<CheckCheck className="h-4 w-4" />}
              onClick={handleMarkAllRead}
            >
              Mark All Read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              variant="destructive"
              leftIcon={<Trash2 className="h-4 w-4" />}
              onClick={handleClearAll}
            >
              Clear All
            </Button>
          )}
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: notifications.length, icon: Bell, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
          { label: 'Unread', value: unreadCount, icon: Filter, color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
          { label: 'Exceptions', value: notifications.filter(n => n.type === 'exception').length, icon: AlertTriangle, color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
          { label: 'SLA Alerts', value: notifications.filter(n => n.type === 'sla').length, icon: Clock, color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', stat.color)}>
                <stat.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))
        ) : filteredNotifications.length === 0 ? (
          <Card className="p-12 text-center">
            <Bell className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              {activeTab === 'unread' ? 'No unread notifications' : 'No notifications'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {activeTab === 'unread'
                ? 'You\'re all caught up!'
                : 'Notifications about orders, shipments, SLA violations, and exceptions will appear here.'}
            </p>
          </Card>
        ) : (
          filteredNotifications.map((notification, index) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              index={index}
              onMarkRead={handleMarkRead}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

function NotificationItem({
  notification,
  index,
  onMarkRead,
  onDelete,
}: {
  notification: Notification;
  index: number;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const config = typeConfig[notification.type] || typeConfig.system;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        'flex items-start gap-4 p-4 rounded-xl border transition-colors',
        notification.isRead
          ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
          : 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30'
      )}
    >
      <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', config.bgColor)}>
        <Icon className={cn('h-5 w-5', config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className={cn(
                'text-sm font-medium truncate',
                notification.isRead
                  ? 'text-gray-700 dark:text-gray-300'
                  : 'text-gray-900 dark:text-white'
              )}>
                {notification.title}
              </p>
              {!notification.isRead && (
                <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
              {notification.message}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {formatRelativeTime(notification.createdAt)}
              </span>
              <Badge variant="default" className="text-xs capitalize">
                {notification.type}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!notification.isRead && (
              <button
                onClick={() => onMarkRead(notification.id)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Mark as read"
              >
                <CheckCheck className="h-4 w-4 text-gray-400 hover:text-blue-500" />
              </button>
            )}
            <button
              onClick={() => onDelete(notification.id)}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
