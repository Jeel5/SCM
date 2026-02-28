// Role constants — single source of truth for user role names.
// Import these anywhere role validation is needed instead of defining
// the list inline in each controller or service.

/**
 * Roles that an org admin is permitted to assign to other users.
 * Superadmin is intentionally excluded — it can only be set by the platform team.
 */
export const ORG_ASSIGNABLE_ROLES = [
  'operations_manager',
  'warehouse_manager',
  'carrier_partner',
  'finance',
  'customer_support',
];

/**
 * All valid user roles in the system.
 */
export const ALL_ROLES = [
  'superadmin',
  'admin',
  ...ORG_ASSIGNABLE_ROLES,
];
