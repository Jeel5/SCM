// Multi-tenant middleware - ensures data isolation per organization
import { BusinessLogicError } from '../errors/index.js';

/**
 * @deprecated No-op. org context is now injected directly by authenticate().
 * req.orgContext is set for every authenticated request; this middleware no
 * longer needs to appear on any route. Kept only to avoid import errors in
 * any code that hasn't been updated yet.
 */
export function injectOrgContext(req, res, next) {
  // No-op: authenticate() now sets req.orgContext inline.
  next();
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
