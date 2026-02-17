/**
 * Carrier Payload Builder
 * 
 * Builds comprehensive request payloads for carrier assignment requests
 * following real-world logistics standards
 */

import deliveryChargeService from './deliveryChargeService.js';
import pool from '../configs/db.js';
import logger from '../utils/logger.js';

class CarrierPayloadBuilder {
  /**
   * Build complete carrier assignment request payload
   * @param {Object} order - Order details from database
   * @param {Array} items - Order items with shipping details
   * @param {Object} warehouse - Pickup warehouse details
   * @param {Object} carrier - Carrier being assigned
   * @param {string} serviceType - express, standard, bulk
   */
  async buildRequestPayload(order, items, warehouse, carrier, serviceType) {
    try {
      // 1. Get warehouse coordinates
      const warehouseDetails = await this.getWarehouseDetails(warehouse);
      
      // 2. Parse delivery address
      const deliveryAddress = typeof order.shipping_address === 'string' 
        ? JSON.parse(order.shipping_address) 
        : order.shipping_address;

      // 3. Calculate shipment dimensions and weight
      const shipmentPhysicals = this.calculateShipmentPhysicals(items);
      
      // 4. Build origin and destination
      const origin = {
        type: 'warehouse',
        warehouseId: warehouse.id || warehouseDetails.id,
        warehouseName: warehouseDetails.name,
        contactPerson: warehouseDetails.contact_person || 'Warehouse Manager',
        contactPhone: warehouseDetails.contact_phone || order.customer_phone,
        address: {
          line1: warehouseDetails.address_line1 || warehouseDetails.address,
          line2: warehouseDetails.address_line2,
          city: warehouseDetails.city,
          state: warehouseDetails.state,
          postalCode: warehouseDetails.postal_code,
          country: warehouseDetails.country || 'India'
        },
        coordinates: {
          lat: warehouseDetails.latitude,
          lon: warehouseDetails.longitude
        }
      };

      const destination = {
        type: 'customer',
        customerName: order.customer_name,
        contactPhone: order.customer_phone,
        contactEmail: order.customer_email,
        address: {
          line1: deliveryAddress.address_line1 || deliveryAddress.street,
          line2: deliveryAddress.address_line2 || deliveryAddress.landmark,
          city: deliveryAddress.city,
          state: deliveryAddress.state,
          postalCode: deliveryAddress.postal_code || deliveryAddress.postalCode || deliveryAddress.pincode,
          country: deliveryAddress.country || 'India'
        },
        coordinates: deliveryAddress.coordinates || {}
      };

      // 5. Calculate estimated delivery charges
      const pricingEstimate = await deliveryChargeService.calculateShippingCost(
        {
          items,
          origin: { ...origin.coordinates, postalCode: origin.address.postalCode },
          destination: { ...destination.coordinates, postalCode: destination.address.postalCode },
          serviceType
        },
        carrier
      );

      // 6. Build detailed items array
      const detailedItems = items.map(item => ({
        // Product identification
        sku: item.sku,
        productName: item.product_name,
        quantity: item.quantity,
        
        // Physical properties
        weight: item.weight, // in kg
        dimensions: item.dimensions || { length: 0, width: 0, height: 0 }, // in cm
        volumetricWeight: item.volumetric_weight,
        
        // Classification
        itemType: item.item_type || 'general',
        isFragile: item.is_fragile || false,
        isHazardous: item.is_hazardous || false,
        isPerishable: item.is_perishable || false,
        requiresColdStorage: item.requires_cold_storage || false,
        
        // Packaging
        packageType: item.package_type || 'box',
        
        // Value
        unitPrice: parseFloat(item.unit_price || 0),
        totalValue: parseFloat((item.unit_price || 0) * item.quantity),
        declaredValue: item.declared_value,
        requiresInsurance: item.requires_insurance || false,
        
        // Special instructions
        handlingInstructions: item.handling_instructions
      }));

      // 7. Determine special handling requirements
      const specialHandling = this.determineSpecialHandling(items);

      // 8. Build complete payload
      const payload = {
        // Assignment metadata
        assignmentId: null, // Will be filled when assignment is created
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        
        // Order information
        order: {
          orderId: order.id,
          orderNumber: order.order_number,
          orderDate: order.created_at,
          priority: order.priority || 'standard',
          totalAmount: parseFloat(order.total_amount),
          currency: order.currency || 'INR'
        },

        // Service requirements
        service: {
          type: serviceType, // express, standard, bulk
          estimatedDeliveryDays: pricingEstimate.estimatedDeliveryDays,
          estimatedDeliveryDate: deliveryChargeService.getEstimatedDeliveryDate(
            pricingEstimate.estimatedDeliveryDays
          ).toISOString()
        },

        // Pickup details
        pickup: origin,

        // Delivery details
        delivery: destination,

        // Shipment physical details
        shipment: {
          totalWeight: shipmentPhysicals.totalWeight,
          totalVolumetricWeight: shipmentPhysicals.totalVolumetricWeight,
          chargeableWeight: shipmentPhysicals.chargeableWeight,
          packageCount: items.length,
          totalVolume: shipmentPhysicals.totalVolume,
          dimensions: shipmentPhysicals.overallDimensions
        },

        // Detailed items
        items: detailedItems,

        // Special handling
        specialHandling,

        // Pricing estimate (what we calculated - carrier can provide their quote)
        estimatedPricing: pricingEstimate,

        // Instructions
        instructions: {
          special: order.notes,
          delivery: deliveryAddress.instructions || 'Please call before delivery'
        },

        // Insurance requirements
        insurance: {
          required: items.some(i => i.requires_insurance || i.requiresInsurance),
          declaredValue: items.reduce((sum, i) => sum + (i.declared_value || 0), 0)
        },

        // Carrier expectations (what we need from them)
        responseRequired: {
          acceptedPrice: true,
          estimatedPickupTime: true,
          estimatedDeliveryTime: true,
          trackingNumber: true,
          carrierReferenceId: true,
          driverDetails: false // Optional
        }
      };

      return payload;
    } catch (error) {
      logger.error('Failed to build carrier request payload', { error: error.message });
      throw error;
    }
  }

