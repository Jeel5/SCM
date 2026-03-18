/**
 * Carrier Quote Service
 * 
 * Responsibility: Get real quotes from carrier APIs (Phase 2)
 * - Send quote requests to ALL active carriers
 * - Handle carrier-specific API formats
 * - Manage accept/reject responses
 * - Coordinate quote collection process
 * 
 * Used AFTER customer has placed order and paid
 */

import axios from 'axios';
import CarrierRepository from '../../repositories/CarrierRepository.js';
import logger from '../../utils/logger.js';
import { calculateDistance, addDays, addHours } from './shippingUtils.js';
import { checkCarrierRejectionReasons } from './carrierValidationService.js';
import { storeQuotes, storeRejections } from './quoteDataService.js';
import { decryptField } from '../../utils/cryptoUtils.js';
import { AppError } from '../../errors/AppError.js';

// Default timeout for outbound carrier API calls when no per-carrier value is set.
// Individual carriers may override this via the `api_timeout_ms` column (see migration 023).
// Hard cap: 45 000 ms — prevents misconfiguration from blocking the event loop.
const DEFAULT_CARRIER_API_TIMEOUT_MS = parseInt(process.env.CARRIER_API_TIMEOUT_MS || '15000', 10);
const MAX_CARRIER_API_TIMEOUT_MS = 45000;

/** Resolve the effective timeout for a carrier row returned from the DB. */
function resolveCarrierTimeout(carrier) {
  const raw = carrier.api_timeout_ms ?? DEFAULT_CARRIER_API_TIMEOUT_MS;
  return Math.min(raw, MAX_CARRIER_API_TIMEOUT_MS);
}

/** Build pending assignment projection used by both portal and final responses. */
function buildPendingAssignments(allActiveCarriers) {
  return allActiveCarriers.map((carrier) => ({
    carrierId: carrier.id,
    carrierName: carrier.name,
  }));
}

/** Return response when no carriers are active at all. */
function buildNoCarriersResponse() {
  return {
    acceptedQuotes: [],
    rejectedCarriers: [],
    pendingAssignments: [],
    totalCarriers: 0,
    acceptanceRate: '0%',
    message: 'No carriers available. Order queued for manual assignment.',
  };
}

/** Return response for portal-only mode when no carrier has push API configured. */
function buildPortalOnlyResponse(allActiveCarriers) {
  return {
    acceptedQuotes: [],
    rejectedCarriers: [],
    pendingAssignments: buildPendingAssignments(allActiveCarriers),
    totalCarriers: allActiveCarriers.length,
    acceptanceRate: '0%',
    message: `Order queued for carrier portal. ${allActiveCarriers.length} carriers can view and accept.`,
  };
}

/** Derive accepted/rejected buckets from Promise.allSettled carrier call outcomes. */
function splitCarrierResults(carrierResults, carriers) {
  const acceptedQuotes = [];
  const rejectedCarriers = [];

  carrierResults.forEach((result, index) => {
    const carrier = carriers[index];

    if (result.status === 'fulfilled') {
      const response = result.value;
      if (response.accepted) {
        acceptedQuotes.push(response.quote);
        logger.info(`Carrier ${carrier.name} ACCEPTED`, {
          price: response.quote.quotedPrice,
          days: response.quote.estimatedDeliveryDays,
        });
        return;
      }

      rejectedCarriers.push({
        carrierName: carrier.name,
        carrierCode: carrier.code,
        reason: response.reason,
        message: response.message,
      });
      logger.warn(`Carrier ${carrier.name} REJECTED`, { reason: response.reason });
      return;
    }

    rejectedCarriers.push({
      carrierName: carrier.name,
      carrierCode: carrier.code,
      reason: 'api_error',
      message: result.reason.message,
    });
    logger.error(`Carrier ${carrier.name} API ERROR`, { error: result.reason.message });
  });

  return { acceptedQuotes, rejectedCarriers };
}

