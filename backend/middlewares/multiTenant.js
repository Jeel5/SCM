// Multi-tenant middleware - ensures data isolation per organization
import userRepo from '../repositories/UserRepository.js';
import { BusinessLogicError } from '../errors/index.js';

/**
 * Middleware to inject organization context into requests
 * Ensures all database queries are scoped to the user's organization
 * Superadmin can optionally access all organizations
 */
export async function injectOrgContext(req, res, next) {
  try {
    // Skip for unauthenticated requests
    if (!req.user || !req.user.userId) {
      return next();
    }

    // Superadmin can see all organizations, others are scoped to their org
    if (req.user.role === 'superadmin') {
      req.orgContext = {
        isSuperadmin: true,
        organizationId: null, // Can access all
        canAccessAllOrgs: true
      };
      return next();
    }

    // Get user's organization
    const user = await userRepo.findById(req.user.userId);

    if (!user || !user.organization_id) {
      throw new BusinessLogicError('User must belong to an organization');
    }

    req.orgContext = {
      isSuperadmin: false,
      organizationId: user.organization_id,
      canAccessAllOrgs: false
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware factory to require organization context
 * Use on routes that must have organization scoping
 */
export function requireOrgContext(req, res, next) {
  if (!req.orgContext) {
    throw new BusinessLogicError('Organization context required');
  }

      if (!req.orgContext.isSuperadmin && !req.orgContext.organizationId) {
    throw new BusinessLogicError('User must belong to an organization');
  }

  next();
}

/**
 * Helper to get organization ID for query
 * Returns null for superadmin (access all), organizationId for regular users
 */
export function getOrgFilterValue(req) {
  if (!req.orgContext) {
    throw new BusinessLogicError('Organization context not set');
  }

  if (req.orgContext.isSuperadmin) {
    // Superadmin can optionally filter by org using query param
    return req.query.organization_id || null;
  }

  return req.orgContext.organizationId;
}

/**
 * Helper to build WHERE clause for organization filtering
 * Usage: const orgFilter = buildOrgFilter(req, 'o'); // o.organization_id = $1
 */
export function buildOrgFilter(req, tableAlias = '') {
  const orgId = getOrgFilterValue(req);
  
  if (orgId === null) {
    // Superadmin without filter - no restriction
    return { clause: '', params: [] };
  }

  const column = tableAlias ? `${tableAlias}.organization_id` : 'organization_id';
  return {
    clause: `${column} = $`,
    params: [orgId],
    paramValue: orgId
  };
}
