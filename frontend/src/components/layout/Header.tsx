import { useState, useEffect, useCallback } from 'react';
import { useSocketEvent } from '@/hooks/useSocket';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Menu,
  Sun,
  Moon,
  ChevronDown,
  LogOut,
  HelpCircle,
  ShieldAlert,
  UserX,
  Settings,
} from 'lucide-react';
import { cn, formatRelativeTime, getRoleDisplayName } from '@/lib/utils';
import { useUIStore, useAuthStore, useNotificationStore } from '@/stores';
import { Avatar, Button, Dropdown } from '@/components/ui';
import { notificationsApi, authApi, superAdminApi } from '@/api/services';

export function Header() {
  const { toggleMobileSidebar, theme, setTheme } = useUIStore();
  const { user, logout, isAuthenticated, setUser } = useAuthStore();
  const { notifications, unreadCount, markAsRead, markAllAsRead, setNotifications } = useNotificationStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeBanner, setActiveBanner] = useState<{
    id: string;
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
  } | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [stoppingImpersonation, setStoppingImpersonation] = useState(false);
  const navigate = useNavigate();

  // Load notifications from API on mount and periodically
  const fetchNotifications = useCallback(async () => {
    try {
      const resp = await notificationsApi.getNotifications({ page: 1, limit: 20 });
      if (resp.success) setNotifications(resp.data);
    } catch {
      // Silently ignore — user may not be fully authenticated yet
    }
  }, [setNotifications]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifications();
  }, [fetchNotifications, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let mounted = true;
    (async () => {
      try {
        const response = await superAdminApi.getActiveIncidentBanner();
        if (mounted) {
          setActiveBanner((response.data || null) as typeof activeBanner);
          setBannerDismissed(false);
        }
      } catch {
        if (mounted) setActiveBanner(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  // Refresh notification list whenever a new one arrives via socket
  useSocketEvent('notification:new', fetchNotifications);

  const handleLogout = async () => {
    try {
      await authApi.logout(); // clears httpOnly cookies on the server
    } catch { /* best-effort */ }
    logout();
    navigate('/login');
  };

  const handleStopImpersonation = async () => {
    try {
      setStoppingImpersonation(true);
      const response = await superAdminApi.stopImpersonation();
      if (response.data?.user) {
        setUser(response.data.user);
        navigate('/super-admin/dashboard');
      }
    } catch {
      // handled by interceptor
    } finally {
      setStoppingImpersonation(false);
    }
  };

  const userMenuItems = [
    { label: 'Help & Support', value: 'help', icon: <HelpCircle className="h-4 w-4" /> },
    { label: 'Settings', value: 'settings', icon: <Settings className="h-4 w-4" /> },
    { label: 'Sign Out', value: 'logout', icon: <LogOut className="h-4 w-4" />, danger: true },
  ];

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-30 transition-colors duration-300">
      {activeBanner && !bannerDismissed && (
        <div className={cn(
          'px-4 lg:px-6 py-2 text-sm border-b flex items-start md:items-center justify-between gap-3',
          activeBanner.severity === 'critical' && 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800/60',
          activeBanner.severity === 'warning' && 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800/60',
          activeBanner.severity === 'info' && 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-800/60'
        )}>
          <div className="flex items-start md:items-center gap-2 min-w-0">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 md:mt-0" />
            <p className="truncate"><span className="font-semibold">{activeBanner.title}:</span> {activeBanner.message}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setBannerDismissed(true)}>Dismiss</Button>
        </div>
      )}
      {user?.impersonation?.isImpersonating && (
        <div className="px-4 lg:px-6 py-2 bg-purple-50 border-b border-purple-200 dark:bg-purple-900/20 dark:border-purple-800/60 flex items-center justify-between gap-3">
          <p className="text-sm text-purple-800 dark:text-purple-200">
            Impersonating session as <span className="font-semibold">{user.name}</span>.
          </p>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<UserX className="h-4 w-4" />}
            isLoading={stoppingImpersonation}
            onClick={() => void handleStopImpersonation()}
          >
            Exit Impersonation
          </Button>
        </div>
      )}
      <div className="h-16 px-4 lg:px-6 flex items-center justify-between">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleMobileSidebar}
          className="lg:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <Menu className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </motion.button>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            const newTheme = theme === 'light' ? 'dark' : 'light';
            setTheme(newTheme);
            // Also apply immediately
            if (newTheme === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          }}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {theme === 'light' ? (
            <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          ) : (
            <Sun className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          )}
        </motion.button>

        {/* Notifications */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Bell className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </motion.button>

          {/* Notifications Dropdown */}
          <AnimatePresence>
            {showNotifications && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowNotifications(false)}
                  className="fixed inset-0 z-40"
                />
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl z-50 overflow-hidden transition-colors duration-300"
                >
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => {
                          markAllAsRead();
                          notificationsApi.markAllNotificationsRead().catch(() => {});
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto scrollbar-thin">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">No notifications</p>
                      </div>
                    ) : (
                      notifications.slice(0, 5).map((notification) => (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          onClick={() => {
                            markAsRead(notification.id);
                            notificationsApi.markNotificationRead(notification.id).catch(() => {});
                            if (notification.actionUrl) navigate(notification.actionUrl);
                            setShowNotifications(false);
                          }}
                          className={cn(
                            'p-4 border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors',
                            !notification.isRead && 'bg-blue-50/50 dark:bg-blue-900/20'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                'h-2 w-2 mt-2 rounded-full shrink-0',
                                notification.isRead ? 'bg-gray-300 dark:bg-gray-600' : 'bg-blue-500'
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                {formatRelativeTime(notification.createdAt)}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                  {notifications.length > 5 && (
                    <Link
                      to="/notifications"
                      onClick={() => setShowNotifications(false)}
                      className="block p-3 text-center text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700"
                    >
                      View all notifications
                    </Link>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* User Menu */}
        <Dropdown
          trigger={
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-3 p-1.5 pr-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
            >
              <Avatar
                src={user?.avatar}
                name={user?.name}
                size="sm"
                status="online"
              />
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user?.role ? getRoleDisplayName(user.role) : ''}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500 hidden md:block" />
            </motion.div>
          }
          items={userMenuItems}
          onSelect={(value) => {
            if (value === 'logout') {
              handleLogout();
            } else if (value === 'help') {
              navigate('/help');
            } else if (value === 'settings') {
              navigate('/settings');
            }
          }}
          align="right"
        />
      </div>
      </div>
    </header>
  );
}
