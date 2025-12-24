import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Search,
  Menu,
  Sun,
  Moon,
  ChevronDown,
  User,
  Settings,
  LogOut,
  HelpCircle,
} from 'lucide-react';
import { cn, formatRelativeTime, getRoleDisplayName } from '@/lib/utils';
import { useUIStore, useAuthStore, useNotificationStore } from '@/stores';
import { Avatar, Dropdown } from '@/components/ui';

export function Header() {
  const { toggleMobileSidebar, theme, setTheme } = useUIStore();
  const { user, logout } = useAuthStore();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const userMenuItems = [
    { label: 'Profile', value: 'profile', icon: <User className="h-4 w-4" /> },
    { label: 'Settings', value: 'settings', icon: <Settings className="h-4 w-4" /> },
    { label: 'Help & Support', value: 'help', icon: <HelpCircle className="h-4 w-4" /> },
    { label: 'Sign Out', value: 'logout', icon: <LogOut className="h-4 w-4" />, danger: true },
  ];

  return (
    <header className="h-16 bg-white border-b border-gray-100 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleMobileSidebar}
          className="lg:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <Menu className="h-5 w-5 text-gray-600" />
        </motion.button>

        {/* Search */}
        <div className="hidden md:flex items-center">
          <motion.div
            initial={false}
            animate={{ width: showSearch ? 300 : 200 }}
            className="relative"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders, shipments..."
              onFocus={() => setShowSearch(true)}
              onBlur={() => setShowSearch(false)}
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-200 bg-gray-50 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
            />
          </motion.div>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Mobile Search Toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <Search className="h-5 w-5 text-gray-600" />
        </motion.button>

        {/* Theme Toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          {theme === 'light' ? (
            <Moon className="h-5 w-5 text-gray-600" />
          ) : (
            <Sun className="h-5 w-5 text-gray-600" />
          )}
        </motion.button>

        {/* Notifications */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <Bell className="h-5 w-5 text-gray-600" />
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
                  className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllAsRead()}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No notifications</p>
                      </div>
                    ) : (
                      notifications.slice(0, 5).map((notification) => (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          onClick={() => {
                            markAsRead(notification.id);
                            setShowNotifications(false);
                          }}
                          className={cn(
                            'p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors',
                            !notification.isRead && 'bg-blue-50/50'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                'h-2 w-2 mt-2 rounded-full shrink-0',
                                notification.isRead ? 'bg-gray-300' : 'bg-blue-500'
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-600 line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
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
                      className="block p-3 text-center text-sm text-blue-600 hover:bg-gray-50 border-t border-gray-100"
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
              className="flex items-center gap-3 p-1.5 pr-3 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors"
            >
              <Avatar
                src={user?.avatar}
                name={user?.name}
                size="sm"
                status="online"
              />
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">
                  {user?.role ? getRoleDisplayName(user.role) : ''}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400 hidden md:block" />
            </motion.div>
          }
          items={userMenuItems}
          onSelect={(value) => {
            if (value === 'logout') handleLogout();
            // Handle other menu items
          }}
          align="right"
        />
      </div>
    </header>
  );
}
