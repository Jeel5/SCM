/**
 * Delivery Charge Calculation Service
 * 
 * Calculates shipping costs based on:
 * - Weight (actual vs volumetric - whichever is higher)
 * - Distance (zone-based or direct distance)
 * - Service type (express, standard, bulk)
 * - Item type (fragile, hazardous, perishable = surcharges)
 * - Carrier-specific rates
 */

import pool from '../configs/db.js';
import logger from '../utils/logger.js';

class DeliveryChargeService {
  /**
   * Calculate shipping cost for an order
   * @param {Object} shipmentDetails - Contains items, origin, destination, serviceType
   * @param {Object} carrier - Carrier information
   * @returns {Object} Pricing breakdown
   */
  async calculateShippingCost(shipmentDetails, carrier) {
    try {
      const { items, origin, destination, serviceType = 'standard' } = shipmentDetails;

      // 1. Calculate total weight (use higher of actual or volumetric)
      const weightDetails = this.calculateWeight(items);
      
      // 2. Calculate distance between origin and destination
      const distance = this.calculateDistance(origin, destination);
      
      // 3. Determine zone based on distance or pincode
      const zone = this.determineZone(distance, origin.postalCode, destination.postalCode);
      
      // 4. Get base rate for this carrier/zone/service type
      const baseRate = await this.getBaseRate(carrier.id, zone, serviceType);
      
      // 5. Calculate weight-based charges
      const weightCharge = this.calculateWeightCharge(
        weightDetails.chargeableWeight, 
        baseRate
      );
      
      // 6. Calculate special handling surcharges
      const surcharges = this.calculateSurcharges(items, baseRate, weightDetails);
      
      // 7. Calculate fuel surcharge (typically 10-15% of base)
      const fuelSurcharge = (weightCharge + surcharges.total) * (baseRate.fuelSurchargePercent || 0.12);
      
      // 8. Calculate total
      const subtotal = weightCharge + surcharges.total + fuelSurcharge;
      const gst = subtotal * 0.18; // 18% GST in India
      const total = subtotal + gst;

      return {
        breakdown: {
          baseRate: baseRate.ratePerKg,
          chargeableWeight: weightDetails.chargeableWeight,
          actualWeight: weightDetails.actualWeight,
          volumetricWeight: weightDetails.volumetricWeight,
          weightCharge: parseFloat(weightCharge.toFixed(2)),
          surcharges: {
            fragile: parseFloat(surcharges.fragile.toFixed(2)),
            hazardous: parseFloat(surcharges.hazardous.toFixed(2)),
            perishable: parseFloat(surcharges.perishable.toFixed(2)),
            coldStorage: parseFloat(surcharges.coldStorage.toFixed(2)),
            insurance: parseFloat(surcharges.insurance.toFixed(2)),
            total: parseFloat(surcharges.total.toFixed(2))
          },
          fuelSurcharge: parseFloat(fuelSurcharge.toFixed(2)),
          subtotal: parseFloat(subtotal.toFixed(2)),
          gst: parseFloat(gst.toFixed(2)),
          total: parseFloat(total.toFixed(2))
        },
        zone,
        distance: parseFloat(distance.toFixed(2)),
        serviceType,
        estimatedDeliveryDays: this.estimateDeliveryDays(zone, serviceType),
        currency: 'INR'
      };
    } catch (error) {
      logger.error('Failed to calculate shipping cost', { error: error.message });
      throw error;
    }
  }

  /**
   * Calculate chargeable weight (max of actual vs volumetric)
   */
  calculateWeight(items) {
    let totalActualWeight = 0;
    let totalVolumetricWeight = 0;

    for (const item of items) {
      const qty = item.quantity || 1;
      const actualWeight = (item.weight || 0) * qty;
      
      // Calculate volumetric weight: (L × W × H) / 5000
      let volumetricWeight = 0;
      if (item.dimensions) {
        const { length, width, height } = item.dimensions;
        if (length && width && height) {
          volumetricWeight = (length * width * height) / 5000;
        }
      }
      volumetricWeight *= qty;

      totalActualWeight += actualWeight;
      totalVolumetricWeight += volumetricWeight;
    }

    return {
      actualWeight: totalActualWeight,
      volumetricWeight: totalVolumetricWeight,
      chargeableWeight: Math.max(totalActualWeight, totalVolumetricWeight)
    };
  }

