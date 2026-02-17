/**
 * OSRM Service - Open Source Routing Machine Integration
 * 
 * Calculates actual road distances using OSRM public API
 * Used for Phase 1 shipping cost estimates
 */

import logger from '../utils/logger.js';

class OSRMService {
  constructor() {
    // Use public OSRM API (free, demo-friendly)
    this.baseUrl = process.env.OSRM_URL || 'http://router.project-osrm.org';
    this.timeout = parseInt(process.env.OSRM_TIMEOUT) || 5000; // 5 second timeout
  }

  /**
   * Get driving distance between two points
   * @param {Object} origin - { lat, lon }
   * @param {Object} destination - { lat, lon }
   * @returns {Object} { distanceKm, durationMinutes, success }
   */
  async getDrivingDistance(origin, destination) {
    try {
      // Validate coordinates
      if (!this.validateCoordinates(origin) || !this.validateCoordinates(destination)) {
        throw new Error('Invalid coordinates provided');
      }

      const startTime = Date.now();

      // OSRM API format: /route/v1/driving/{lon,lat};{lon,lat}
      const url = `${this.baseUrl}/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=false`;

      logger.info('🗺️  OSRM Route Calculation Started', {
        origin: { lat: origin.lat, lon: origin.lon },
        destination: { lat: destination.lat, lon: destination.lon }
      });

      // Fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, { 
        signal: controller.signal,
        headers: { 'User-Agent': 'SCM-Project/1.0' }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OSRM API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error(`OSRM routing failed: ${data.code || 'No route found'}`);
      }

      const route = data.routes[0];
      const distanceKm = route.distance / 1000; // Convert meters to km
      const durationMinutes = route.duration / 60; // Convert seconds to minutes
      const latency = Date.now() - startTime;

      logger.info('✅ OSRM Route Calculation Complete', {
        distance: `${distanceKm.toFixed(2)} km`,
        duration: `${durationMinutes.toFixed(0)} minutes`,
        latency: `${latency}ms`,
        method: 'OSRM v5 Public API'
      });

      return {
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        durationMinutes: Math.round(durationMinutes),
        success: true,
        method: 'osrm',
        latency
      };

    } catch (error) {
      logger.error('OSRM routing failed, using Haversine fallback', { 
        error: error.message,
        origin,
        destination
      });

      // Fallback to Haversine with realistic buffer
      const haversineKm = this.calculateHaversineDistance(origin, destination);
      const roadAdjustedKm = haversineKm * 1.25; // 25% buffer for road routing

      return {
        distanceKm: parseFloat(roadAdjustedKm.toFixed(2)),
        durationMinutes: Math.round(roadAdjustedKm / 60), // Estimate: 60 km/h avg
        success: false,
        method: 'haversine_fallback',
        fallbackReason: error.message
      };
    }
  }

  /**
   * Calculate Haversine distance (straight-line) as fallback
   * @param {Object} origin - { lat, lon }
   * @param {Object} destination - { lat, lon }
   * @returns {Number} Distance in km
   */
  calculateHaversineDistance(origin, destination) {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(destination.lat - origin.lat);
    const dLon = this.deg2rad(destination.lon - origin.lon);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(origin.lat)) * Math.cos(this.deg2rad(destination.lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  /**
   * Convert degrees to radians
   */
  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Validate coordinates
   * @param {Object} coords - { lat, lon }
   * @returns {Boolean}
   */
  validateCoordinates(coords) {
    if (!coords || typeof coords.lat !== 'number' || typeof coords.lon !== 'number') {
      return false;
    }
    
    // Latitude: -90 to 90, Longitude: -180 to 180
    if (coords.lat < -90 || coords.lat > 90) {
      return false;
    }
    if (coords.lon < -180 || coords.lon > 180) {
      return false;
    }
    
    return true;
  }

  /**
   * Get estimated delivery time based on distance
   * @param {Number} distanceKm - Distance in kilometers
   * @param {String} serviceType - 'express' | 'standard' | 'economy'
   * @returns {Number} Estimated days
   */
  estimateDeliveryDays(distanceKm, serviceType = 'standard') {
    const speedMap = {
      'express': 800,   // 800 km/day (express delivery)
      'standard': 500,  // 500 km/day (standard delivery)
      'economy': 300    // 300 km/day (economy delivery)
    };

    const kmPerDay = speedMap[serviceType] || speedMap['standard'];
    const days = Math.ceil(distanceKm / kmPerDay);

    // Minimum 1 day for express, 2 days for standard
    if (serviceType === 'express') {
      return Math.max(1, days);
    }
    return Math.max(2, days);
  }
}

export default new OSRMService();
