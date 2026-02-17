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
import db from '../../configs/db.js';
import logger from '../../utils/logger.js';
import { calculateDistance, addDays, addHours } from './shippingUtils.js';
import { checkCarrierRejectionReasons } from './carrierValidationService.js';
import { storeQuotes, storeRejections } from './quoteDataService.js';

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
    const { rows: carriersWithAPI } = await db.query(
      `SELECT id, name, code, api_endpoint, api_key_encrypted, is_active, availability_status
       FROM carriers 
       WHERE is_active = true AND api_endpoint IS NOT NULL`
    );

    // Also get carriers without API (PULL model - they check carrier portal)
    const { rows: allActiveCarriers } = await db.query(
      `SELECT id, name, code, api_endpoint, api_key_encrypted, is_active, availability_status
       FROM carriers 
       WHERE is_active = true`
    );

    if (allActiveCarriers.length === 0) {
      logger.warn('No active carriers in system at all - order will wait in pending state', { orderId });
      return {
        acceptedQuotes: [],
        rejectedCarriers: [],
        pendingAssignments: [],
        totalCarriers: 0,
        acceptanceRate: '0%',
        message: 'No carriers available. Order queued for manual assignment.'
      };
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
      
      return {
        acceptedQuotes: [],
        rejectedCarriers: [],
        pendingAssignments: allActiveCarriers.map(c => ({ carrierId: c.id, carrierName: c.name })),
        totalCarriers: allActiveCarriers.length,
        acceptanceRate: '0%',
        message: `Order queued for carrier portal. ${allActiveCarriers.length} carriers can view and accept.`
      };
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

    // Separate accepted and rejected quotes
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
            days: response.quote.estimatedDeliveryDays
          });
        } else {
          rejectedCarriers.push({
            carrierName: carrier.name,
            carrierCode: carrier.code,
            reason: response.reason,
            message: response.message
          });
          logger.warn(`Carrier ${carrier.name} REJECTED`, { reason: response.reason });
        }
      } else {
        // API error
        rejectedCarriers.push({
          carrierName: carrier.name,
          carrierCode: carrier.code,
          reason: 'api_error',
          message: result.reason.message
        });
        logger.error(`Carrier ${carrier.name} API ERROR`, { error: result.reason.message });
      }
    });

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

    return {
      acceptedQuotes,
      rejectedCarriers,
      pendingAssignments: allActiveCarriers.map(c => ({ carrierId: c.id, carrierName: c.name })),
      totalCarriers: allActiveCarriers.length,
      acceptanceRate: allActiveCarriers.length > 0 
        ? ((acceptedQuotes.length / allActiveCarriers.length) * 100).toFixed(1) + '%' 
        : '0%',
      message: acceptedQuotes.length > 0
        ? `${acceptedQuotes.length} carriers accepted, ${rejectedCarriers.length} rejected`
        : `Order queued for carrier portal. ${allActiveCarriers.length} carriers can view and accept.`
    };
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

    // Carrier accepts - get the quote
    const quote = await getQuoteFromCarrier(carrier, shipmentDetails);
    
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
    const { rows: carriers } = await db.query(
      `SELECT id, name, code, api_endpoint, api_key_encrypted, is_active
       FROM carriers 
       WHERE is_active = true AND api_endpoint IS NOT NULL`
    );

    if (carriers.length === 0) {
      throw new Error('No active carriers with API configuration found');
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
export async function getQuoteFromCarrier(carrier, shipmentDetails) {
  const { origin, destination, totalWeight, hasFragileItems, requiresColdStorage, items } = shipmentDetails;

  try {
    // Different carriers have different API formats
    // This routes to specific adapter for each carrier
    
    let quote;
    
    switch (carrier.code) {
      case 'DHL':
        quote = await getDHLQuote(carrier, shipmentDetails);
        break;
      case 'FEDEX':
        quote = await getFedExQuote(carrier, shipmentDetails);
        break;
      case 'BLUEDART':
        quote = await getBlueDartQuote(carrier, shipmentDetails);
        break;
      case 'DELHIVERY':
        quote = await getDelhiveryQuote(carrier, shipmentDetails);
        break;
      default:
        quote = await getGenericQuote(carrier, shipmentDetails);
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
    throw new Error(`${carrier.name}: ${error.message}`);
  }
}

/**
 * Get quote from DHL API
 * Handles DHL-specific API format and response structure
 */
async function getDHLQuote(carrier, shipmentDetails) {
  const { origin, destination, totalWeight, items } = shipmentDetails;

  // DHL API endpoint (production would use real DHL API)
  const apiUrl = carrier.api_endpoint || 'https://api.dhl.com/mydhlapi/rates';
  
  try {
    // For now, simulate API call with realistic data
    // In production, uncomment and use actual API call:
    /*
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
        'Authorization': `Bearer ${carrier.api_key_encrypted}`,
        'Content-Type': 'application/json'
      }
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
    throw new Error(`DHL API error: ${error.message}`);
  }
}

/**
 * Get quote from FedEx API
 * Handles FedEx-specific API format and response structure
 */
async function getFedExQuote(carrier, shipmentDetails) {
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
    throw new Error(`FedEx API error: ${error.message}`);
  }
}

/**
 * Get quote from Blue Dart API
 * Handles Blue Dart-specific API format and response structure
 */
async function getBlueDartQuote(carrier, shipmentDetails) {
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
    throw new Error(`Blue Dart API error: ${error.message}`);
  }
}

/**
 * Get quote from Delhivery API
 * Handles Delhivery-specific API format and response structure
 */
async function getDelhiveryQuote(carrier, shipmentDetails) {
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
    throw new Error(`Delhivery API error: ${error.message}`);
  }
}

/**
 * Generic quote method for carriers without specific implementation
 * Fallback for new carriers not yet implemented
 */
async function getGenericQuote(carrier, shipmentDetails) {
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
