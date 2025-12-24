import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Package,
  Warehouse,
  AlertTriangle,
  RotateCcw,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  Timer,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore, useAuthStore } from '@/stores';
import type { UserRole } from '@/types';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
  roles?: UserRole[];
  children?: NavItem[];
}

const navigation: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    path: '/dashboard',
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: <ShoppingCart className="h-5 w-5" />,
    path: '/orders',
    roles: ['admin', 'operations_manager', 'warehouse_manager', 'customer_support'],
  },
  {
    id: 'shipments',
    label: 'Shipments',
    icon: <Truck className="h-5 w-5" />,
    path: '/shipments',
    roles: ['admin', 'operations_manager', 'warehouse_manager', 'carrier_partner'],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: <Package className="h-5 w-5" />,
    path: '/inventory',
    roles: ['admin', 'operations_manager', 'warehouse_manager'],
  },
  {
    id: 'warehouses',
    label: 'Warehouses',
    icon: <Warehouse className="h-5 w-5" />,
    path: '/warehouses',
    roles: ['admin', 'operations_manager', 'warehouse_manager'],
  },
  {
    id: 'carriers',
    label: 'Carriers',
    icon: <Building2 className="h-5 w-5" />,
    path: '/carriers',
    roles: ['admin', 'operations_manager', 'carrier_partner'],
  },
  {
    id: 'sla',
    label: 'SLA Management',
    icon: <Timer className="h-5 w-5" />,
    path: '/sla',
    roles: ['admin', 'operations_manager'],
  },
  {
    id: 'exceptions',
    label: 'Exceptions',
    icon: <AlertTriangle className="h-5 w-5" />,
    path: '/exceptions',
    badge: 5,
    roles: ['admin', 'operations_manager', 'customer_support'],
  },
  {
    id: 'returns',
    label: 'Returns',
    icon: <RotateCcw className="h-5 w-5" />,
    path: '/returns',
    roles: ['admin', 'operations_manager', 'warehouse_manager', 'customer_support'],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart3 className="h-5 w-5" />,
    path: '/analytics',
    roles: ['admin', 'operations_manager', 'finance'],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: <DollarSign className="h-5 w-5" />,
    path: '/finance',
    roles: ['admin', 'finance'],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings className="h-5 w-5" />,
    path: '/settings',
    roles: ['admin'],
  },
];

export function Sidebar() {
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar, sidebarMobileOpen, setMobileSidebarOpen } = useUIStore();
  const user = useAuthStore((state) => state.user);
  
  const filteredNav = navigation.filter((item) => {
    if (!item.roles) return true;
    if (!user) return false;
    return item.roles.includes(user.role);
  });

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {sidebarMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 80 : 280 }}
        className={cn(
          'fixed top-0 left-0 h-screen bg-white border-r border-gray-100 z-50 flex flex-col',
          'lg:relative lg:translate-x-0',
          sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
          <AnimatePresence mode="wait">
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                  <Truck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-gray-900">LogiTower</h1>
                  <p className="text-xs text-gray-500">Control Center</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {sidebarCollapsed && (
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mx-auto">
              <Truck className="h-6 w-6 text-white" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {filteredNav.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <li key={item.id}>
                  <Link
                    to={item.path}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                      'hover:bg-gray-100',
                      isActive && 'bg-blue-50 text-blue-600'
                    )}
                  >
                    <span
                      className={cn(
                        'shrink-0',
                        isActive ? 'text-blue-600' : 'text-gray-500'
                      )}
                    >
                      {item.icon}
                    </span>
                    <AnimatePresence mode="wait">
                      {!sidebarCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          className={cn(
                            'font-medium text-sm truncate',
                            isActive ? 'text-blue-600' : 'text-gray-700'
                          )}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {!sidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-auto px-2 py-0.5 text-xs font-medium bg-red-100 text-red-600 rounded-full"
                      >
                        {item.badge}
                      </motion.span>
                    )}
                    {sidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Collapse Toggle */}
        <div className="p-3 border-t border-gray-100 hidden lg:block">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5" />
                <span className="text-sm font-medium">Collapse</span>
              </>
            )}
          </motion.button>
        </div>
      </motion.aside>
    </>
  );
}
