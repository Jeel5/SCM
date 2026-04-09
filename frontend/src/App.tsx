import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

import { MainLayout, AuthLayout } from '@/components/layout';
import { ToastProvider } from '@/components/ui/Toast';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { PermissionRoute } from '@/components/ui/PermissionGate';
import { useAuthStore, useUIStore } from '@/stores';
import { SocketProvider } from '@/hooks/useSocket';

// Lazy load all pages for code splitting
const LoginPage = lazy(() => import('@/pages/auth').then(m => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('@/pages/dashboard').then(m => ({ default: m.DashboardPage })));
const SuperAdminDashboard = lazy(() => import('@/pages/super-admin').then(m => ({ default: m.SuperAdminDashboard })));
const CompaniesPage = lazy(() => import('@/pages/super-admin').then(m => ({ default: m.CompaniesPage })));
const SystemUsersPage = lazy(() => import('@/pages/super-admin').then(m => ({ default: m.SystemUsersPage })));
const SystemHealthPage = lazy(() => import('@/pages/super-admin').then(m => ({ default: m.SystemHealthPage })));
const SuperAdminAuditPage = lazy(() => import('@/pages/super-admin').then(m => ({ default: m.SuperAdminAuditPage })));
const OrdersPage = lazy(() => import('@/pages/orders').then(m => ({ default: m.OrdersPage })));
const ShipmentsPage = lazy(() => import('@/pages/shipments').then(m => ({ default: m.ShipmentsPage })));
const InventoryPage = lazy(() => import('@/pages/inventory').then(m => ({ default: m.InventoryPage })));
const ProductsPage = lazy(() => import('@/pages/products').then(m => ({ default: m.ProductsPage })));
const WarehousesPage = lazy(() => import('@/pages/warehouses').then(m => ({ default: m.WarehousesPage })));
const CarriersPage = lazy(() => import('@/pages/carriers').then(m => ({ default: m.CarriersPage })));
const ExceptionsPage = lazy(() => import('@/pages/exceptions').then(m => ({ default: m.ExceptionsPage })));
const ReturnsPage = lazy(() => import('@/pages/returns').then(m => ({ default: m.ReturnsPage })));
const AnalyticsPage = lazy(() => import('@/pages/analytics').then(m => ({ default: m.AnalyticsPage })));
const SLAManagementPage = lazy(() => import('@/pages/sla').then(m => ({ default: m.SLAManagementPage })));
const FinancePage = lazy(() => import('@/pages/finance').then(m => ({ default: m.FinancePage })));
const HelpSupportPage = lazy(() => import('@/pages/help').then(m => ({ default: m.HelpSupportPage })));
const SettingsPage = lazy(() => import('@/pages/settings').then(m => ({ default: m.SettingsPage })));
const TeamPage = lazy(() => import('@/pages/team').then(m => ({ default: m.TeamPage })));
const PartnersPage = lazy(() => import('@/pages/partners').then(m => ({ default: m.PartnersPage })));
const NotificationsPage = lazy(() => import('@/pages/notifications').then(m => ({ default: m.NotificationsPage })));
const LogsPage = lazy(() => import('@/pages/logspage').then(m => ({ default: m.LogsPage })));
const LandingPage = lazy(() => import('@/pages/public').then(m => ({ default: m.LandingPage })));
const AboutPage = lazy(() => import('@/pages/public').then(m => ({ default: m.AboutPage })));
const GetDemoPage = lazy(() => import('@/pages/public').then(m => ({ default: m.GetDemoPage })));
const ContactPage = lazy(() => import('@/pages/public').then(m => ({ default: m.ContactPage })));
const NotFoundPage = lazy(() => import('@/pages/public').then(m => ({ default: m.NotFoundPage })));
// Query client configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Loading spinner component
function LoadingSpinner() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center justify-center min-h-screen bg-gray-50"
    >
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="h-10 w-10 text-blue-600" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-gray-500 font-medium"
        >
          Loading...
        </motion.p>
      </div>
    </motion.div>
  );
}