  /**
   * Calculate distance using Haversine formula
   */
  calculateDistance(origin, destination) {
    if (!origin.lat || !origin.lon || !destination.lat || !destination.lon) {
      return 500; // Default distance if coordinates not available
    }

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

  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Determine delivery zone based on distance
   */
  determineZone(distance, originPostal, destPostal) {
    // Zone logic (can be customized based on carrier/country)
    if (distance <= 100) return 'local';          // 0-100 km
    if (distance <= 300) return 'regional';       // 100-300 km
    if (distance <= 1000) return 'metro';         // 300-1000 km
    if (distance <= 2000) return 'national';      // 1000-2000 km
    return 'express';                              // > 2000 km
  }

  /**
   * Get base rate from database or use defaults
   */
  async getBaseRate(carrierId, zone, serviceType) {
    try {
      // Try to get rate from rate_cards table
      const result = await pool.query(
        `SELECT base_rate, rate_per_kg, fuel_surcharge_percent, min_charge_amount
         FROM rate_cards
         WHERE carrier_id = $1 AND service_type = $2
         LIMIT 1`,
        [carrierId, serviceType]
      );

      if (result.rows.length > 0) {
        return {
          ratePerKg: parseFloat(result.rows[0].rate_per_kg),
          fuelSurchargePercent: parseFloat(result.rows[0].fuel_surcharge_percent || 0.12),
          minChargeAmount: parseFloat(result.rows[0].min_charge_amount || 50)
        };
      }
    } catch (error) {
      logger.warn('Could not fetch rate from database, using defaults', { error: error.message });
    }

    // Default rates if not in database
    const defaultRates = {
      express: { ratePerKg: 15, fuelSurchargePercent: 0.15, minChargeAmount: 100 },
      standard: { ratePerKg: 10, fuelSurchargePercent: 0.12, minChargeAmount: 50 },
      bulk: { ratePerKg: 7, fuelSurchargePercent: 0.10, minChargeAmount: 30 }
    };

    return defaultRates[serviceType] || defaultRates.standard;
  }

  /**
   * Calculate weight-based charges
   */
  calculateWeightCharge(chargeableWeight, baseRate) {
    const charge = chargeableWeight * baseRate.ratePerKg;
    return Math.max(charge, baseRate.minChargeAmount); // Ensure minimum charge
  }

  /**
   * Calculate special handling surcharges
   */
  calculateSurcharges(items, baseRate, weightDetails) {
    let fragile = 0;
    let hazardous = 0;
    let perishable = 0;
    let coldStorage = 0;
    let insurance = 0;

    for (const item of items) {
      const itemValue = (item.unitPrice || item.unit_price || 0) * (item.quantity || 1);
      
      // Fragile items: 10% surcharge
      if (item.is_fragile || item.isFragile) {
        fragile += itemValue * 0.10;
      }
      
      // Hazardous items: 25% surcharge + compliance fee
      if (item.is_hazardous || item.isHazardous) {
        hazardous += itemValue * 0.25 + 200; // Base hazmat fee
      }
      
      // Perishable items: 15% surcharge
      if (item.is_perishable || item.isPerishable) {
        perishable += itemValue * 0.15;
      }
      
      // Cold storage: 30% surcharge
      if (item.requires_cold_storage || item.requiresColdStorage) {
        coldStorage += itemValue * 0.30;
      }
      
      // Insurance: 2% of declared value
      if (item.requires_insurance || item.requiresInsurance) {
        const declaredValue = item.declared_value || item.declaredValue || itemValue;
        insurance += declaredValue * 0.02;
      }
    }

    const total = fragile + hazardous + perishable + coldStorage + insurance;

    return {
      fragile,
      hazardous,
      perishable,
      coldStorage,
      insurance,
      total
    };
  }

  /**
   * Estimate delivery days based on zone and service type
   */
  estimateDeliveryDays(zone, serviceType) {
    const estimates = {
      express: {
        local: 1,
        regional: 1,
        metro: 2,
        national: 3,
        express: 4
      },
      standard: {
        local: 2,
        regional: 3,
        metro: 5,
        national: 7,
        express: 10
      },
      bulk: {
        local: 3,
        regional: 5,
        metro: 7,
        national: 10,
        express: 15
      }
    };

    return estimates[serviceType]?.[zone] || 5;
  }

  /**
   * Get estimated delivery date
   */
  getEstimatedDeliveryDate(days) {
    const date = new Date();
    
    // Skip weekends (simple version - doesn't account for holidays)
    let addedDays = 0;
    while (addedDays < days) {
      date.setDate(date.getDate() + 1);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
        addedDays++;
      }
    }
    
    return date;
  }
}

export default new DeliveryChargeService();
