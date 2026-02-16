// Role-Based Access Control (RBAC) - enforces permissions based on user roles
import { ForbiddenError } from '../errors/index.js';
import { logAuth } from '../utils/logger.js';

// Define all user roles in the system
export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  OPERATIONS: 'operations',
  WAREHOUSE: 'warehouse',
  CARRIER: 'carrier',
  FINANCE: 'finance'
};

// Permission matrix - defines what each role can access (format: 'module:action')
const PERMISSIONS = {
  [ROLES.SUPERADMIN]: [
    '*:*',             // Full access to everything
    'companies:*',     // Company management
    'admins:*',        // Admin management across companies
    'system:*'         // System-level operations
  ],
  
  [ROLES.ADMIN]: [
    '*:*' // Full access to everything
  ],
  
  [ROLES.OPERATIONS]: [
    'orders:*',        // Full order management
    'shipments:*',     // Full shipment management
    'exceptions:*',    // Exception handling
    'analytics:read',  // View analytics
    'dashboard:read',  // View dashboards
    'jobs:*',          // Job management
    'sla:*'            // SLA management
  ],
  
  [ROLES.WAREHOUSE]: [
    'inventory:*',     // Full inventory management
    'orders:read',     // View orders
    'orders:update',   // Update order status
    'shipments:read',  // View shipments
    'returns:*',       // Full returns management
    'warehouses:*',    // Warehouse operations
    'dashboard:read'   // View dashboards
  ],
  
  [ROLES.CARRIER]: [
    'shipments:read',  // View shipments
    'shipments:update', // Update shipment status/tracking
    'carriers:*',      // Manage carrier info
    'dashboard:read'   // View dashboards
  ],
  
  [ROLES.FINANCE]: [
    'orders:read',     // View orders
    'shipments:read',  // View shipments
    'returns:read',    // View returns
    'analytics:*',     // Full analytics access
    'invoices:*',      // Invoice management
    'costs:*',         // Cost tracking
    'dashboard:read'   // View dashboards
  ]
};

// Check if role has permission for a resource (supports wildcards)
function hasPermission(role, resource) {
  const permissions = PERMISSIONS[role];
  if (!permissions) return false;
  
  // Admin wildcard check
  if (permissions.includes('*:*')) return true;
  
  // Exact match
  if (permissions.includes(resource)) return true;
  
  // Module wildcard check (e.g., 'orders:*' matches 'orders:create')
  // Check if role has permission for a resource (supports wildcards)
  const [module, action] = resource.split(':');
  if (permissions.includes(`${module}:*`)) return true;
  
  return false;
}

// Middleware factory - creates authorization check for specific permission
// Usage: router.post('/orders', authorize('orders:create'), handler)
export function authorize(resource) {
  return (req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
      logAuth('AuthorizationFailed', null, {
        resource,
        reason: 'No user in request',
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      throw new ForbiddenError('Authentication required');
    }
    
    const { id: userId, role } = req.user;
    
    // Check if user has required role
    if (!role) {
      logAuth('AuthorizationFailed', userId, {
        resource,
        reason: 'No role assigned',
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      throw new ForbiddenError('No role assigned to user');
    }
    
    // Check permission
    if (!hasPermission(role, resource)) {
      logAuth('AuthorizationFailed', userId, {
        resource,
        role,
        reason: 'Insufficient permissions',
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      throw new ForbiddenError(`Insufficient permissions. Required: ${resource}`);
    }
    
    // Authorization successful - no verbose logging
    
    next();
  };
}

/**
 * Middleware to require specific roles
 * More restrictive than permission-based authorization
 * 
 * @param {...string} allowedRoles - Roles that are allowed
 * @returns {Function} Express middleware
 * 
 * @example
 * router.delete('/users/:id', requireRoles(ROLES.ADMIN), deleteUser);
 */
export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      logAuth('RoleCheckFailed', null, {
        allowedRoles,
        reason: 'No user in request',
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      throw new ForbiddenError('Authentication required');
    }
    
    const { id: userId, role } = req.user;
    
    if (!role || !allowedRoles.includes(role)) {
      logAuth('RoleCheckFailed', userId, {
        allowedRoles,
        userRole: role,
        reason: 'Role not in allowed list',
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      throw new ForbiddenError(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
    }
    
    // Role check successful - no verbose logging
    
    next();
  };
}

/**
 * Middleware to check if user owns the resource or is admin
 * Useful for endpoints where users can only access their own data
 * 
 * @param {Function} getResourceOwnerId - Function that extracts owner ID from request
 * @returns {Function} Express middleware
 * 
 * @example
 * router.get('/users/:id', 
 *   requireOwnershipOrAdmin(req => req.params.id),
 *   getUser
 * );
 */
export function requireOwnershipOrAdmin(getResourceOwnerId) {
  return (req, res, next) => {
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }
    
    const { id: userId, role } = req.user;
    
    // Admins can access everything
    if (role === ROLES.ADMIN) {
      logAuth('OwnershipCheckSuccess', userId, {
        reason: 'Admin override',
        path: req.path
      });
      return next();
    }
    
    // Check ownership
    const resourceOwnerId = getResourceOwnerId(req);
    if (String(userId) === String(resourceOwnerId)) {
      logAuth('OwnershipCheckSuccess', userId, {
        reason: 'Owner match',
        path: req.path
      });
      return next();
    }
    
    logAuth('OwnershipCheckFailed', userId, {
      resourceOwnerId,
      reason: 'Not owner and not admin',
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    
    throw new ForbiddenError('You can only access your own resources');
  };
}

/**
 * Get all permissions for a role
 * Useful for debugging or displaying user capabilities
 * 
 * @param {string} role - Role to get permissions for
 * @returns {string[]} Array of permissions
 */
export function getRolePermissions(role) {
  return PERMISSIONS[role] || [];
}

/**
 * Check if a user can perform an action
 * Utility function for programmatic permission checks
 * 
 * @param {Object} user - User object with role
 * @param {string} resource - Resource to check
 * @returns {boolean}
 */
export function can(user, resource) {
  if (!user || !user.role) return false;
  return hasPermission(user.role, resource);
}
