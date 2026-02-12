/**
 * Production Helpers for Two-Phase Quoting System
 * 
 * This module provides production-ready utilities:
 * - Idempotency key validation
 * - Shipping lock management
 * - Capacity reservations
 * - Confidence calculations
 * - Response time tracking
 */

import db from '../configs/db.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

/**
 * Idempotency Key Management
 */
export class IdempotencyManager {
  /**
   * Generate idempotency key from order ID and timestamp
   */
  static generateKey(orderId, timestamp = null) {
    const ts = timestamp || Date.now();
    return crypto.createHash('sha256')
      .update(`${orderId}-${ts}`)
      .digest('hex');
  }

  /**
   * Check if request has already been processed
   */
  static async checkIdempotency(idempotencyKey) {
    try {
      const result = await db.query(
        `SELECT result, created_at 
         FROM quote_idempotency_cache 
         WHERE idempotency_key = $1 AND expires_at > NOW()`,
        [idempotencyKey]
      );

      if (result.rows.length > 0) {
        logger.info('Idempotency key found - returning cached result', { idempotencyKey });
        return {
          cached: true,
          result: JSON.parse(result.rows[0].result),
          cachedAt: result.rows[0].created_at
        };
      }

      return { cached: false };
    } catch (error) {
      logger.error('Error checking idempotency', { error: error.message, idempotencyKey });
      return { cached: false }; // Fail open - proceed with request
    }
  }

  /**
   * Cache result for idempotency
   */
  static async cacheResult(idempotencyKey, result, expiryHours = 1) {
    try {
      await db.query(
        `INSERT INTO quote_idempotency_cache (idempotency_key, result, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '${expiryHours} hours')
         ON CONFLICT (idempotency_key) 
         DO UPDATE SET result = $2, expires_at = NOW() + INTERVAL '${expiryHours} hours'`,
        [idempotencyKey, JSON.stringify(result)]
      );

      logger.info('Cached result for idempotency', { idempotencyKey, expiresIn: `${expiryHours}h` });
    } catch (error) {
      logger.error('Error caching result', { error: error.message, idempotencyKey });
      // Don't throw - caching failure shouldn't block response
    }
  }

  /**
   * Clean up expired cache entries (call from scheduled job)
   */
  static async cleanExpiredCache() {
    try {
      const result = await db.query(
        `DELETE FROM quote_idempotency_cache 
         WHERE expires_at < NOW() - INTERVAL '1 day'`
      );

      logger.info('Cleaned expired idempotency cache entries', { 
        deletedCount: result.rowCount 
      });

      return result.rowCount;
    } catch (error) {
      logger.error('Error cleaning cache', { error: error.message });
      throw error;
    }
  }
}

/**
 * Shipping Lock Management (Concurrency Guard)
 * Prevents multiple workers from processing the same order
 */
export class ShippingLockManager {
  /**
   * Acquire lock on order for shipping assignment
   * Returns true if lock acquired, false if already locked
   */
  static async acquireLock(orderId, workerId = 'default') {
    try {
      // Use atomic UPDATE to acquire lock
      const result = await db.query(
        `UPDATE orders 
         SET shipping_locked = true,
             shipping_locked_at = NOW(),
             shipping_locked_by = $2
         WHERE id = $1 
           AND (shipping_locked = false OR shipping_locked IS NULL)
         RETURNING id`,
        [orderId, workerId]
      );

      if (result.rows.length > 0) {
        logger.info('Acquired shipping lock', { orderId, workerId });
        return true;
      } else {
        logger.warn('Failed to acquire lock - already locked', { orderId });
        return false;
      }
    } catch (error) {
      logger.error('Error acquiring lock', { error: error.message, orderId });
      throw error;
    }
  }

  /**
   * Release lock on order
   */
  static async releaseLock(orderId) {
    try {
      await db.query(
        `UPDATE orders 
         SET shipping_locked = false,
             shipping_locked_at = NULL,
             shipping_locked_by = NULL
         WHERE id = $1`,
        [orderId]
      );

      logger.info('Released shipping lock', { orderId });
    } catch (error) {
      logger.error('Error releasing lock', { error: error.message, orderId });
      throw error;
    }
  }