/** Build final quote-collection response shape after carrier fanout completes. */
function buildFinalQuoteResponse(acceptedQuotes, rejectedCarriers, allActiveCarriers) {
  return {
    acceptedQuotes,
    rejectedCarriers,
    pendingAssignments: buildPendingAssignments(allActiveCarriers),
    totalCarriers: allActiveCarriers.length,
    acceptanceRate: allActiveCarriers.length > 0
      ? `${((acceptedQuotes.length / allActiveCarriers.length) * 100).toFixed(1)}%`
      : '0%',
    message: acceptedQuotes.length > 0
      ? `${acceptedQuotes.length} carriers accepted, ${rejectedCarriers.length} rejected`
      : `Order queued for carrier portal. ${allActiveCarriers.length} carriers can view and accept.`,
  };
}

/**
 * Get shipping quotes from all active carriers after order is placed
 * Sends request to all carriers, waits for accept/reject responses
 * 
 * @param {Object} shipmentDetails - Complete shipment details
 * @param {Object} shipmentDetails.origin - Pickup location {lat, lon, address}
 * @param {Object} shipmentDetails.destination - Delivery location {lat, lon, address}
 * @param {Array} shipmentDetails.items - Array of items with actual weight, dimensions
 * @param {String} shipmentDetails.orderId - Order ID for tracking
 * @param {Boolean} shipmentDetails.waitForResponses - Wait for all carriers (default true)
 * @returns {Object} Object with acceptedQuotes and rejectedCarriers
 */
export async function getQuotesFromAllCarriers(shipmentDetails) {
  try {
    const { origin, destination, items, orderId, waitForResponses = true } = shipmentDetails;

    // Calculate total weight and identify special handling requirements
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0);
    const hasFragileItems = items.some(item => item.is_fragile);
    const requiresColdStorage = items.some(item => item.requires_cold_storage);

    // Get all active carriers (prefer those with API endpoints for PUSH model)
    const carriersWithAPI = await CarrierRepository.findActiveWithApiEndpoint();

    // Also get carriers without API (PULL model - they check carrier portal)
    const allActiveCarriers = await CarrierRepository.findAllActive();

    if (allActiveCarriers.length === 0) {
      logger.warn('No active carriers in system at all - order will wait in pending state', { orderId });
      return buildNoCarriersResponse();
    }

    // Use carriers with API endpoints if available (PUSH model)
    // Otherwise, carriers will use portal to pull assignments (PULL model)
    const carriers = carriersWithAPI.length > 0 ? carriersWithAPI : [];
    
    logger.info(`📋 Quote request for order ${orderId}`, {
      origin: origin.address,
      destination: destination.address,
      weight: totalWeight,
      itemCount: items.length,
      totalCarriers: allActiveCarriers.length,
      carriersWithAPI: carriersWithAPI.length,
      mode: carriers.length > 0 ? 'PUSH (API)' : 'PULL (Portal only)'
    });

    // If no carriers have API, return empty - they'll use portal (PULL model)
    if (carriers.length === 0) {
      logger.info(`No carriers with API - order queued for carrier portal (PULL model)`, {
        orderId,
        availableCarriers: allActiveCarriers.length
      });

      return buildPortalOnlyResponse(allActiveCarriers);
    }

    // Send to carriers with API endpoints (PUSH model)
    const carrierPromises = carriers.map(carrier => 
      getCarrierQuoteWithAcceptance(carrier, {
        origin,
        destination,
        totalWeight,
        hasFragileItems,
        requiresColdStorage,
        items,
        orderId
      })
    );

    // Wait for all carriers to respond
    const carrierResults = await Promise.allSettled(carrierPromises);

    const { acceptedQuotes, rejectedCarriers } = splitCarrierResults(carrierResults, carriers);

    // Store all quotes (accepted and rejected) for audit
    if (acceptedQuotes.length > 0) {
      await storeQuotes(acceptedQuotes, orderId);
    }
    
    // Store rejections for analysis
    if (rejectedCarriers.length > 0) {
      await storeRejections(rejectedCarriers, orderId);
    }

    logger.info(`Quote collection complete for order ${orderId}`, {
      accepted: acceptedQuotes.length,
      rejected: rejectedCarriers.length,
      totalCarriers: allActiveCarriers.length
    });

    return buildFinalQuoteResponse(acceptedQuotes, rejectedCarriers, allActiveCarriers);
  } catch (error) {
    logger.error('Error getting real quotes from carriers', { error: error.message });
    throw error;
  }
}

