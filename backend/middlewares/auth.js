import { verifyAccessToken } from '../utils/jwt.js';
import userRepo from '../repositories/UserRepository.js';
import logger from '../utils/logger.js';

// Middleware to verify JWT token and attach user info to request
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Check token blocklist (revoked sessions / password changes)
    if (decoded.jti) {
      const revoked = await userRepo.isTokenRevoked(decoded.jti);
      if (revoked) {
        return res.status(401).json({ error: 'Token has been revoked' });
      }
    }
    
    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      email: decoded.email,
      organizationId: decoded.organizationId,
      jti: decoded.jti || null,
      exp: decoded.exp || null
    };
    
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// Middleware factory to check if user has required role(s)
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
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
