/**
 * Rate limiting middleware using rate-limiter-flexible + Redis.
 *
 * Three limiters:
 *   1. globalIpLimiter   — 200 req/min per IP (all routes)
 *   2. authLimiter       — 10 attempts/15 min per IP  (login / register)
 *   3. userLimiter       — 500 req/min per userId (authenticated routes)
 *
 * On Redis failure all limiters fail-open (let the request through) so a
 * Redis outage never takes down the API.
 *
 * Throttling vs Rate-limiting:
 *   Rate-limit  → hard reject with 429 when quota exceeded
 *   Throttle    → queue/delay requests (not implemented — 429 is the standard
 *                 REST API pattern and what clients expect)
 */
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import redis from '../config/redis.js';
import logger from '../utils/logger.js';

// ─── Limiter factories ────────────────────────────────────────────────────────

function makeRedisLimiter(opts) {
  try {
    return new RateLimiterRedis({
      storeClient: redis,
      insuranceLimiter: new RateLimiterMemory({ ...opts }), // fallback if Redis is down
      ...opts,
    });
  } catch (err) {
    logger.warn(`Rate limiter fell back to memory store: ${err.message}`);
    return new RateLimiterMemory(opts);
  }
}

/** 200 requests / 60 seconds per IP — applied globally */
const globalIpLimiter = makeRedisLimiter({
  keyPrefix:  'rl:ip',
  points:     200,
  duration:   60,
});

/** 10 attempts / 15 minutes per IP — applied on auth routes */
const authLimiter = makeRedisLimiter({
  keyPrefix:  'rl:auth',
  points:     10,
  duration:   15 * 60,
  blockDuration: 15 * 60, // block the IP for 15 min after exhaustion
});

/** 500 requests / 60 seconds per userId — applied on authenticated routes */
const userLimiter = makeRedisLimiter({
  keyPrefix:  'rl:user',
  points:     500,
  duration:   60,
});

// ─── Middleware builders ───────────────────────────────────────────────────────

function rateLimitResponse(res, rateLimiterRes) {
  const secs = Math.ceil(rateLimiterRes.msBeforeNext / 1000) || 1;
  res.set('Retry-After', secs);
  res.set('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString());
  return res.status(429).json({
    success: false,
    message: 'Too many requests. Please slow down.',
    retryAfterSeconds: secs,
  });
}

/** Apply to every route — keyed by client IP */
export async function globalRateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  try {
    const result = await globalIpLimiter.consume(ip);
    res.set('X-RateLimit-Remaining', result.remainingPoints);
    next();
  } catch (rateLimiterRes) {
    if (rateLimiterRes instanceof Error) {
      // Redis error — fail open
      logger.warn(`Rate limiter error (fail-open): ${rateLimiterRes.message}`);
      return next();
    }
    logger.warn('Global rate limit exceeded', { ip });
    return rateLimitResponse(res, rateLimiterRes);
  }
}

/** Apply to /auth/login and /auth/register — stricter, blocks on abuse */
export async function authRateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  // Include email in key to prevent credential stuffing across IPs
  const email = req.body?.email || '';
  const key   = `${ip}_${email}`.toLowerCase();
  try {
    await authLimiter.consume(key);
    next();
  } catch (rateLimiterRes) {
    if (rateLimiterRes instanceof Error) {
      logger.warn('Auth rate limiter error (fail-open):', rateLimiterRes.message);
      return next();
    }
    logger.warn('Auth rate limit exceeded', { ip, email });
    return rateLimitResponse(res, rateLimiterRes);
  }
}

/** Apply to authenticated routes — keyed by userId */
export async function userRateLimit(req, res, next) {
  if (!req.user?.userId) return next(); // unauthenticated — already covered by globalIpLimiter
  try {
    const result = await userLimiter.consume(req.user.userId);
    res.set('X-RateLimit-Remaining', result.remainingPoints);
    next();
  } catch (rateLimiterRes) {
    if (rateLimiterRes instanceof Error) {
      logger.warn('User rate limiter error (fail-open):', rateLimiterRes.message);
      return next();
    }
    logger.warn('User rate limit exceeded', { userId: req.user.userId });
    return rateLimitResponse(res, rateLimiterRes);
  }
}