  /**
   * Check if order is locked
   */
  static async isLocked(orderId) {
    try {
      const result = await db.query(
        `SELECT shipping_locked, shipping_locked_at, shipping_locked_by
         FROM orders
         WHERE id = $1`,
        [orderId]
      );

      if (result.rows.length === 0) {
        return { locked: false, reason: 'order_not_found' };
      }

      const row = result.rows[0];
      return {
        locked: row.shipping_locked || false,
        lockedAt: row.shipping_locked_at,
        lockedBy: row.shipping_locked_by
      };
    } catch (error) {
      logger.error('Error checking lock', { error: error.message, orderId });
      throw error;
    }
  }

  /**
   * Release stale locks (call from scheduled job)
   * Releases locks older than specified minutes
   */
  static async releaseStaleLocks(olderThanMinutes = 30) {
    try {
      const result = await db.query(
        `UPDATE orders
         SET shipping_locked = false,
             shipping_locked_at = NULL,
             shipping_locked_by = NULL
         WHERE shipping_locked = true
           AND shipping_locked_at < NOW() - INTERVAL '${olderThanMinutes} minutes'
         RETURNING id, shipping_locked_by`
      );

      if (result.rowCount > 0) {
        logger.warn('Released stale shipping locks', { 
          count: result.rowCount,
          locks: result.rows 
        });
      }

      return result.rowCount;
    } catch (error) {
      logger.error('Error releasing stale locks', { error: error.message });
      throw error;
    }
  }
}

/**
 * Carrier Capacity Management
 */
export class CapacityManager {
  /**
   * Reserve capacity with carrier
   */
  static async reserveCapacity(carrierId, orderId) {
    try {
      // Check if carrier has capacity
      const carrier = await db.query(
        `SELECT id, current_load, max_capacity FROM carriers WHERE id = $1`,
        [carrierId]
      );

      if (carrier.rows.length === 0) {
        throw new Error('Carrier not found');
      }

      const { current_load, max_capacity } = carrier.rows[0];

      // Check capacity limit
      if (max_capacity && current_load >= max_capacity) {
        logger.warn('Carrier at full capacity', { carrierId, current_load, max_capacity });
        return { reserved: false, reason: 'at_capacity' };
      }

      // Increment load atomically
      await db.query(
        `UPDATE carriers 
         SET current_load = COALESCE(current_load, 0) + 1,
             updated_at = NOW()
         WHERE id = $1`,
        [carrierId]
      );

      logger.info('Reserved carrier capacity', { carrierId, orderId });

      // Log capacity snapshot
      await this.logCapacitySnapshot(carrierId);

      return { reserved: true };
    } catch (error) {
      logger.error('Error reserving capacity', { error: error.message, carrierId });
      throw error;
    }
  }

  /**
   * Release capacity when order cancelled
   */
  static async releaseCapacity(carrierId, orderId) {
    try {
      await db.query(
        `UPDATE carriers 
         SET current_load = GREATEST(COALESCE(current_load, 0) - 1, 0),
             updated_at = NOW()
         WHERE id = $1`,
        [carrierId]
      );

      logger.info('Released carrier capacity', { carrierId, orderId });
    } catch (error) {
      logger.error('Error releasing capacity', { error: error.message, carrierId });
      // Don't throw - releasing capacity failure shouldn't block cancellation
    }
  }

  /**
   * Log capacity snapshot for analytics
   */
  static async logCapacitySnapshot(carrierId) {
    try {
      await db.query(
        `INSERT INTO carrier_capacity_log (carrier_id, capacity_snapshot, max_capacity, utilization_percent)
         SELECT id, current_load, max_capacity, 
                CASE WHEN max_capacity > 0 
                     THEN (current_load::DECIMAL / max_capacity * 100)
                     ELSE NULL 
                END
         FROM carriers
         WHERE id = $1`,
        [carrierId]
      );
    } catch (error) {
      logger.error('Error logging capacity', { error: error.message, carrierId });
      // Don't throw - logging failure shouldn't block operations
    }
  }
}

/**
 * Confidence Calculator for Phase 1 Estimates
 */
