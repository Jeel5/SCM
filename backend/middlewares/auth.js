import { verifyAccessToken } from '../utils/jwt.js';
import pool from '../config/db.js';

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
      const revoked = await pool.query(
        'SELECT 1 FROM revoked_tokens WHERE jti = $1 AND expires_at > NOW() LIMIT 1',
        [decoded.jti]
      );
      if (revoked.rows.length > 0) {
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
    console.error('Auth middleware error:', error);
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

// Optional auth - doesn't fail if no token, just doesn't set user
export function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyAccessToken(token);
      
      if (decoded) {
        req.user = {
          userId: decoded.userId,
          role: decoded.role,
          email: decoded.email,
          organizationId: decoded.organizationId
        };
      }
    }
    
    next();
  } catch (error) {
    next();
  }
}
