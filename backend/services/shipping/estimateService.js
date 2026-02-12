/**
 * Estimate Service
 * 
 * Responsibility: Phase 1 quick shipping cost estimates for e-commerce checkout
 * - Generate fast estimates without calling carrier APIs
 * - Calculate approximate costs based on pincode zones
 * - Provide conservative estimates to avoid losses
 * 
 * Used BEFORE customer places order and pays
 */

import logger from '../../utils/logger.js';
import { estimateDistanceFromPincode } from './shippingUtils.js';

/**
 * Get quick shipping estimate for e-commerce checkout
 * Uses approximate data before customer pays
 * 
 * @param {Object} estimateData - Basic shipping info
 * @param {String} estimateData.fromPincode - Pickup pincode
 * @param {String} estimateData.toPincode - Delivery pincode
 * @param {Number} estimateData.weightKg - Approximate weight from product catalog
 * @param {String} estimateData.serviceType - 'standard' or 'express'
 * @returns {Object} Quick estimate without calling carrier APIs
 */
export async function getQuickEstimate(estimateData) {
  try {
    const { fromPincode, toPincode, weightKg = 1, serviceType = 'standard' } = estimateData;

    logger.info('Getting quick shipping estimate', { fromPincode, toPincode, weightKg });

    // Calculate approximate distance based on pincode zones
    const distance = estimateDistanceFromPincode(fromPincode, toPincode);

    // Use cached rates or simple calculation (no API calls)
    // This is FAST and doesn't burden carrier APIs
    const baseRate = serviceType === 'express' ? 100 : 50;
    const distanceRate = distance > 500 ? 30 : 15;
    const weightRate = weightKg * 20;

    // Conservative estimate (slightly higher to avoid loss)
    const estimatedCost = Math.round(baseRate + distanceRate + weightRate);
    const minCost = Math.round(estimatedCost * 0.8); // 20% lower
    const maxCost = Math.round(estimatedCost * 1.2); // 20% higher

    logger.info('Quick estimate calculated', {
      estimatedCost,
      range: `${minCost}-${maxCost}`,
      distance
    });

    return {
      estimatedCost,
      minCost,
      maxCost,
      range: `${minCost}-${maxCost}`,
      serviceType,
      estimatedDays: serviceType === 'express' ? '1-2' : '3-5',
      message: 'Approximate estimate. Actual cost determined after order confirmation.',
      calculatedAt: new Date(),
      isEstimate: true
    };
  } catch (error) {
    logger.error('Error calculating quick estimate', { error: error.message });
    throw error;
  }
}

export default {
  getQuickEstimate
};
