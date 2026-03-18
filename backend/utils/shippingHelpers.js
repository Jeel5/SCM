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

import orderRepo from '../repositories/OrderRepository.js';
import postalZoneRepo from '../repositories/PostalZoneRepository.js';
import carrierRepo from '../repositories/CarrierRepository.js';
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
      const cached = await orderRepo.findCachedQuote(idempotencyKey);

      if (cached) {
        logger.info('Idempotency key found - returning cached result', { idempotencyKey });
        return {
          cached: true,
          result: JSON.parse(cached.result),
          cachedAt: cached.created_at
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
      await orderRepo.cacheQuoteResult(idempotencyKey, JSON.stringify(result), expiryHours);

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
      const deletedCount = await orderRepo.cleanExpiredQuoteCache();

      logger.info('Cleaned expired idempotency cache entries', { deletedCount });

      return deletedCount;
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
      const locked = await orderRepo.acquireShippingLock(orderId, workerId);

      if (locked) {
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
      await orderRepo.releaseShippingLock(orderId);

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
      const row = await orderRepo.getShippingLockStatus(orderId);

      if (!row) {
        return { locked: false, reason: 'order_not_found' };
      }

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
      const released = await orderRepo.releaseStaleLocks(olderThanMinutes);

      if (released.length > 0) {
        logger.warn('Released stale shipping locks', { 
          count: released.length,
          locks: released 
        });
      }

      return released.length;
    } catch (error) {
      logger.error('Error releasing stale locks', { error: error.message });
      throw error;
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
  static async calculate({ fromPincode, toPincode, weightKg, hasHistoricalData = false }) {
    let confidence = 0.50; // Base confidence
    let sameZone = false;
    let zoneBucket = null; // 'same' | 'adjacent' | 'moderate' | 'long'

    try {
      // Attempt DB lookup for precise zone/distance data
      const zones = await postalZoneRepo.findByPincodes([fromPincode, toPincode]);

      if (zones.length === 2) {
        const fromRow = zones.find(r => r.pincode === fromPincode);
        const toRow   = zones.find(r => r.pincode === toPincode);

        if (fromRow && toRow) {
          if (fromRow.zone_code === toRow.zone_code) {
            sameZone = true;
          } else if (fromRow.zone_code && toRow.zone_code) {
            const distanceKm = await postalZoneRepo.findZoneDistance(fromRow.zone_code, toRow.zone_code);
            if (distanceKm !== null) {
              zoneBucket = distanceKm < 100 ? 'same' : distanceKm < 300 ? 'adjacent' : distanceKm < 600 ? 'moderate' : 'long';
            }
          } else if (fromRow.lat && fromRow.lon && toRow.lat && toRow.lon) {
            // Fall back to Haversine when only coordinates are available
            const R = 6371;
            const φ1 = parseFloat(fromRow.lat) * Math.PI / 180;
            const φ2 = parseFloat(toRow.lat)   * Math.PI / 180;
            const Δφ = (parseFloat(toRow.lat)  - parseFloat(fromRow.lat)) * Math.PI / 180;
            const Δλ = (parseFloat(toRow.lon)  - parseFloat(fromRow.lon)) * Math.PI / 180;
            const a  = Math.sin(Δφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)**2;
            const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            zoneBucket = km < 100 ? 'same' : km < 300 ? 'adjacent' : km < 600 ? 'moderate' : 'long';
          }
        }
      }
    } catch (err) {
      logger.warn('ConfidenceCalculator: postal_zones lookup failed, using approximation', { error: err.message });
    }

    // Fall back to prefix approximation when DB had no usable data
    if (!sameZone && zoneBucket === null) {
      const fromPrefix = fromPincode.substring(0, 3);
      const toPrefix   = toPincode.substring(0, 3);
      if (fromPrefix === toPrefix) {
        sameZone = true;
      } else {
        const diff = Math.abs(parseInt(fromPrefix, 10) - parseInt(toPrefix, 10));
        zoneBucket = diff === 0 ? 'same' : diff < 50 ? 'adjacent' : diff < 150 ? 'moderate' : 'long';
      }
    }

    const bucket = sameZone ? 'same' : zoneBucket;
    if (bucket === 'same')          confidence += 0.45; // Same zone: +45%
    else if (bucket === 'adjacent') confidence += 0.35; // Adjacent: +35%
    else if (bucket === 'moderate') confidence += 0.20; // Moderate: +20%
    else                            confidence += 0.10; // Long distance: +10%

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
      await carrierRepo.updateQuoteSelectionReason(orderId, carrierId, reason);

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
  ConfidenceCalculator,
  ResponseTimeTracker,
  SelectionReasonTracker
};