  /**
   * Get warehouse details including coordinates
   */
  async getWarehouseDetails(warehouse) {
    if (warehouse && warehouse.id) {
      try {
        const result = await pool.query(
          `SELECT id, code, name, address, address_line1, address_line2, city, state, 
                  postal_code, country, latitude, longitude, contact_person, contact_phone
           FROM warehouses 
           WHERE id = $1`,
          [warehouse.id]
        );
        
        if (result.rows.length > 0) {
          return result.rows[0];
        }
      } catch (error) {
        logger.warn('Could not fetch warehouse details', { error: error.message });
      }
    }

    // Return default warehouse if not found
    return {
      id: warehouse?.id || 'default',
      name: 'Main Warehouse',
      address: 'Warehouse Address',
      address_line1: warehouse?.address || 'Default Address',
      city: 'Mumbai',
      state: 'Maharashtra',
      postal_code: '400001',
      country: 'India',
      latitude: 19.0760,
      longitude: 72.8777
    };
  }

  /**
   * Calculate total shipment physicals
   */
  calculateShipmentPhysicals(items) {
    let totalWeight = 0;
    let totalVolumetricWeight = 0;
    let totalVolume = 0;

    // Track max dimensions for overall package size estimation
    let maxLength = 0;
    let maxWidth = 0;
    let totalHeight = 0;

    for (const item of items) {
      const qty = item.quantity || 1;
      
      totalWeight += (item.weight || 0) * qty;
      totalVolumetricWeight += (item.volumetric_weight || 0) * qty;

      if (item.dimensions) {
        const { length = 0, width = 0, height = 0 } = item.dimensions;
        totalVolume += (length * width * height * qty) / 1000000; // Convert to cubic meters
        
        maxLength = Math.max(maxLength, length);
        maxWidth = Math.max(maxWidth, width);
        totalHeight += height * qty; // Stack height
      }
    }

    return {
      totalWeight,
      totalVolumetricWeight,
      chargeableWeight: Math.max(totalWeight, totalVolumetricWeight),
      totalVolume,
      overallDimensions: {
        length: maxLength,
        width: maxWidth,
        height: totalHeight,
        unit: 'cm'
      }
    };
  }

