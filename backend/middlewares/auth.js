import { verifyAccessToken } from '../utils/jwt.js';
import userRepo from '../repositories/UserRepository.js';
import logger from '../utils/logger.js';

// Middleware to verify JWT token and attach user info to request
// Reads from httpOnly cookie first, falls back to Authorization header
export async function authenticate(req, res, next) {
  try {
    // 1. Prefer httpOnly cookie (set by login/refresh endpoints)
    // 2. Fall back to Authorization header (useful for Postman / server-to-server calls)
    let token = req.cookies?.accessToken || null;
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = verifyAccessToken(token);
    
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    // Check token blocklist (revoked sessions / password changes)
    if (decoded.jti) {
      const revoked = await userRepo.isTokenRevoked(decoded.jti);
      if (revoked) {
        return res.status(401).json({ success: false, message: 'Token has been revoked' });
      }
    }
    
    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      email: decoded.email,
      organizationId: decoded.organizationId,
      impersonation: decoded.impersonation || null,
      jti: decoded.jti || null,
      exp: decoded.exp || null
    };

    // Inject org context inline — role and organizationId are already in the JWT,
    // so there is no need for a separate injectOrgContext middleware on every route.
    if (req.user.role === 'superadmin') {
      req.orgContext = { isSuperadmin: true, organizationId: null, canAccessAllOrgs: true };
    } else {
      req.orgContext = req.user.organizationId
        ? { isSuperadmin: false, organizationId: req.user.organizationId, canAccessAllOrgs: false }
        : null;
    }
    
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(401).json({ success: false, message: 'Authentication failed' });
  }
}

// Middleware factory to check if user has required role(s)
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    
    next();
  };
}

/**
 * Optional authentication middleware.
 *
 * Use on endpoints that serve BOTH anonymous callers and authenticated ones, where the
 * response differs based on identity (e.g., carrier portal that can be hit without a
 * JWT but — if a JWT is present — must validate it fully, including the revoke-list
 * check, so that a logged-out user's token cannot sneak through).
 *
 * Behaviour:
 *  - No Authorization header → sets req.user = null and continues; never sends 401.
 *  - Token present but invalid / revoked → delegates to authenticate(), which returns 401.
 *  - Valid token → authenticate() sets req.user and calls next().
 */
export function optionalAuth(req, res, next) {
  if (req.headers.authorization) {
    // Full validation including revoke-list check; returns 401 on bad tokens.
    return authenticate(req, res, next);
  }
  req.user = null;
  next();
}