/**
 * Get quote from carrier and check if they accept the shipment
 * Carrier can ACCEPT with quote or REJECT with reason
 * 
 * @param {Object} carrier - Carrier details from database
 * @param {Object} shipmentDetails - Shipment details
 * @returns {Object} Response with accepted flag and quote or reason
 */
export async function getCarrierQuoteWithAcceptance(carrier, shipmentDetails) {
  const { origin, destination, totalWeight, hasFragileItems, requiresColdStorage } = shipmentDetails;
  // Resolve per-carrier timeout (DB value, capped, falling back to env-var default)
  const timeoutMs = resolveCarrierTimeout(carrier);

  try {
    // Carriers might reject for various reasons
    const rejectionReasons = checkCarrierRejectionReasons(carrier, shipmentDetails);
    
    if (rejectionReasons) {
      return {
        accepted: false,
        reason: rejectionReasons.reason,
        message: rejectionReasons.message,
        carrierName: carrier.name,
        carrierCode: carrier.code
      };
    }

    // Carrier accepts - get the quote using its own timeout
    const quote = await getQuoteFromCarrier(carrier, shipmentDetails, timeoutMs);
    
    return {
      accepted: true,
      quote: {
        ...quote,
        status: 'accepted'
      }
    };

  } catch (error) {
    // API errors are treated as rejections
    return {
      accepted: false,
      reason: 'api_error',
      message: error.message,
      carrierName: carrier.name,
      carrierCode: carrier.code
    };
  }
}

/**
 * DEPRECATED: Old method that auto-selected best carrier
 * Use getQuotesFromAllCarriers() instead
 * Kept for backward compatibility
 */
export async function getQuotesFromAllCarriersLegacy(shipmentDetails) {
  try {
    const { origin, destination, items, orderId } = shipmentDetails;

    // Calculate total weight and identify special handling requirements
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0);
    const hasFragileItems = items.some(item => item.is_fragile);
    const requiresColdStorage = items.some(item => item.requires_cold_storage);

    // Get all active carriers
    const carriers = await CarrierRepository.findActiveWithApiEndpoint();

    if (carriers.length === 0) {
      throw new AppError('No active carriers with API configuration found', 503);
    }

    logger.info(`Getting quotes from ${carriers.length} carriers`, {
      origin: origin.address,
      destination: destination.address,
      weight: totalWeight,
      itemCount: items.length
    });

    // Call all carrier APIs in parallel
    const quotePromises = carriers.map(carrier => 
      getQuoteFromCarrier(carrier, {
        origin,
        destination,
        totalWeight,
        hasFragileItems,
        requiresColdStorage,
        items,
        orderId
      })
    );

    // Wait for all quotes (handle failures gracefully)
    const quoteResults = await Promise.allSettled(quotePromises);

    // Filter successful quotes
    const quotes = quoteResults
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);

    // Log failed quotes
    quoteResults
      .filter(result => result.status === 'rejected')
      .forEach(result => {
        logger.error('Failed to get quote from carrier', { error: result.reason });
      });

    // Store all quotes in database
    if (quotes.length > 0) {
      await storeQuotes(quotes, orderId);
    }

    logger.info(`Received ${quotes.length} quotes out of ${carriers.length} carriers`);

    return quotes;
  } catch (error) {
    logger.error('Error getting carrier quotes', { error: error.message });
    throw error;
  }
}

