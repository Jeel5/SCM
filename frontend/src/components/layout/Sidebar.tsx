import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
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
  Building2,
  Timer,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore, useAuthStore } from '@/stores';
import { exceptionsApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
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

const getNavigation = (exceptionCount: number): NavItem[] => [
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
    badge: exceptionCount,
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
  const { sidebarMobileOpen, setMobileSidebarOpen } = useUIStore();
  const user = useAuthStore((state) => state.user);
  const [openExceptionsCount, setOpenExceptionsCount] = useState(0);

  // Fetch open exceptions count
  useEffect(() => {
    const fetchExceptionsCount = async () => {
      const useMockApi = localStorage.getItem('useMockApi') === 'true';
      try {
        const response = useMockApi
          ? await mockApi.getExceptions(1, 100)
          : await exceptionsApi.getExceptions(1, 100);
        // Count only open and in_progress exceptions
        const openCount = response.data.filter(
          (e) => e.status === 'investigating' || e.status === 'pending_resolution'
        ).length;
        setOpenExceptionsCount(openCount);
      } catch (error) {
        console.error('Failed to fetch exceptions count:', error);
      }
    };

    fetchExceptionsCount();
    // Refresh count every 30 seconds
    const interval = setInterval(fetchExceptionsCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const navigation = getNavigation(openExceptionsCount);
  
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
      <aside
        className={cn(
          'group fixed top-0 left-0 h-screen bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 z-50 flex flex-col',
          'w-[52px] hover:w-[225px]',
          'transition-all duration-300 ease-out-quint',
          'lg:relative lg:translate-x-0',
          sidebarMobileOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full lg:translate-x-0',
          'overflow-hidden'
        )}
      >
        {/* Logo */}
        <Link
          to="/dashboard"
          className="h-16 flex items-center gap-3 px-2 border-b border-gray-100 dark:border-gray-700 shrink-0"
        >
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 overflow-hidden">
            <h1
              className={cn(
                'font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap transition-opacity duration-300',
                sidebarMobileOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
            >
              LogiTower
            </h1>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 scrollbar-hide">
          <ul className="flex flex-col gap-0.5">
            {filteredNav.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <li key={item.id} className="min-w-[36px]">
                  <Link
                    to={item.path}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-2 px-2 py-2 rounded-lg transition-all duration-200',
                      'hover:bg-gray-100 dark:hover:bg-gray-700',
                      isActive && 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                      'h-9 w-full'
                    )}
                  >
                    <span
                      className={cn(
                        'shrink-0 flex items-center justify-center',
                        isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                      )}
                    >
                      {item.icon}
                    </span>
                    <div className="flex items-center justify-between flex-1 min-w-0 overflow-hidden">
                      <span
                        className={cn(
                          'font-medium text-sm whitespace-nowrap transition-opacity duration-300',
                          sidebarMobileOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                          isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                        )}
                      >
                        {item.label}
                      </span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={cn(
                            'ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full transition-opacity duration-300',
                            sidebarMobileOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
