/**
 * Socket.IO server initialisation.
 *
 * Auth flow:
 *  1. Client connects with `withCredentials: true` — browser sends accessToken httpOnly cookie.
 *  2. Middleware parses the cookie, verifies JWT, checks revoke list.
 *  3. On success, socket.user is populated and the socket joins:
 *       - `org:{organizationId}` for regular users
 *       - `superadmin`           for superadmin role
 *  4. Client emits `shipment:subscribe` / `shipment:unsubscribe` to join per-shipment rooms.
 */

import { Server } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt.js';
import userRepo from '../repositories/UserRepository.js';
import logger from '../utils/logger.js';
import { setIo } from './emitter.js';

/** Parse cookie string into key→value map. */
function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, pair) => {
    const eqIdx = pair.indexOf('=');
    if (eqIdx < 0) return acc;
    const key = pair.slice(0, eqIdx).trim();
    const val = pair.slice(eqIdx + 1).trim();
    if (key) acc[key] = decodeURIComponent(val);
    return acc;
  }, {});
}

/**
 * Initialise Socket.IO on the given HTTP server.
 *
 * @param {import('http').Server} httpServer
 * @param {string | string[] | RegExp | boolean} corsOrigin  – forwarded from the Express CORS config
 * @returns {import('socket.io').Server}
 */
export function initSocket(httpServer, corsOrigin) {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
    // Allow long-polling fallback for environments that block WS
    transports: ['websocket', 'polling'],
  });

  // ── Authentication middleware ────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      // Prefer httpOnly cookie (web clients); fall back to auth.token (Postman / mobile)
      const cookies = parseCookies(socket.handshake.headers.cookie || '');
      const token = cookies.accessToken || socket.handshake.auth?.token;

      if (!token) return next(new Error('Authentication required'));

      const decoded = verifyAccessToken(token);
      if (!decoded) return next(new Error('Invalid or expired token'));

      // Blocklist check (same as authenticate middleware)
      if (decoded.jti) {
        const revoked = await userRepo.isTokenRevoked(decoded.jti);
        if (revoked) return next(new Error('Token revoked'));
      }

      socket.user = {
        userId:         decoded.userId,
        role:           decoded.role,
        organizationId: decoded.organizationId,
      };

      next();
    } catch (err) {
      logger.warn('Socket auth failed:', err.message);
      next(new Error('Authentication failed'));
    }
  });

  // ── Connection handler ───────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const { userId, role, organizationId } = socket.user;

    // Join the org room so org-scoped broadcasts reach this socket
    if (role === 'superadmin') {
      socket.join('superadmin');
      logger.debug('Socket joined superadmin room', { userId, socketId: socket.id });
    } else if (organizationId) {
      socket.join(`org:${organizationId}`);
      logger.debug('Socket joined org room', { userId, organizationId, socketId: socket.id });
    }

    // Per-shipment room management (for live map tracking)
    socket.on('shipment:subscribe', ({ shipmentId } = {}) => {
      if (shipmentId) {
        socket.join(`shipment:${shipmentId}`);
        logger.debug('Socket subscribed to shipment', { shipmentId, socketId: socket.id });
      }
    });

    socket.on('shipment:unsubscribe', ({ shipmentId } = {}) => {
      if (shipmentId) socket.leave(`shipment:${shipmentId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.debug('Socket disconnected', { userId, reason, socketId: socket.id });
    });
  });

  setIo(io);
  logger.info('Socket.IO initialised');
  return io;
}
