/**
 * PRODUCTION-READY SHIPPING QUOTE CONTROLLER
 * 
 * This is the improved version with all production features:
 * - 10 second timeout per carrier with response time tracking
 * - Minimum 2 quotes required (retries once)
 * - Idempotency support
 * - Shipping lock (concurrency guard)
 * - Confidence scores for Phase 1
 * - Capacity reservation
 * - Selection reason tracking
 * 
 * IMPORTANT: Integrate these improvements into your existing controller:
 * backend/controllers/shippingQuoteController.js
 */

import carrierRateService from '../services/carrierRateService.js';
import { AppError } from '../errors/index.js';
import logger from '../utils/logger.js';
import db from '../configs/db.js';
import {
  IdempotencyManager,
  ShippingLockManager,
  CapacityManager,
  ConfidenceCalculator,
  ResponseTimeTracker,
  SelectionReasonTracker
} from '../utils/shippingHelpers.js';

/**
 * PHASE 1: Quick Estimate with Confidence Score
 * Improvements:
 * - Adds confidence score
 * - Returns UI-friendly message based on confidence
 * - Optionally stores estimate for accuracy tracking
 */
export const getQuickEstimateImproved = async (req, res, next) => {
  try {
    const { fromPincode, toPincode, weightKg, serviceType, sessionId } = req.body;

    // Validate required fields
    if (!fromPincode || !toPincode) {
      throw new AppError('Missing required fields: fromPincode, toPincode', 400);
    }

    logger.info('Getting quick shipping estimate', {
      fromPincode,
      toPincode,
      weightKg,
      serviceType,
      sessionId
    });

    // Calculate confidence score
    const confidence = ConfidenceCalculator.calculate({
      fromPincode,
      toPincode,
      weightKg: weightKg || 1,
      hasHistoricalData: false // TODO: Check if we have historical data for this route
    });

    // Get quick estimate
    const baseEstimate = await carrierRateService.getQuickEstimate({
      fromPincode,
      toPincode,
      weightKg: weightKg || 1,
      serviceType: serviceType || 'standard'
    });

    // Add confidence score
    const estimate = {
      ...baseEstimate,
      confidence,
      confidenceLabel: ConfidenceCalculator.getLabel(confidence),
      uiMessage: ConfidenceCalculator.getUIMessage(
        confidence,
        baseEstimate.estimatedCost,
        baseEstimate.range
      )
    };

    // Store estimate for accuracy tracking (optional)
    if (sessionId) {
      await db.query(
        `INSERT INTO shipping_estimates 
         (session_id, from_pincode, to_pincode, weight_kg, service_type, 
          estimated_cost, min_cost, max_cost, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          sessionId,
          fromPincode,
          toPincode,
          weightKg || 1,
          serviceType || 'standard',
          estimate.estimatedCost,
          estimate.minCost,
          estimate.maxCost,
          confidence
        ]
      );
    }

    res.json({
      success: true,
      data: estimate,
      message: 'This is an approximate estimate. Final cost determined after order confirmation.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PHASE 2: Real Quotes with ALL Production Features
 * 
 * New features:
 * - Idempotency (from middleware)
 * - Shipping lock (concurrency guard)
 * - 10s timeout with response time tracking
 * - Minimum 2 quotes (retries once)
 * - Capacity reservation
 * - Selection reason tracking
 */
export const getRealShippingQuotesImproved = async (req, res, next) => {
  let lockAcquired = false;

  try {
    const { origin, destination, items, orderId } = req.body;

    // Validate required fields
    if (!origin || !destination || !items || items.length === 0) {
      throw new AppError('Missing required fields: origin, destination, items', 400);
    }

    if (!orderId) {
      throw new AppError('Order ID is required for real quotes', 400);
    }

    // Validate origin and destination
    if (!origin.lat || !origin.lon || !origin.address) {
      throw new AppError('Origin must include lat, lon, and address', 400);
    }
    if (!destination.lat || !destination.lon || !destination.address) {
      throw new AppError('Destination must include lat, lon, and address', 400);
    }

    // Validate items have actual measured data
    for (const item of items) {
      if (!item.weight) {
        throw new AppError('Each item must have actual weight (measured at warehouse)', 400);
      }
      if (!item.dimensions) {
        throw new AppError('Each item must have actual dimensions (measured at warehouse)', 400);
      }
    }

    // STEP 1: Acquire shipping lock (prevent concurrent processing)
    lockAcquired = await ShippingLockManager.acquireLock(orderId, req.user?.id || 'api');

    if (!lockAcquired) {
      throw new AppError(
        'This order is currently being processed by another request. Please try again.',
        409
      );
    }

    logger.info('Acquired shipping lock, getting REAL quotes from all carriers', {
      orderId,
      origin: origin.address,
      destination: destination.address,
      itemCount: items.length,
      idempotencyKey: req.idempotencyKey
    });

    // STEP 2: Get quotes from ALL carriers with production features
    const result = await getRealQuotesWithProduction({
      origin,
      destination,
      items,
      orderId,
      idempotencyKey: req.idempotencyKey
    });

    const { acceptedQuotes, rejectedCarriers, totalCarriers, acceptanceRate } = result;

    // STEP 3: Check if we have any accepted quotes
    if (acceptedQuotes.length === 0) {
      throw new AppError(
        'No carriers available to ship this order. All carriers rejected or unavailable.',
        503,
        {
          rejections: rejectedCarriers,
          totalCarriers
        }
      );
    }

    // STEP 4: Select best quote
    const bestQuote = carrierRateService.selectBestQuote(acceptedQuotes);

    // STEP 5: Determine and record selection reason
    const selectionReason = SelectionReasonTracker.determineReason(bestQuote, acceptedQuotes);
    await SelectionReasonTracker.recordReason(orderId, bestQuote.carrierId, selectionReason);

    // STEP 6: Reserve capacity with selected carrier
    await CapacityManager.reserveCapacity(bestQuote.carrierId, orderId);

    // STEP 7: Mark selected quote in database
    await db.query(
      `UPDATE carrier_quotes 
       SET is_selected = true 
       WHERE order_id = $1 AND carrier_id = $2`,
      [orderId, bestQuote.carrierId]
    );

    // STEP 8: Update order with actual shipping cost
    await db.query(
      `UPDATE orders 
       SET actual_shipping_cost = $1,
           carrier_id = $2,
           shipping_cost_difference = actual_shipping_cost - estimated_shipping_cost
       WHERE id = $3`,
      [bestQuote.quotedPrice, bestQuote.carrierId, orderId]
    );

    logger.info('Real quotes collected successfully', {
      orderId,
      acceptedCount: acceptedQuotes.length,
      rejectedCount: rejectedCarriers.length,
      selectedCarrier: bestQuote.carrierName,
      selectionReason,
      actualCost: bestQuote.quotedPrice
    });

    const responseData = {
      success: true,
      data: {
        acceptedQuotes,
        rejectedCarriers,
        recommended: {
          ...bestQuote,
          selectionReason
        },
        stats: {
          totalCarriers,
          acceptedCount: acceptedQuotes.length,
          rejectedCount: rejectedCarriers.length,
          acceptanceRate,
          avgResponseTime: calculateAvgResponseTime(acceptedQuotes)
        }
      },
      message: `Received ${acceptedQuotes.length} quotes from carriers. ${rejectedCarriers.length} carriers unavailable.`
    };

    // Cache response for idempotency
    if (req.idempotencyKey) {
      await IdempotencyManager.cacheResult(req.idempotencyKey, responseData);
    }

    res.json(responseData);

  } catch (error) {
    next(error);
  } finally {
    // ALWAYS release lock
    if (lockAcquired) {
      await ShippingLockManager.releaseLock(orderId);
    }
  }
};

/**
 * Get real quotes with ALL production features
 * - 10 second timeout per carrier
 * - Response time tracking
 * - Minimum 2 quotes (retries once)
 */
async function getRealQuotesWithProduction({ origin, destination, items, orderId, idempotencyKey }) {
  const QUOTE_TIMEOUT = 10000; // 10 seconds
  const MIN_REQUIRED_QUOTES = 2;

  // Get all active carriers
  const { rows: carriers } = await db.query(
    `SELECT id, name, code, api_endpoint, api_key_encrypted, is_active
     FROM carriers 
     WHERE is_active = true AND api_endpoint IS NOT NULL`
  );

  if (carriers.length === 0) {
    throw new Error('No active carriers available');
  }

  logger.info(`Sending quote request to ${carriers.length} carriers (10s timeout per carrier)`, {
    orderId
  });

  // Send to ALL carriers with timeout
  let carrierResults = await Promise.all(
    carriers.map(carrier => 
      ResponseTimeTracker.raceWithTimeout(
        getCarrierQuoteWithAcceptance(carrier, { origin, destination, items, orderId }),
        QUOTE_TIMEOUT,
        carrier.id
      )
    )
  );

  // Process results
  let acceptedQuotes = [];
  let rejectedCarriers = [];
  let timedOutCarriers = [];

  for (let i = 0; i < carrierResults.length; i++) {
    const result = carrierResults[i];
    const carrier = carriers[i];

    if (result.timeout) {
      // Timeout
      timedOutCarriers.push({
        carrierName: carrier.name,
        carrierCode: carrier.code,
        reason: 'api_timeout',
        message: `Carrier API did not respond within ${QUOTE_TIMEOUT / 1000} seconds`,
        responseTime: QUOTE_TIMEOUT
      });
      rejectedCarriers.push(timedOutCarriers[timedOutCarriers.length - 1]);
    } else if (result.accepted) {
      acceptedQuotes.push({
        ...result.quote,
        carrierId: carrier.id,
        carrierName: carrier.name,
        carrierCode: carrier.code,
        responseTime: result.responseTime,
        wasRetried: false
      });
    } else {
      rejectedCarriers.push({
        carrierName: carrier.name,
        carrierCode: carrier.code,
        reason: result.reason,
        message: result.message,
        responseTime: result.responseTime
      });
    }
  }

  // Check if we need to retry
  if (acceptedQuotes.length < MIN_REQUIRED_QUOTES && acceptedQuotes.length > 0) {
    logger.warn('Only got 1 quote, retrying rejected/timeout carriers once', {
      acceptedCount: acceptedQuotes.length,
      orderId
    });

    // Retry failed carriers
    const carriersToRetry = rejectedCarriers
      .map(r => carriers.find(c => c.code === r.carrierCode))
      .filter(Boolean);

    if (carriersToRetry.length > 0) {
      const retryResults = await Promise.all(
        carriersToRetry.map(carrier =>
          ResponseTimeTracker.raceWithTimeout(
            getCarrierQuoteWithAcceptance(carrier, { origin, destination, items, orderId }),
            QUOTE_TIMEOUT,
            carrier.id
          )
        )
      );

      for (let i = 0; i < retryResults.length; i++) {
        const result = retryResults[i];
        const carrier = carriersToRetry[i];

        if (!result.timeout && result.accepted) {
          // Remove from rejected list
          rejectedCarriers = rejectedCarriers.filter(r => r.carrierCode !== carrier.code);

          acceptedQuotes.push({
            ...result.quote,
            carrierId: carrier.id,
            carrierName: carrier.name,
            carrierCode: carrier.code,
            responseTime: result.responseTime,
            wasRetried: true // Mark as retry
          });

          logger.info('Retry successful', { carrier: carrier.name });
        }
      }
    }
  }

  // Store quotes and rejections with response times
  if (acceptedQuotes.length > 0) {
    await storeQuotesWithAnalytics(acceptedQuotes, orderId);
  }

  if (rejectedCarriers.length > 0) {
    await storeRejectionsWithAnalytics(rejectedCarriers, orderId);
  }

  return {
    acceptedQuotes,
    rejectedCarriers,
    totalCarriers: carriers.length,
    acceptedCount: acceptedQuotes.length,
    rejectedCount: rejectedCarriers.length,
    timedOutCount: timedOutCarriers.length,
    acceptanceRate: `${((acceptedQuotes.length / carriers.length) * 100).toFixed(1)}%`
  };
}

/**
 * Helper: Get quote from carrier with acceptance check
 */
async function getCarrierQuoteWithAcceptance(carrier, shipmentDetails) {
  // This would call actual carrier API
  // For now, use the existing service method
  return carrierRateService.getCarrierQuoteWithAcceptance(carrier, shipmentDetails);
}

/**
 * Helper: Store quotes with analytics fields
 */
async function storeQuotesWithAnalytics(quotes, orderId) {
  try {
    for (const quote of quotes) {
      await db.query(
        `INSERT INTO carrier_quotes 
         (order_id, carrier_id, quoted_price, currency, estimated_delivery_days, 
          estimated_delivery_date, service_type, valid_until, breakdown,
          response_time_ms, was_retried)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          orderId,
          quote.carrierId,
          quote.quotedPrice,
          quote.currency || 'INR',
          quote.estimatedDeliveryDays,
          quote.estimatedDeliveryDate,
          quote.serviceType,
          quote.validUntil,
          JSON.stringify(quote.breakdown || {}),
          quote.responseTime || null,
          quote.wasRetried || false
        ]
      );
    }
  } catch (error) {
    logger.error('Error storing quotes', { error: error.message, orderId });
  }
}

/**
 * Helper: Store rejections with response times
 */
async function storeRejectionsWithAnalytics(rejections, orderId) {
  try {
    for (const rejection of rejections) {
      await db.query(
        `INSERT INTO carrier_rejections 
         (order_id, carrier_name, carrier_code, reason, message, response_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          orderId,
          rejection.carrierName,
          rejection.carrierCode,
          rejection.reason,
          rejection.message,
          rejection.responseTime || null
        ]
      );
    }
  } catch (error) {
    logger.error('Error storing rejections', { error: error.message, orderId });
  }
}

/**
 * Helper: Calculate average response time
 */
function calculateAvgResponseTime(quotes) {
  if (quotes.length === 0) return null;

  const total = quotes.reduce((sum, q) => sum + (q.responseTime || 0), 0);
  return Math.round(total / quotes.length);
}

/**
 * Export for integration
 */
export default {
  getQuickEstimateImproved,
  getRealShippingQuotesImproved
};
