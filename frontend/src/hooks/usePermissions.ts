import { useAuthStore } from '@/stores';
import { checkPermission, type Permission } from '@/lib/permissions';

/**
 * Returns a function to check if the current user has a given permission.
 *
 * @example
 * const can = usePermissions();
 * if (can('orders.create')) { ... }
 */
export function usePermissions() {
  const user = useAuthStore((s) => s.user);

  return (permission: Permission): boolean => {
    if (!user) return false;
    return checkPermission(user.role, permission);
  };
}

/**
 * Convenience hook for a single permission check.
 *
 * @example
 * const canManageTeam = useHasPermission('team.manage');
 */
export function useHasPermission(permission: Permission): boolean {
  const can = usePermissions();
  return can(permission);
}
