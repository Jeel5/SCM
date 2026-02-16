import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

import { MainLayout, AuthLayout } from '@/components/layout';
import { ToastProvider } from '@/components/ui/Toast';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useAuthStore, useUIStore } from '@/stores';

// Lazy load all pages for code splitting
const LoginPage = lazy(() => import('@/pages/auth').then(m => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('@/pages/dashboard').then(m => ({ default: m.DashboardPage })));
const SuperAdminDashboard = lazy(() => import('@/pages/super-admin').then(m => ({ default: m.SuperAdminDashboard })));
const CompaniesPage = lazy(() => import('@/pages/super-admin').then(m => ({ default: m.CompaniesPage })));
const OrdersPage = lazy(() => import('@/pages/orders').then(m => ({ default: m.OrdersPage })));
const ShipmentsPage = lazy(() => import('@/pages/shipments').then(m => ({ default: m.ShipmentsPage })));
const InventoryPage = lazy(() => import('@/pages/inventory').then(m => ({ default: m.InventoryPage })));
const WarehousesPage = lazy(() => import('@/pages/warehouses').then(m => ({ default: m.WarehousesPage })));
const CarriersPage = lazy(() => import('@/pages/carriers').then(m => ({ default: m.CarriersPage })));
const ExceptionsPage = lazy(() => import('@/pages/exceptions').then(m => ({ default: m.ExceptionsPage })));
const ReturnsPage = lazy(() => import('@/pages/returns').then(m => ({ default: m.ReturnsPage })));
const AnalyticsPage = lazy(() => import('@/pages/analytics').then(m => ({ default: m.AnalyticsPage })));
const SLAManagementPage = lazy(() => import('@/pages/sla').then(m => ({ default: m.SLAManagementPage })));
const FinancePage = lazy(() => import('@/pages/finance').then(m => ({ default: m.FinancePage })));
const HelpSupportPage = lazy(() => import('@/pages/help').then(m => ({ default: m.HelpSupportPage })));
const SettingsPage = lazy(() => import('@/pages/settings').then(m => ({ default: m.SettingsPage })));

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
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </Suspense>
  );
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
  
  return (
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <ToastContainer />
            <BrowserRouter>
              <Routes>
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

              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >                <Route index element={<Navigate to="/dashboard" replace />} />
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
                      <SuperAdminDashboard />
                    </PageLoader>
                  }
                />
                <Route
                  path="super-admin/companies"
                  element={
                    <PageLoader>
                      <CompaniesPage />
                    </PageLoader>
                  }
                />
                <Route
                  path="orders"
                  element={
                    <PageLoader>
                      <OrdersPage />
                    </PageLoader>
                  }
                />
                <Route
                  path="shipments"
                  element={
                    <PageLoader>
                      <ShipmentsPage />
                    </PageLoader>
                  }
                />
                <Route
                  path="inventory"
                  element={
                    <PageLoader>
                      <InventoryPage />
                    </PageLoader>
                  }
                />
                <Route
                  path="warehouses"
                  element={
                    <PageLoader>
                      <WarehousesPage />
                    </PageLoader>
                  }
                />
                <Route
                  path="carriers"
                  element={
                    <PageLoader>
                      <CarriersPage />
                    </PageLoader>
                  }
                />
                <Route
                  path="exceptions"
                  element={
                    <PageLoader>
                      <ExceptionsPage />
                    </PageLoader>
                  }
                />
                <Route
                  path="returns"
                  element={
                    <PageLoader>
                      <ReturnsPage />
                    </PageLoader>
                  }
                />
                <Route
                  path="analytics"
                  element={
                    <PageLoader>
                      <AnalyticsPage />
                    </PageLoader>
                  }
                />
                <Route
                  path="sla"
                  element={
                    <PageLoader>
                      <SLAManagementPage />
                    </PageLoader>
                  }
                />
                <Route
                  path="finance"
                  element={
                    <PageLoader>
                      <FinancePage />
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
                      <SettingsPage />
                    </PageLoader>
                  }
                />
              </Route>

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
    </ErrorBoundary>
  );
}

export default App;
