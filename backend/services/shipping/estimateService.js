/**
 * Estimate Service
 * 
 * Responsibility: Phase 1 quick shipping cost estimates for e-commerce checkout
 * - Uses OSRM routing engine for accurate road distances
 * - Calculate costs based on actual road distance and weight
 * - Provide range estimates to account for carrier variations
 * 
 * Used BEFORE customer places order and pays
 */

import logger from '../../utils/logger.js';
import osrmService from '../osrmService.js';

/**
 * Get quick shipping estimate for e-commerce checkout
 * Uses OSRM for accurate road distance calculation
 * 
 * @param {Object} estimateData - Shipping info with coordinates
 * @param {Object} estimateData.origin - { lat, lon, postalCode }
 * @param {Object} estimateData.destination - { lat, lon, postalCode }
 * @param {Number} estimateData.weightKg - Weight from product catalog
 * @param {Object} estimateData.dimensions - { length, width, height } in cm
 * @param {String} estimateData.serviceType - 'express' | 'standard' | 'economy'
 * @returns {Object} Quick estimate with OSRM-calculated distance
 */
export async function getQuickEstimate(estimateData) {
  try {
    const { 
      origin, 
      destination, 
      weightKg = 1, 
      dimensions = null,
      serviceType = 'standard' 
    } = estimateData;

    // Calculate volumetric weight if dimensions provided
    let volumetricWeight = 0;
    if (dimensions && dimensions.length && dimensions.width && dimensions.height) {
      volumetricWeight = (dimensions.length * dimensions.width * dimensions.height) / 5000;
    }

    // Billable weight is max of actual vs volumetric
    const billableWeight = Math.max(weightKg, volumetricWeight);

    logger.info('Getting quick shipping estimate with OSRM', { 
      origin: origin.postalCode || 'N/A',
      destination: destination.postalCode || 'N/A',
      billableWeight,
      serviceType
    });

    // Get actual road distance from OSRM
    const routeResult = await osrmService.getDrivingDistance(origin, destination);
    const distance = routeResult.distanceKm;

    // Calculate cost based on distance and weight
    const baseRate = serviceType === 'express' ? 100 : 50;
    
    // Distance-based pricing (zones)
    let distanceRate = 0;
    if (distance <= 100) distanceRate = 30;        // Local: 0-100 km
    else if (distance <= 300) distanceRate = 80;   // Regional: 100-300 km
    else if (distance <= 1000) distanceRate = 150; // Metro: 300-1000 km
    else if (distance <= 2000) distanceRate = 250; // National: 1000-2000 km
    else distanceRate = 400;                        // Long distance: >2000 km

    // Weight-based pricing
    const weightRate = billableWeight * 15;

    // Total estimate
    const estimatedCost = Math.round(baseRate + distanceRate + weightRate);
    
    // Provide range (15% buffer for carrier variations)
    const minCost = Math.round(estimatedCost * 0.85);
    const maxCost = Math.round(estimatedCost * 1.15);

    // Estimate delivery days using OSRM distance
    const estimatedDays = osrmService.estimateDeliveryDays(distance, serviceType);

    logger.info('✅ Quick estimate calculated with OSRM', {
      distance: `${distance} km`,
      method: routeResult.method,
      estimatedCost,
      range: `${minCost}-${maxCost}`,
      billableWeight
    });

    return {
      estimatedCost,
      minCost,
      maxCost,
      range: `₹${minCost} - ₹${maxCost}`,
      serviceType,
      distance,
      billableWeight,
      volumetricWeight: volumetricWeight > 0 ? volumetricWeight : null,
      estimatedDays,
      estimatedDaysRange: serviceType === 'express' ? '1-2' : `${estimatedDays}-${estimatedDays + 1}`,
      routingEngine: 'OSRM',
      routingMethod: routeResult.method,
      message: 'Estimate based on OSRM routing. Final cost determined after carrier confirmation.',
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
