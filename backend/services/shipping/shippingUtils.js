/**
 * Shipping Utilities
 * 
 * Responsibility: Shared utility functions for shipping calculations
 * - Distance calculations
 * - Date/time manipulations
 * - Common helper functions
 */

import postalZoneRepo from '../../repositories/PostalZoneRepository.js';
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
export async function estimateDistanceFromPincode(fromPincode, toPincode) {
  try {
    // Primary path: look up both pincodes in the postal_zones table.
    // If lat/lon are populated, use the precise Haversine formula.
    // If only zone_codes are available, fall back to the zone_distances table.
    const rows = await postalZoneRepo.findByPincodes([fromPincode, toPincode]);

    if (rows.length === 2) {
      const fromRow = rows.find(r => r.pincode === fromPincode);
      const toRow   = rows.find(r => r.pincode === toPincode);

      if (fromRow && toRow) {
        // Precise path: lat/lon available
        if (fromRow.lat && fromRow.lon && toRow.lat && toRow.lon) {
          return calculateDistance(
            { lat: parseFloat(fromRow.lat), lon: parseFloat(fromRow.lon) },
            { lat: parseFloat(toRow.lat),   lon: parseFloat(toRow.lon)   }
          );
        }

        // Zone-pair path: query zone_distances
        if (fromRow.zone_code && toRow.zone_code) {
          const distanceKm = await postalZoneRepo.findZoneDistance(fromRow.zone_code, toRow.zone_code);
          if (distanceKm !== null) return distanceKm;
        }
      }
    }
  } catch (err) {
    logger.warn('postal_zones lookup failed, using pincode approximation', { error: err.message });
  }

  // Fallback: first-3-digit pincode prefix approximation
  const fromZone = fromPincode.substring(0, 3);
  const toZone   = toPincode.substring(0, 3);
  if (fromZone === toZone) return 50;
  const zoneDiff = Math.abs(parseInt(fromZone, 10) - parseInt(toZone, 10));
  if (zoneDiff <= 50) return 300;
  return 800;
}

export default {
  calculateDistance,
  addDays,
  addHours,
  estimateDistanceFromPincode
};
