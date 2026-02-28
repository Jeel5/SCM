// Role-Based Access Control (RBAC) — enforces permissions based on user roles.
// The permission model (role → permission list) lives in config/permissions.js.
// This file owns only the Express middleware layer.
import { ForbiddenError } from '../errors/index.js';
import { logAuth } from '../utils/logger.js';
import { userHasPermission, getPermissionsForRole } from '../config/permissions.js';

// Role name constants — values must match what's stored in the users table / JWT tokens.
// Permission lists for each role are in config/permissions.js (single source of truth).
export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  OPERATIONS: 'operations_manager',
  WAREHOUSE: 'warehouse_manager',
  CARRIER: 'carrier_partner',
  FINANCE: 'finance',
  CUSTOMER_SUPPORT: 'customer_support',
};

/**
 * Normalises a permission string to the canonical dot-notation used by
 * config/permissions.js.  This lets existing routes that were written with the
 * older colon-notation ("orders:read") keep working without a mass rename.
 *
 * Mapping rules applied in order:
 *   'superadmin' literal      → 'companies.manage'  (legacy role-only guard)
 *   colon separator           → dot  (orders:create  → orders.create)
 *   trailing .read            → .view  ('read' was renamed to 'view')
 *   inventory.create          → inventory.manage  (create-entry scope)
 */
function normalizePermission(resource) {
  if (resource === 'superadmin') return 'companies.manage';
  const dotted = resource.replace(':', '.').replace(/\.read$/, '.view');
  if (dotted === 'inventory.create') return 'inventory.manage';
  return dotted;
}

/**
 * Permission-based authorization middleware.
 * Accepts both old colon-notation and new dot-notation — both delegate to
 * config/permissions.js so there is only ONE permission model at runtime.
 *
 * Usage (new style):  router.get('/orders', authenticate, authorize('orders.view'), handler)
 * Usage (old style):  router.get('/orders', authenticate, authorize('orders:read'), handler)
 */
export function authorize(resource) {
  const permission = normalizePermission(resource);
  return (req, res, next) => {
    if (!req.user) {
      logAuth('AuthorizationFailed', null, {
        permission,
        reason: 'No user in request',
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      throw new ForbiddenError('Authentication required');
    }
    if (!userHasPermission(req.user, permission)) {
      logAuth('AuthorizationFailed', req.user.userId, {
        permission,
        role: req.user.role,
        reason: 'Insufficient permissions',
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      throw new ForbiddenError(`Insufficient permissions. Required: ${permission}`);
    }
    next();
  };
}

/**
 * Alias kept for readability on new routes.
 * requirePermission('orders.view') reads more clearly than authorize('orders.view').
 * Both call the same normalizePermission → userHasPermission path.
 */
export function requirePermission(permission) {
  return authorize(permission);
}

// Re-export config helpers used by controllers / other middleware
export { userHasPermission, getPermissionsForRole };

/**
 * Role-level guard (more blunt than permission-level).
 * Use only when no suitable permission exists, e.g., admin-only management UIs.
 *
 * @example
 * router.delete('/users/:id', authenticate, requireRoles(ROLES.ADMIN), deleteUser);
 */
export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      logAuth('RoleCheckFailed', null, {
        allowedRoles,
        reason: 'No user in request',
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      throw new ForbiddenError('Authentication required');
    }
    const { userId, role } = req.user;
    if (!role || !allowedRoles.includes(role)) {
      logAuth('RoleCheckFailed', userId, {
        allowedRoles,
        userRole: role,
        reason: 'Role not in allowed list',
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      throw new ForbiddenError(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
    }
    next();
  };
}

/**
 * Allows access if the caller owns the resource OR has the admin role.
 * Useful for "users can only touch their own data" endpoints.
 *
 * @param {Function} getResourceOwnerId - Extracts the owner's ID from the request.
 * @example
 * router.get('/users/:id', authenticate, requireOwnershipOrAdmin(req => req.params.id), getUser);
 */
export function requireOwnershipOrAdmin(getResourceOwnerId) {
  return (req, res, next) => {
    if (!req.user) throw new ForbiddenError('Authentication required');
    const { userId, role } = req.user;
    if (role === ROLES.ADMIN || role === ROLES.SUPERADMIN) {
      logAuth('OwnershipCheckSuccess', userId, { reason: 'Admin override', path: req.path });
      return next();
    }
    const resourceOwnerId = getResourceOwnerId(req);
    if (String(userId) === String(resourceOwnerId)) {
      logAuth('OwnershipCheckSuccess', userId, { reason: 'Owner match', path: req.path });
      return next();
    }
    logAuth('OwnershipCheckFailed', userId, {
      resourceOwnerId,
      reason: 'Not owner and not admin',
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    throw new ForbiddenError('You can only access your own resources');
  };
}

/**
 * Programmatic (non-middleware) permission check.
 * Normalises legacy colon-notation so callers can use either format.
 *
 * @example
 * if (can(req.user, 'orders.view')) { ... }
 */
export function can(user, resource) {
  if (!user || !user.role) return false;
  return userHasPermission(user, normalizePermission(resource));
}
