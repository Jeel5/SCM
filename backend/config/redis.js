/**
 * IORedis connection factory for BullMQ.
 *
 * BullMQ requires `maxRetriesPerRequest: null` — without it, ioredis throws
 * "ERR max number of clients reached" errors during connection retries.
 *
 * We export a factory function instead of a singleton so that BullMQ can
 * create its own subscriber/publisher connections independently.
 */
import Redis from 'ioredis';
import logger from '../utils/logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Create a new IORedis connection suitable for BullMQ.
 * BullMQ internally calls this factory for each connection it needs
 * (publisher, subscriber, blocking subscriber).
 */
export function createRedisConnection() {
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
  });

  client.on('connect', () => logger.info('✅ Redis connected'));
  client.on('error', (err) => logger.warn('Redis error:', err.message));
  client.on('reconnecting', () => logger.info('Redis reconnecting...'));

  return client;
}

// Default singleton for general use (non-BullMQ)
export const redis = createRedisConnection();
export default redis;
