/**
 * Carrier Rate Service - Main facade for shipping quote operations
 * 
 * REFACTORED: This service now delegates to specialized modules:
 * - estimateService: Phase 1 quick estimates
 * - carrierQuoteService: Phase 2 real carrier quotes
 * - carrierSelectionService: Best quote selection
 * - quoteDataService: Database operations
 * - shippingUtils: Utility functions
 * 
 * TWO-PHASE QUOTING SYSTEM:
 * Phase 1: Quick Estimate (for e-commerce checkout before payment)
 * Phase 2: Real Quote (after order placed, sends to ALL carriers)
 * 
 * This class maintains backward compatibility with existing controllers
 * while delegating all logic to specialized, testable modules.
 */

import logger from '../utils/logger.js';
import * as estimateService from './shipping/estimateService.js';
import * as carrierQuoteService from './shipping/carrierQuoteService.js';
import * as carrierSelectionService from './shipping/carrierSelectionService.js';
import * as quoteDataService from './shipping/quoteDataService.js';
import * as shippingUtils from './shipping/shippingUtils.js';

class CarrierRateService {
  
  /**
   * PHASE 1: Get quick shipping estimate for e-commerce checkout
   * Delegates to estimateService
   */
  async getQuickEstimate(estimateData) {
    try {
      return await estimateService.getQuickEstimate(estimateData);
    } catch (error) {
      logger.error('Error in getQuickEstimate', { error: error.message });
      throw error;
    }
  }

  /**
   * Get quotes from all active carriers after order is placed
   * Delegates to carrierQuoteService
   */
  async getQuotesFromAllCarriers(shipmentDetails) {
    try {
      return await carrierQuoteService.getQuotesFromAllCarriers(shipmentDetails);
    } catch (error) {
      logger.error('Error in getQuotesFromAllCarriers', { error: error.message });
      throw error;
    }
  }

  /**
   * Get quote from carrier and check if they accept the shipment
   * Delegates to carrierQuoteService
   */
  async getCarrierQuoteWithAcceptance(carrier, shipmentDetails) {
    try {
      return await carrierQuoteService.getCarrierQuoteWithAcceptance(carrier, shipmentDetails);
    } catch (error) {
      logger.error('Error in getCarrierQuoteWithAcceptance', { error: error.message });
      throw error;
    }
  }

  /**
   * DEPRECATED: Old method that gets quotes from all carriers
   * Use getQuotesFromAllCarriers() instead
   * Kept for backward compatibility
   */
  async getQuotesFromAllCarriersLegacy(shipmentDetails) {
    try {
      return await carrierQuoteService.getQuotesFromAllCarriersLegacy(shipmentDetails);
    } catch (error) {
      logger.error('Error in getQuotesFromAllCarriersLegacy', { error: error.message });
      throw error;
    }
  }

  /**
   * Get quote from a specific carrier's API
   * Delegates to carrierQuoteService
   */
  async getQuoteFromCarrier(carrier, shipmentDetails) {
    try {
      return await carrierQuoteService.getQuoteFromCarrier(carrier, shipmentDetails);
    } catch (error) {
      logger.error('Error in getQuoteFromCarrier', { error: error.message });
      throw error;
    }
  }

  /**
   * Store carrier quotes in database
   * Delegates to quoteDataService
   */
  async storeQuotes(quotes, orderId) {
    try {
      return await quoteDataService.storeQuotes(quotes, orderId);
    } catch (error) {
      logger.error('Error in storeQuotes', { error: error.message });
      throw error;
    }
  }

  /**
   * Store carrier rejections in database
   * Delegates to quoteDataService
   */
  async storeRejections(rejections, orderId) {
    try {
      return await quoteDataService.storeRejections(rejections, orderId);
    } catch (error) {
      logger.error('Error in storeRejections', { error: error.message });
      throw error;
    }
  }

  /**
   * Mark a quote as selected for an order
   * Delegates to quoteDataService
   */
  async markQuoteAsSelected(quoteId, orderId) {
    try {
      return await quoteDataService.markQuoteAsSelected(quoteId, orderId);
    } catch (error) {
      logger.error('Error in markQuoteAsSelected', { error: error.message });
      throw error;
    }
  }

  /**
   * Select the best quote from available quotes
   * Delegates to carrierSelectionService
   */
  selectBestQuote(quotes, criteria = {}) {
    try {
      return carrierSelectionService.selectBestQuote(quotes, criteria);
    } catch (error) {
      logger.error('Error in selectBestQuote', { error: error.message });
      throw error;
    }
  }

  /**
   * Get carrier reliability score
   * Delegates to carrierSelectionService
   */
  getCarrierReliabilityScore(carrierCode) {
    return carrierSelectionService.getCarrierReliabilityScore(carrierCode);
  }

  /**
   * Calculate distance between two points using Haversine formula
   * Delegates to shippingUtils
   */
  calculateDistance(origin, destination) {
    return shippingUtils.calculateDistance(origin, destination);
  }

  /**
   * Add days to a date
   * Delegates to shippingUtils
   */
  addDays(date, days) {
    return shippingUtils.addDays(date, days);
  }

  /**
   * Add hours to a date
   * Delegates to shippingUtils
   */
  addHours(date, hours) {
    return shippingUtils.addHours(date, hours);
  }

  /**
   * Estimate distance from pincode (simplified zone-based)
   * Delegates to shippingUtils
   */
  estimateDistanceFromPincode(fromPincode, toPincode) {
    return shippingUtils.estimateDistanceFromPincode(fromPincode, toPincode);
  }
}

export default new CarrierRateService();