export class ConfidenceCalculator {
  /**
   * Calculate confidence score for estimate (0.0 to 1.0)
   * Higher confidence = estimate closer to actual cost
   */
  static calculate({ fromPincode, toPincode, weightKg, hasHistoricalData = false }) {
    let confidence = 0.50; // Base confidence

    // Zone proximity (same zone = higher confidence)
    const fromZone = fromPincode.substring(0, 3);
    const toZone = toPincode.substring(0, 3);
    const zoneDiff = Math.abs(parseInt(fromZone) - parseInt(toZone));

    if (zoneDiff === 0) {
      confidence += 0.45; // Same zone: +45% (total ~95%)
    } else if (zoneDiff < 50) {
      confidence += 0.35; // Adjacent: +35% (total ~85%)
    } else if (zoneDiff < 150) {
      confidence += 0.20; // Moderate distance: +20% (total ~70%)
    } else {
      confidence += 0.10; // Long distance: +10% (total ~60%)
    }

    // Weight (standard weights have better estimates)
    if (weightKg > 0 && weightKg <= 2) {
      // Standard package weight - good estimates
      // No adjustment
    } else if (weightKg > 2 && weightKg <= 10) {
      confidence -= 0.05; // Heavy packages: -5%
    } else if (weightKg > 10) {
      confidence -= 0.10; // Very heavy: -10%
    }

    // Historical data bonus
    if (hasHistoricalData) {
      confidence += 0.05; // +5% if we have historical data for this route
    }

    // Clamp between 0.50 and 0.95
    return Math.max(0.50, Math.min(0.95, confidence));
  }

  /**
   * Get confidence level label
   */
  static getLabel(confidence) {
    if (confidence >= 0.90) return 'Very High';
    if (confidence >= 0.80) return 'High';
    if (confidence >= 0.70) return 'Medium';
    return 'Low';
  }

  /**
   * Get UI message based on confidence
   */
  static getUIMessage(confidence, estimatedCost, range) {
    if (confidence >= 0.85) {
      return `Estimated shipping: ₹${estimatedCost}`;
    } else if (confidence >= 0.70) {
      return `Estimated shipping: ₹${estimatedCost} (±10%)`;
    } else {
      return `Estimated shipping: ₹${range}`;
    }
  }
}

/**
 * Response Time Tracker
 */
export class ResponseTimeTracker {
  constructor() {
this.startTime = Date.now();
  }

  /**
   * Get elapsed time in milliseconds
   */
  elapsed() {
    return Date.now() - this.startTime;
  }

  /**
   * Create a timeout promise
   */
  static createTimeout(ms, carrierId) {
    return new Promise((resolve) =>
      setTimeout(() => resolve({
        timeout: true,
        carrierId,
        responseTime: ms
      }), ms)
    );
  }

  /**
   * Race a promise against timeout
   */
  static async raceWithTimeout(promise, timeoutMs, carrierId) {
    const tracker = new ResponseTimeTracker();

    const result = await Promise.race([
      promise,
      this.createTimeout(timeoutMs, carrierId)
    ]);

    if (result.timeout) {
      return result;
    }

    return {
      ...result,
      responseTime: tracker.elapsed()
    };
  }
}

/**
 * Selection Reason Tracker
 * Records why a particular carrier was selected
 */
export class SelectionReasonTracker {
  static determineReason(selectedQuote, allQuotes) {
    if (allQuotes.length === 1) {
      return 'only_option';
    }

    // Check if it's the cheapest
    const cheapest = allQuotes.reduce((min, q) => 
      q.quotedPrice < min.quotedPrice ? q : min
    );

    if (selectedQuote.carrierId === cheapest.carrierId) {
      return 'best_price';
    }

    // Check if it's the fastest
    const fastest = allQuotes.reduce((min, q) =>
      q.estimatedDeliveryDays < min.estimatedDeliveryDays ? q : min
    );

    if (selectedQuote.carrierId === fastest.carrierId) {
      return 'best_speed';
    }

    // Otherwise it's the best balance
    return 'best_balance';
  }

  /**
   * Store selection reason in database
   */
  static async recordReason(orderId, carrierId, reason) {
    try {
      await db.query(
        `UPDATE carrier_quotes
         SET selection_reason = $1
         WHERE order_id = $2 AND carrier_id = $3`,
        [reason, orderId, carrierId]
      );

      logger.info('Recorded selection reason', { orderId, carrierId, reason });
    } catch (error) {
      logger.error('Error recording selection reason', { error: error.message });
      // Don't throw - logging failure shouldn't block operations
    }
  }
}

export default {
  IdempotencyManager,
  ShippingLockManager,
  CapacityManager,
  ConfidenceCalculator,
  ResponseTimeTracker,
  SelectionReasonTracker
};
