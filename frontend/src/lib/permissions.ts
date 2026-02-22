/**
 * Frontend mirror of backend/config/permissions.js
 * Single source of truth for which permissions each role has.
 * Must stay in sync with the backend file.
 */
import type { UserRole } from '@/types';

// Org-level permissions — what admin '*' expands to.
// IMPORTANT: superadmin-only permissions are NOT in this list.
export const ALL_PERMISSIONS = [
  'dashboard.view',
  'team.manage',
  'orders.view',
  'orders.create',
  'orders.update',
  'shipments.view',
  'shipments.update',
  'inventory.view',
  'inventory.update',
  'warehouses.view',
  'warehouses.update',
  'carriers.view',
  'exceptions.view',
  'exceptions.update',
  'returns.view',
  'returns.update',
  'sla.view',
  'finance.view',
  'analytics.view',
  'settings.personal',
  'settings.organization',
] as const;

// Superadmin-only permissions — never granted to any org role
export const SUPERADMIN_PERMISSIONS = [
  'companies.manage',
] as const;

export type Permission = typeof ALL_PERMISSIONS[number] | typeof SUPERADMIN_PERMISSIONS[number];

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  superadmin: [
    'dashboard.view',
    'companies.manage',
  ],

  admin: ALL_PERMISSIONS as unknown as string[], // all ORG permissions only — never superadmin ones

  operations_manager: [
    'dashboard.view',
    'orders.view', 'orders.create', 'orders.update',
    'shipments.view', 'shipments.update',
    'inventory.view', 'inventory.update',
    'warehouses.view',
    'carriers.view',
    'exceptions.view', 'exceptions.update',
    'returns.view', 'returns.update',
    'sla.view',
    'analytics.view',
    'settings.personal',
  ],

  warehouse_manager: [
    'dashboard.view',
    'shipments.view',
    'inventory.view', 'inventory.update',
    'warehouses.view',
    'returns.view', 'returns.update',
    'exceptions.view', 'exceptions.update',
    'settings.personal',
  ],

  carrier_partner: [
    'dashboard.view',
    'shipments.view', 'shipments.update',
    'exceptions.view', 'exceptions.update',
    'returns.view',
    'settings.personal',
  ],

  finance: [
    'dashboard.view',
    'finance.view',
    'sla.view',
    'analytics.view',
    'orders.view',
    'returns.view',
    'settings.personal',
  ],

  customer_support: [
    'dashboard.view',
    'orders.view',
    'shipments.view',
    'exceptions.view', 'exceptions.update',
    'returns.view',
    'settings.personal',
  ],
};

export function getPermissionsForRole(role: UserRole): string[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Check whether a user has a given permission, derived purely from their role.
 */
export function checkPermission(
  role: UserRole | undefined,
  permission: Permission
): boolean {
  if (!role) return false;
  const rolePerms = ROLE_PERMISSIONS[role] ?? [];
  return rolePerms.includes(permission as string);
}