/**
 * Get quote from a specific carrier's API
 * Routes to carrier-specific implementation based on carrier code
 * 
 * @param {Object} carrier - Carrier details from database
 * @param {Object} shipmentDetails - Shipment details
 * @returns {Object} Quote from carrier
 */
export async function getQuoteFromCarrier(carrier, shipmentDetails, timeoutMs) {
  const { origin, destination, totalWeight, hasFragileItems, requiresColdStorage, items } = shipmentDetails;
  // Fall back to resolved default when called directly (e.g. legacy path)
  const effectiveTimeout = timeoutMs ?? resolveCarrierTimeout(carrier);

  try {
    // Different carriers have different API formats
    // This routes to the carrier-specific adapter.
    
    let quote;
    
    switch (carrier.code) {
      case 'DHL':
        quote = await getDHLQuote(carrier, shipmentDetails, effectiveTimeout);
        break;
      case 'FEDEX':
        quote = await getFedExQuote(carrier, shipmentDetails, effectiveTimeout);
        break;
      case 'BLUEDART':
        quote = await getBlueDartQuote(carrier, shipmentDetails, effectiveTimeout);
        break;
      case 'DELHIVERY':
        quote = await getDelhiveryQuote(carrier, shipmentDetails, effectiveTimeout);
        break;
      default:
        quote = await getGenericQuote(carrier, shipmentDetails, effectiveTimeout);
    }

    return {
      carrierId: carrier.id,
      carrierName: carrier.name,
      carrierCode: carrier.code,
      ...quote,
      requestedAt: new Date()
    };
  } catch (error) {
    logger.error(`Error getting quote from ${carrier.name}`, { 
      carrier: carrier.code,
      error: error.message 
    });
    throw new AppError(`${carrier.name}: ${error.message}`, 502);
  }
}

/**
 * Get quote from DHL API
 * Handles DHL-specific API format and response structure
 */
async function getDHLQuote(carrier, shipmentDetails, timeoutMs) {
  const { origin, destination, totalWeight, items } = shipmentDetails;

  // DHL API endpoint (production would use real DHL API)
  const apiUrl = carrier.api_endpoint || 'https://api.dhl.com/mydhlapi/rates';
  
  try {
    // For now, simulate API call with realistic data
    // In production, uncomment and use actual API call:
    /*
    const apiKey = decryptField(carrier.api_key_encrypted); // TASK-R12-014: decrypt before use
    const response = await axios.post(apiUrl, {
      customerDetails: {
        shipperDetails: {
          postalAddress: {
            cityName: origin.address,
            postalCode: origin.postalCode,
            countryCode: 'IN'
          }
        },
        receiverDetails: {
          postalAddress: {
            cityName: destination.address,
            postalCode: destination.postalCode,
            countryCode: 'IN'
          }
        }
      },
      packages: items.map(item => ({
        weight: item.weight,
        dimensions: item.dimensions
      }))
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: timeoutMs   // per-carrier timeout from DB (migration 023)
    });
    */

    // Simulated response for development
    const baseRate = 50 + (totalWeight * 15);
    const estimatedDays = calculateDistance(origin, destination) > 500 ? 2 : 1;

    return {
      quotedPrice: parseFloat(baseRate.toFixed(2)),
      currency: 'INR',
      estimatedDeliveryDays: estimatedDays,
      estimatedDeliveryDate: addDays(new Date(), estimatedDays),
      serviceType: 'EXPRESS',
      validUntil: addHours(new Date(), 24), // DHL quotes valid for 24 hours
      breakdown: {
        baseRate: baseRate * 0.7,
        fuelSurcharge: baseRate * 0.15,
        handlingFee: baseRate * 0.10,
        insurance: baseRate * 0.05
      }
    };
  } catch (error) {
    throw new AppError(`DHL API error: ${error.message}`, 502);
  }
}

/**
 * Get quote from FedEx API
 * Handles FedEx-specific API format and response structure
 */
