import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import type { Permission } from '@/lib/permissions';

interface PermissionGateProps {
  permission: Permission;
  /** Rendered when user has the permission */
  children: React.ReactNode;
  /** Rendered when user lacks permission (default: nothing) */
  fallback?: React.ReactNode;
}

/**
 * Conditionally renders children based on permission.
 *
 * @example
 * <PermissionGate permission="orders.create">
 *   <CreateOrderButton />
 * </PermissionGate>
 */
export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const can = usePermissions();
  return can(permission) ? <>{children}</> : <>{fallback}</>;
}

interface PermissionRouteProps {
  permission: Permission;
  children: React.ReactNode;
  /** Where to redirect if no permission. Default: /dashboard */
  redirectTo?: string;
}

/**
 * Route-level permission guard — redirects if user lacks permission.
 *
 * @example
 * <Route path="finance" element={
 *   <PermissionRoute permission="finance.view">
 *     <FinancePage />
 *   </PermissionRoute>
 * } />
 */
export function PermissionRoute({ permission, children, redirectTo = '/dashboard' }: PermissionRouteProps) {
  const can = usePermissions();
  if (!can(permission)) {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
}
