/**
 * Code-defined RBAC permission model.
 * No DB tables needed — roles are fixed, permissions are version-controlled here.
 *
 * Permission string format:  <module>.<action>
 * Special value:             '*'  means all permissions (admin)
 */

// Every org-level permission (what admin '*' expands to).
// IMPORTANT: superadmin-only permissions are NOT included here.
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
  'warehouses.manage',   // create + delete warehouses
  'carriers.view',
  'carriers.manage',     // create + update + delete carriers
  'inventory.manage',    // create warehouse inventory entries
  'exceptions.view',
  'exceptions.update',
  'returns.view',
  'returns.update',
  'sla.view',
  'finance.view',
  'analytics.view',
  'settings.personal',
  'settings.organization',
];

// Superadmin-only permissions — never granted to any org role
export const SUPERADMIN_PERMISSIONS = [
  'companies.manage',
];

// Role → permission mapping (single source of truth)
export const ROLE_PERMISSIONS = {
  superadmin: [
    'dashboard.view',
    'companies.manage',
  ],

  admin: ['*'], // expands to ALL_PERMISSIONS only (never SUPERADMIN_PERMISSIONS)

  operations_manager: [
    'dashboard.view',
    'orders.view', 'orders.create', 'orders.update',
    'shipments.view', 'shipments.update',
    'inventory.view', 'inventory.update', 'inventory.manage',
    'warehouses.view', 'warehouses.manage',
    'carriers.view', 'carriers.manage',
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

/**
 * Returns the resolved permission list for a role.
 * admin → expands '*' to ALL_PERMISSIONS.
 */
export function getPermissionsForRole(role) {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return [];
  if (perms.includes('*')) return ALL_PERMISSIONS;
  return perms;
}

/**
 * Check if a user object has a specific permission.
 * Checks role-based permissions (always authoritative).
 */
export function userHasPermission(user, permission) {
  if (!user || !user.role) return false;
  const perms = ROLE_PERMISSIONS[user.role];
  if (!perms) return false;
  // '*' only expands to org-level ALL_PERMISSIONS, never SUPERADMIN_PERMISSIONS
  if (perms.includes('*')) return ALL_PERMISSIONS.includes(permission);
  return perms.includes(permission);
}