async function getFedExQuote(carrier, shipmentDetails, timeoutMs) {
  const { origin, destination, totalWeight } = shipmentDetails;

  try {
    // Simulated FedEx pricing
    const baseRate = 45 + (totalWeight * 18);
    const estimatedDays = calculateDistance(origin, destination) > 500 ? 3 : 2;

    return {
      quotedPrice: parseFloat(baseRate.toFixed(2)),
      currency: 'INR',
      estimatedDeliveryDays: estimatedDays,
      estimatedDeliveryDate: addDays(new Date(), estimatedDays),
      serviceType: 'STANDARD',
      validUntil: addHours(new Date(), 48), // FedEx quotes valid for 48 hours
      breakdown: {
        baseRate: baseRate * 0.75,
        fuelSurcharge: baseRate * 0.12,
        handlingFee: baseRate * 0.08,
        insurance: baseRate * 0.05
      }
    };
  } catch (error) {
    throw new AppError(`FedEx API error: ${error.message}`, 502);
  }
}

/**
 * Get quote from Blue Dart API
 * Handles Blue Dart-specific API format and response structure
 */
async function getBlueDartQuote(carrier, shipmentDetails, timeoutMs) {
  const { origin, destination, totalWeight } = shipmentDetails;

  try {
    // Simulated Blue Dart pricing
    const baseRate = 40 + (totalWeight * 12);
    const estimatedDays = calculateDistance(origin, destination) > 500 ? 3 : 2;

    return {
      quotedPrice: parseFloat(baseRate.toFixed(2)),
      currency: 'INR',
      estimatedDeliveryDays: estimatedDays,
      estimatedDeliveryDate: addDays(new Date(), estimatedDays),
      serviceType: 'STANDARD',
      validUntil: addHours(new Date(), 24),
      breakdown: {
        baseRate: baseRate * 0.72,
        fuelSurcharge: baseRate * 0.15,
        handlingFee: baseRate * 0.08,
        insurance: baseRate * 0.05
      }
    };
  } catch (error) {
    throw new AppError(`Blue Dart API error: ${error.message}`, 502);
  }
}

/**
 * Get quote from Delhivery API
 * Handles Delhivery-specific API format and response structure
 */
async function getDelhiveryQuote(carrier, shipmentDetails, timeoutMs) {
  const { origin, destination, totalWeight } = shipmentDetails;

  try {
    // Simulated Delhivery pricing (generally cheaper for domestic)
    const baseRate = 35 + (totalWeight * 10);
    const estimatedDays = calculateDistance(origin, destination) > 500 ? 4 : 2;

    return {
      quotedPrice: parseFloat(baseRate.toFixed(2)),
      currency: 'INR',
      estimatedDeliveryDays: estimatedDays,
      estimatedDeliveryDate: addDays(new Date(), estimatedDays),
      serviceType: 'SURFACE',
      validUntil: addHours(new Date(), 24),
      breakdown: {
        baseRate: baseRate * 0.78,
        fuelSurcharge: baseRate * 0.10,
        handlingFee: baseRate * 0.07,
        insurance: baseRate * 0.05
      }
    };
  } catch (error) {
    throw new AppError(`Delhivery API error: ${error.message}`, 502);
  }
}

/**
 * Generic quote method for carriers without specific implementation
 * Fallback for new carriers not yet implemented
 */
async function getGenericQuote(carrier, shipmentDetails, timeoutMs) {
  const { totalWeight } = shipmentDetails;

  return {
    quotedPrice: parseFloat((50 + totalWeight * 15).toFixed(2)),
    currency: 'INR',
    estimatedDeliveryDays: 3,
    estimatedDeliveryDate: addDays(new Date(), 3),
    serviceType: 'STANDARD',
    validUntil: addHours(new Date(), 24),
    breakdown: {
      baseRate: 0,
      fuelSurcharge: 0,
      handlingFee: 0,
      insurance: 0
    }
  };
}

export default {
  getQuotesFromAllCarriers,
  getCarrierQuoteWithAcceptance,
  getQuotesFromAllCarriersLegacy,
  getQuoteFromCarrier
};
