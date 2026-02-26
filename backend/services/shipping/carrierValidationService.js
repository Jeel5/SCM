/**
 * Carrier Validation Service
 * 
 * Responsibility: Validate shipment against carrier constraints
 * - Check carrier rejection reasons
 * - Validate weight limits
 * - Check special handling requirements
 * - Verify route serviceability
 * 
 * Returns rejection reasons or null if carrier accepts
 */

import logger from '../../utils/logger.js';
import { calculateDistance } from './shippingUtils.js';

/**
 * Check if carrier would reject this shipment
 * Returns rejection reason or null if accepted
 * 
 * @param {Object} carrier - Carrier details from database
 * @param {Object} shipmentDetails - Shipment details
 * @returns {Object|null} Rejection object or null if accepted
 */
export function checkCarrierRejectionReasons(carrier, shipmentDetails) {
  const { totalWeight, hasFragileItems, requiresColdStorage, origin, destination } = shipmentDetails;

  // 1. Weight limits
  if (carrier.code === 'DELHIVERY' && totalWeight > 20) {
    return {
      reason: 'weight_exceeded',
      message: `Weight ${totalWeight}kg exceeds maximum capacity of 20kg`
    };
  }

  // 2. Special handling not available
  if (requiresColdStorage && ['DELHIVERY', 'BLUEDART'].includes(carrier.code)) {
    return {
      reason: 'no_cold_storage',
      message: 'Cold storage facility not available'
    };
  }

  // 3. Route serviceability check — use deterministic distance threshold, not random
  const distance = calculateDistance(origin, destination);
  if (distance > 3000 && carrier.code === 'BLUEDART') {
    return {
      reason: 'route_not_serviceable',
      message: 'Long distance route not currently serviceable'
    };
  }

  // 4. Capacity check — use carrier.availability_status from database, not random
  if (carrier.availability_status && carrier.availability_status !== 'available') {
    return {
      reason: 'at_capacity',
      message: `Carrier currently ${carrier.availability_status}. Cannot accept new shipments.`
    };
  }

  // Carrier accepts
  return null;
}

export default {
  checkCarrierRejectionReasons
};
