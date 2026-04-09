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
  'shipments.create',   // create new shipments
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
  'exceptions.create',   // raise new exceptions
  'exceptions.update',
  'returns.view',
  'returns.create',      // initiate a return
  'returns.update',
  'sla.view',
  'sla.manage',    // create + update + deactivate SLA policies
  'finance.view',
  'analytics.view',
  'logs.view',
  'jobs.view',          // view background jobs and cron schedules
  'jobs.create',        // create / trigger jobs
  'jobs.update',        // cancel / retry jobs
  'jobs.delete',        // delete cron schedules / purge DLQ
  'channels.view',
  'channels.manage',
  'suppliers.view',
  'suppliers.manage',
  'settings.personal',
  'settings.organization',
];

// Superadmin-only permissions — never granted to any org role
export const SUPERADMIN_PERMISSIONS = [
  'companies.manage',
];

// Role → permission mapping (single source of truth)
export const ROLE_PERMISSIONS = {
  // superadmin: wildcard — has ALL org permissions + exclusive superadmin permissions.
  // Represented as '**' to distinguish from admin '*' (which never includes SUPERADMIN_PERMISSIONS).
  superadmin: ['**'],

  admin: ['*'], // expands to ALL_PERMISSIONS only (never SUPERADMIN_PERMISSIONS)

  operations_manager: [
    'dashboard.view',
    'orders.view', 'orders.create', 'orders.update',
    'shipments.view', 'shipments.create', 'shipments.update',
    'inventory.view', 'inventory.update', 'inventory.manage',
    'warehouses.view', 'warehouses.manage',
    'carriers.view', 'carriers.manage',
    'channels.view',
    'suppliers.view',
    'exceptions.view', 'exceptions.create', 'exceptions.update',
    'returns.view', 'returns.create', 'returns.update',
    'sla.view', 'sla.manage',
    'analytics.view',
    'logs.view',
    'jobs.view', 'jobs.create', 'jobs.update', 'jobs.delete',
    'settings.personal',
  ],

  warehouse_manager: [
    'dashboard.view',
    'shipments.view',
    'inventory.view', 'inventory.update',
    'warehouses.view',
    'returns.view', 'returns.create', 'returns.update',
    'exceptions.view', 'exceptions.update',
    'logs.view',
    'settings.personal',
  ],

  carrier_partner: [
    'dashboard.view',
    'shipments.view', 'shipments.update',
    'exceptions.view', 'exceptions.create', 'exceptions.update',
    'returns.view',
    'logs.view',
    'settings.personal',
  ],

  finance: [
    'dashboard.view',
    'finance.view',
    'sla.view',
    'analytics.view',
    'orders.view',
    'returns.view',
    'exceptions.view',
    'logs.view',
    'settings.personal',
  ],

  customer_support: [
    'dashboard.view',
    'orders.view',
    'shipments.view',
    'exceptions.view', 'exceptions.update',
    'returns.view',
    'logs.view',
    'settings.personal',
  ],
};

/**
 * Returns the resolved permission list for a role.
 * superadmin → expands '**' to ALL_PERMISSIONS + SUPERADMIN_PERMISSIONS.
 * admin      → expands '*'  to ALL_PERMISSIONS only.
 */
export function getPermissionsForRole(role) {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return [];
  if (perms.includes('**')) return [...ALL_PERMISSIONS, ...SUPERADMIN_PERMISSIONS];
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
  // '**' = superadmin: has every permission unconditionally
  if (perms.includes('**')) return true;
  // '*' = admin: expands to org-level permissions only (never SUPERADMIN_PERMISSIONS)
  if (perms.includes('*')) return ALL_PERMISSIONS.includes(permission);
  return perms.includes(permission);
}
