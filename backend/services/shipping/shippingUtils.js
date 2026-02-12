/**
 * Shipping Utilities
 * 
 * Responsibility: Shared utility functions for shipping calculations
 * - Distance calculations
 * - Date/time manipulations
 * - Common helper functions
 */

import logger from '../../utils/logger.js';

/**
 * Calculate approximate distance between two coordinates (in km)
 * Uses simple Haversine formula
 * 
 * @param {Object} origin - Origin coordinates {lat, lon}
 * @param {Object} destination - Destination coordinates {lat, lon}
 * @returns {Number} Distance in kilometers
 */
export function calculateDistance(origin, destination) {
  const R = 6371; // Earth's radius in km

  const lat1 = origin.lat * Math.PI / 180;
  const lat2 = destination.lat * Math.PI / 180;
  const deltaLat = (destination.lat - origin.lat) * Math.PI / 180;
  const deltaLon = (destination.lon - origin.lon) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Add days to a date
 * 
 * @param {Date} date - Base date
 * @param {Number} days - Number of days to add
 * @returns {Date} New date with days added
 */
export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add hours to a date
 * 
 * @param {Date} date - Base date
 * @param {Number} hours - Number of hours to add
 * @returns {Date} New date with hours added
 */
export function addHours(date, hours) {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

/**
 * Estimate distance from pincode (simplified zone-based)
 * In production, use pincode database with lat/long
 * 
 * @param {String} fromPincode - Pickup pincode
 * @param {String} toPincode - Delivery pincode
 * @returns {Number} Estimated distance in km
 */
export function estimateDistanceFromPincode(fromPincode, toPincode) {
  // Get first 3 digits to determine zone
  const fromZone = fromPincode.substring(0, 3);
  const toZone = toPincode.substring(0, 3);

  // Same zone
  if (fromZone === toZone) {
    return 50; // Within city/region
  }

  // Adjacent zones (simplified)
  const zoneDiff = Math.abs(parseInt(fromZone) - parseInt(toZone));
  if (zoneDiff <= 50) {
    return 300; // Regional
  }

  // Different regions
  return 800; // Inter-regional
}

export default {
  calculateDistance,
  addDays,
  addHours,
  estimateDistanceFromPincode
};