  /**
   * Determine special handling requirements
   */
  determineSpecialHandling(items) {
    const handling = {
      required: false,
      fragile: false,
      hazardous: false,
      perishable: false,
      coldStorage: false,
      requirements: []
    };

    for (const item of items) {
      if (item.is_fragile || item.isFragile) {
        handling.fragile = true;
        handling.requirements.push('Handle with care - Fragile items');
      }
      
      if (item.is_hazardous || item.isHazardous) {
        handling.hazardous = true;
        handling.requirements.push('Hazardous materials - Special permits required');
      }
      
      if (item.is_perishable || item.isPerishable) {
        handling.perishable = true;
        handling.requirements.push('Perishable goods - Expedited handling required');
      }
      
      if (item.requires_cold_storage || item.requiresColdStorage) {
        handling.coldStorage = true;
        handling.requirements.push('Requires temperature-controlled transport');
      }
    }

    handling.required = handling.fragile || handling.hazardous || 
                        handling.perishable || handling.coldStorage;

    return handling;
  }

  /**
   * Parse and validate carrier acceptance payload
   * This is what carriers should send back when accepting
   */
  parseAcceptancePayload(acceptanceData) {
    return {
      // Carrier's confirmation
      accepted: true,
      acceptedAt: acceptanceData.acceptedAt || new Date().toISOString(),
      
      // Carrier's quote (their actual price vs our estimate)
      pricing: {
        quotedPrice: acceptanceData.quotedPrice || acceptanceData.price,
        currency: acceptanceData.currency || 'INR',
        breakdown: acceptanceData.priceBreakdown || {},
        validUntil: acceptanceData.quoteValidUntil
      },

      // Carrier's delivery commitment
      delivery: {
        estimatedPickupTime: acceptanceData.estimatedPickupTime,
        estimatedDeliveryTime: acceptanceData.estimatedDeliveryTime,
        estimatedDeliveryDate: acceptanceData.estimatedDeliveryDate,
        serviceLevel: acceptanceData.serviceLevel
      },

      // Carrier's tracking information
      tracking: {
        carrierReferenceId: acceptanceData.carrierReferenceId,
        trackingNumber: acceptanceData.trackingNumber,
        trackingUrl: acceptanceData.trackingUrl
      },

      // Driver details (optional)
      driver: acceptanceData.driver ? {
        name: acceptanceData.driver.name,
        phone: acceptanceData.driver.phone,
        vehicleNumber: acceptanceData.driver.vehicleNumber,
        vehicleType: acceptanceData.driver.vehicleType
      } : null,

      // Additional information
      additionalInfo: acceptanceData.additionalInfo || acceptanceData.notes,
      
      // Terms and conditions
      termsAccepted: acceptanceData.termsAccepted || true
    };
  }

  /**
   * Parse carrier rejection payload
   */
  parseRejectionPayload(rejectionData) {
    return {
      accepted: false,
      rejectedAt: rejectionData.rejectedAt || new Date().toISOString(),
      reason: rejectionData.reason || 'Not specified',
      reasonCode: rejectionData.reasonCode, // e.g., 'CAPACITY', 'SERVICE_AREA', 'HAZMAT', 'PRICE'
      message: rejectionData.message || rejectionData.notes,
      alternativeOptions: rejectionData.alternativeOptions || []
    };
  }
}

export default new CarrierPayloadBuilder();
