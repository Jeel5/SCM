/**
 * Redis cache utilities — cache-aside pattern with strict consistency.
 *
 * READ  → check Redis first (O(1)), fall back to DB on miss, then backfill Redis
 * WRITE → write DB first, then DELETE the cache key (never update-in-place)
 *
 * Deleting on write (rather than updating) is critical:
 *   - Avoids the "two-state" race where DB holds new value but Redis holds old value
 *   - Next read fetches fresh data from DB and re-populates the cache cleanly
 *   - If Redis is unreachable at write time, the stale entry auto-expires via TTL
 *
 * Key namespace convention:
 *   dash:{orgSeg}:{period}          TTL 60s   — dashboard aggregations
 *   analytics:{orgSeg}:{range}      TTL 300s  — analytics aggregations
 *   sla:pol:{orgSeg}               TTL 600s  — active SLA policy list
 *   orders:list:{orgSeg}:{hash}    TTL 30s   — paginated order list
 *   ship:list:{orgSeg}:{hash}      TTL 30s   — paginated shipment list
 *   inv:list:{orgSeg}:{hash}       TTL 30s   — paginated inventory list
 *   inv:lowstock:{orgSeg}:{wh}     TTL 30s   — low-stock alerts
 *   inv:stats:{orgSeg}:{wh}        TTL 30s   — inventory aggregate stats
 *   returns:list:{orgSeg}:{hash}   TTL 30s   — paginated returns list
 *   revoked_jti:{jti}              TTL=token expiry — JWT revocation (see UserRepository)
 */
import redis from '../config/redis.js';
import logger from './logger.js';
import { createHash } from 'crypto';

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Read-through cache wrapper.
 *
 * Returns the cached value on hit. On miss, calls `fn`, stores result in Redis
 * with the given TTL, and returns the fresh value. Redis failures are silent —
 * the app always falls back to the DB.
 *
 * @param {string}   key    - Redis key
 * @param {number}   ttlSec - Expiry in seconds
 * @param {Function} fn     - Async factory that returns the fresh value (called on miss)
 * @returns {Promise<any>}
 */
export async function cacheWrap(key, ttlSec, fn) {
  try {
    const cached = await redis.get(key);
    if (cached !== null) return JSON.parse(cached);
  } catch (_) { /* Redis unavailable — fall through to DB */ }

  const result = await fn();

  try {
    await redis.set(key, JSON.stringify(result), 'EX', ttlSec);
  } catch (_) { /* Redis unavailable — return fresh result without caching */ }

  return result;
}

/**
 * Delete one or more specific cache keys.
 * Called immediately after a DB write to keep Redis consistent.
 *
 * @param {...string} keys
 */
export async function invalidate(...keys) {
  const flat = keys.flat().filter(Boolean);
  if (!flat.length) return;
  try {
    await redis.del(...flat);
  } catch (err) {
    logger.warn(`Cache key invalidation failed: ${err.message}`);
  }
}

/**
 * Scan-and-delete all keys matching a Redis glob pattern.
 * Uses cursor-based SCAN — safe for production (never blocks Redis unlike KEYS).
 *
 * @param {string} pattern  e.g. 'dash:org-123:*'
 */
export async function invalidatePattern(pattern) {
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== '0');
  } catch (err) {
    logger.warn(`Cache scan-invalidation failed [${pattern}]:`, err.message);
  }
}

/**
 * Invalidate multiple glob patterns in parallel.
 *
 * @param {string[]} patterns
 */
export async function invalidatePatterns(patterns) {
  await Promise.all(patterns.map(invalidatePattern));
}

// ─── Key-building helpers ─────────────────────────────────────────────────────

/**
 * Return a canonical org segment for cache key composition.
 *   orgSeg('org-abc') → 'org-abc'
 *   orgSeg(null)      → '_g_'   (global / superadmin scope)
 */
export function orgSeg(organizationId) {
  return organizationId || '_g_';
}

/**
 * Build a stable 12-char suffix from a params object.
 * Keys are sorted so {a:1,b:2} and {b:2,a:1} produce the same hash.
 * Undefined / null / '' values are stripped before hashing.
 */
export function hashParams(obj) {
  const cleaned = Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .sort(([a], [b]) => a.localeCompare(b))
  );
  return createHash('sha1').update(JSON.stringify(cleaned)).digest('base64url').slice(0, 12);
}

/**
 * Build the full set of cache patterns to invalidate after a write.
 *
 * Strategy: always invalidate BOTH the org-specific key AND the global (_g_) key,
 * because the superadmin dashboard aggregates ALL orgs. If any org changes its data,
 * the global view is stale too.
 *
 * @param {string|null} organizationId
 * @param  {...string}  prefixes  e.g. 'dash', 'analytics', 'orders:list'
 * @returns {string[]}
 */
export function invalidationTargets(organizationId, ...prefixes) {
  const targets = [];
  for (const prefix of prefixes) {
    targets.push(`${prefix}:${orgSeg(organizationId)}:*`);
    if (organizationId) targets.push(`${prefix}:_g_:*`); // global view affected too
  }
  return targets;
}