// Page Loading Wrapper with animation
function PageLoader({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          style={{ width: '100%' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </Suspense>
  );
}

function RouteTitleManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'TwinChain | Supply Chain Visibility',
      '/about': 'About | TwinChain',
      '/contact': 'Contact | TwinChain',
      '/get-demo': 'Get Demo | TwinChain',
      '/login': 'Login | TwinChain',
      '/dashboard': 'Dashboard | TwinChain',
      '/orders': 'Orders | TwinChain',
      '/shipments': 'Shipments | TwinChain',
      '/inventory': 'Inventory | TwinChain',
      '/products': 'Products | TwinChain',
      '/warehouses': 'Warehouses | TwinChain',
      '/carriers': 'Carriers | TwinChain',
      '/exceptions': 'Exceptions | TwinChain',
      '/returns': 'Returns | TwinChain',
      '/analytics': 'Analytics | TwinChain',
      '/sla': 'SLA Management | TwinChain',
      '/finance': 'Finance | TwinChain',
      '/help': 'Help & Support | TwinChain',
      '/settings': 'Settings | TwinChain',
      '/team': 'Team | TwinChain',
      '/partners': 'Partners | TwinChain',
      '/notifications': 'Notifications | TwinChain',
      '/logs': 'Activity Logs | TwinChain',
      '/super-admin/dashboard': 'Super Admin Dashboard | TwinChain',
      '/super-admin/companies': 'Companies | TwinChain',
      '/super-admin/users': 'System Users | TwinChain',
      '/super-admin/health': 'System Health | TwinChain',
      '/super-admin/audit': 'Audit Center | TwinChain',
    };

    document.title = titles[pathname] || 'TwinChain';
  }, [pathname]);

  return null;
}

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Public Route Component (redirect if already authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Main App Component
function App() {
  const { theme } = useUIStore();
  const googleClientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

  // Apply theme class to document root on mount and when theme changes
  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else if (theme === 'system') {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme]);

  const appContent = (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ToastContainer />
        <SocketProvider>
          <BrowserRouter>
            <RouteTitleManager />
            <Routes>
                  <Route
                    path="*"
                    element={
                      <PageLoader>
                        <NotFoundPage />
                      </PageLoader>
                    }
                  />

                  {/* Landing Page */}
                  <Route
                    path="/"
                    element={
                      <PageLoader>
                        <LandingPage />
                      </PageLoader>
                    }
                  />

                  {/* About */}
                  <Route
                    path="/about"
                    element={
                      <PageLoader>
                        <AboutPage />
                      </PageLoader>
                    }
                  />

                  {/* Get Demo */}
                  <Route
                    path="/get-demo"
                    element={
                      <PageLoader>
                        <GetDemoPage />
                      </PageLoader>
                    }
                  />

                  {/* Contact Sales */}
                  <Route
                    path="/contact"
                    element={
                      <PageLoader>
                        <ContactPage />
                      </PageLoader>
                    }
                  />

                  {/* Public Routes */}
                  <Route
                    path="/login"
                    element={
                      <PublicRoute>
                        <AuthLayout>
                          <PageLoader>
                            <LoginPage />
                          </PageLoader>
                        </AuthLayout>
                      </PublicRoute>
                    }
                  />

                  {/* Protected Routes - requires authentication */}
                  <Route
                    element={
                      <ProtectedRoute>
                        <MainLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route
                      path="dashboard"
                      element={
                        <PageLoader>
                          <DashboardPage />
                        </PageLoader>
                      }
                    />
                    <Route
                      path="super-admin/dashboard"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="companies.manage">
                            <SuperAdminDashboard />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                    <Route
                      path="super-admin/companies"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="companies.manage">
                            <CompaniesPage />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                    <Route
                      path="super-admin/users"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="companies.manage">
                            <SystemUsersPage />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                    <Route
                      path="super-admin/health"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="companies.manage">
                            <SystemHealthPage />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                    <Route
                      path="super-admin/audit"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="companies.manage">
                            <SuperAdminAuditPage />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                    <Route
                      path="orders"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="orders.view">
                            <OrdersPage />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                    <Route
                      path="shipments"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="shipments.view">
                            <ShipmentsPage />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                    <Route
                      path="inventory"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="inventory.view">
                            <InventoryPage />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                    <Route
                      path="products"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="inventory.view">
                            <ProductsPage />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                    <Route
                      path="warehouses"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="warehouses.view">
                            <WarehousesPage />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                    <Route
                      path="carriers"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="carriers.view">
                            <CarriersPage />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                    <Route
                      path="exceptions"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="exceptions.view">
                            <ExceptionsPage />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                    <Route
                      path="returns"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="returns.view">
                            <ReturnsPage />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                    <Route
                      path="analytics"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="analytics.view">
                            <AnalyticsPage />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                    <Route
                      path="sla"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="sla.view">
                            <SLAManagementPage />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                    <Route
                      path="finance"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="finance.view">
                            <FinancePage />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                    <Route
                      path="help"
                      element={
                        <PageLoader>
                          <HelpSupportPage />
                        </PageLoader>
                      }
                    />
                    <Route
                      path="settings"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="settings.personal">
                            <SettingsPage />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                    <Route
                      path="team"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="team.manage">
                            <TeamPage />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                    <Route
                      path="partners"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="channels.view">
                            <PartnersPage />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                    <Route
                      path="notifications"
                      element={
                        <PageLoader>
                          <NotificationsPage />
                        </PageLoader>
                      }
                    />
                    <Route
                      path="logs"
                      element={
                        <PageLoader>
                          <PermissionRoute permission="logs.view">
                            <LogsPage />
                          </PermissionRoute>
                        </PageLoader>
                      }
                    />
                  </Route>

                  {/* Catch-all redirect */}
                  <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </SocketProvider>
      </ToastProvider>
    </QueryClientProvider>
  );

  return (
    <ErrorBoundary>
      {googleClientId
        ? <GoogleOAuthProvider clientId={googleClientId}>{appContent}</GoogleOAuthProvider>
        : appContent}
    </ErrorBoundary>
  );
}

export default App;
