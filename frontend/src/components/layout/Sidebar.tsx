import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useSocketEvent } from '@/hooks/useSocket';
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Package,
  Package2,
  Warehouse,
  AlertTriangle,
  RotateCcw,
  BarChart3,
  Settings,
  Building2,
  Timer,
  DollarSign,
  Users,
  Activity,
  Handshake,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore, useAuthStore } from '@/stores';
import { usePermissions } from '@/hooks/usePermissions';
import { exceptionsApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import type { Permission } from '@/lib/permissions';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
  /** Required permission to see this item. Omit = visible to all authenticated users. */
  permission?: Permission;
  children?: NavItem[];
}

const getNavigation = (exceptionCount: number): NavItem[] => [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    path: '/dashboard',
    permission: 'dashboard.view',
  },
  // Superadmin-only items
  {
    id: 'companies',
    label: 'Companies',
    icon: <Building2 className="h-5 w-5" />,
    path: '/super-admin/companies',
    permission: 'companies.manage',
  },
  {
    id: 'system-users',
    label: 'System Users',
    icon: <Users className="h-5 w-5" />,
    path: '/super-admin/users',
    permission: 'companies.manage',
  },
  {
    id: 'system-health',
    label: 'System Health',
    icon: <Activity className="h-5 w-5" />,
    path: '/super-admin/health',
    permission: 'companies.manage',
  },
  // Org-level items
  {
    id: 'orders',
    label: 'Orders',
    icon: <ShoppingCart className="h-5 w-5" />,
    path: '/orders',
    permission: 'orders.view',
  },
  {
    id: 'shipments',
    label: 'Shipments',
    icon: <Truck className="h-5 w-5" />,
    path: '/shipments',
    permission: 'shipments.view',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: <Package className="h-5 w-5" />,
    path: '/inventory',
    permission: 'inventory.view',
  },
  {
    id: 'products',
    label: 'Products',
    icon: <Package2 className="h-5 w-5" />,
    path: '/products',
    permission: 'inventory.view',
  },
  {
    id: 'warehouses',
    label: 'Warehouses',
    icon: <Warehouse className="h-5 w-5" />,
    path: '/warehouses',
    permission: 'warehouses.view',
  },
  {
    id: 'carriers',
    label: 'Carriers',
    icon: <Building2 className="h-5 w-5" />,
    path: '/carriers',
    permission: 'carriers.view',
  },
  {
    id: 'partners',
    label: 'Partners',
    icon: <Handshake className="h-5 w-5" />,
    path: '/partners',
    permission: 'channels.view',
  },
  {
    id: 'sla',
    label: 'SLA Management',
    icon: <Timer className="h-5 w-5" />,
    path: '/sla',
    permission: 'sla.view',
  },
  {
    id: 'exceptions',
    label: 'Exceptions',
    icon: <AlertTriangle className="h-5 w-5" />,
    path: '/exceptions',
    badge: exceptionCount,
    permission: 'exceptions.view',
  },
  {
    id: 'returns',
    label: 'Returns',
    icon: <RotateCcw className="h-5 w-5" />,
    path: '/returns',
    permission: 'returns.view',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart3 className="h-5 w-5" />,
    path: '/analytics',
    permission: 'analytics.view',
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: <DollarSign className="h-5 w-5" />,
    path: '/finance',
    permission: 'finance.view',
  },
  {
    id: 'team',
    label: 'Team',
    icon: <Users className="h-5 w-5" />,
    path: '/team',
    permission: 'team.manage',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings className="h-5 w-5" />,
    path: '/settings',
    permission: 'settings.personal',
  },
];

export function Sidebar() {
  const location = useLocation();
  const { sidebarMobileOpen, setMobileSidebarOpen } = useUIStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [openExceptionsCount, setOpenExceptionsCount] = useState(0);
  const can = usePermissions();

  // Fetch open exceptions count — only when authenticated to avoid spurious 401s
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchExceptionsCount = async () => {
      const useMockApi = localStorage.getItem('useMockApi') === 'true';
      try {
        const response = useMockApi
          ? await mockApi.getExceptions(1, 100)
          : await exceptionsApi.getExceptions(1, 100);
        const openCount = response.data.filter(
          (e) => e.status === 'investigating' || e.status === 'pending_resolution'
        ).length;
        setOpenExceptionsCount(openCount);
      } catch (error) {
        // Silently ignore — badge is non-critical
      }
    };

    fetchExceptionsCount();
    return; // no interval — socket events drive incremental updates
  }, [isAuthenticated]);

  // Real-time exception count updates via socket
  useSocketEvent('exception:created', () => setOpenExceptionsCount((c) => c + 1));
  useSocketEvent('exception:resolved', () => setOpenExceptionsCount((c) => Math.max(0, c - 1)));

  const navigation = getNavigation(openExceptionsCount);

  // Show item only if user has the required permission (or no permission required)
  const filteredNav = navigation.filter((item) => {
    if (!item.permission) return true;
    return can(item.permission);
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
              TwinChain
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
