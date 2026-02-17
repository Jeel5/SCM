import carrierRateService from '../services/carrierRateService.js';
import * as estimateService from '../services/shipping/estimateService.js';
import { AppError } from '../errors/index.js';
import logger from '../utils/logger.js';
import db from '../configs/db.js';

/**
 * Get quick shipping estimate for e-commerce checkout
 * Called BEFORE customer places order to show approximate shipping cost
 * Uses OSRM routing engine for accurate road distances
 * POST /api/shipping/quick-estimate
 * POST /api/shipping/estimate (alias)
 * 
 * Body: { origin, destination, weightKg, dimensions, serviceType }
 * OR legacy: { fromPincode, toPincode, weightKg, serviceType }
 */
export const getQuickEstimate = async (req, res, next) => {
  try {
    const { 
      origin,          // {lat, lon, postalCode} or {warehouse_id}
      destination,     // {lat, lon, postalCode, address}
      weightKg,        // Total weight in kg
      dimensions,      // {length, width, height} in cm (optional)
      serviceType,     // 'express' | 'standard' | 'economy'
      // Legacy format
      fromPincode,
      toPincode
    } = req.body;

    // Check if using legacy format (pincode-only, no coordinates)
    const isLegacyFormat = fromPincode && toPincode && !origin && !destination;
    
    if (isLegacyFormat) {
      // Legacy format - use simple calculation (no OSRM)
      logger.info('Quick estimate (legacy pincode format)', {
        fromPincode,
        toPincode,
        weightKg: weightKg || 1
      });

      const weight = weightKg || 1;
      const svcType = serviceType || 'standard';
      
      // Simple zone-based calculation
      const baseRate = svcType === 'express' ? 100 : 50;
      const weightRate = weight * 20;
      const estimatedCost = Math.round(baseRate + weightRate);
      
      return res.json({
        success: true,
        data: {
          estimatedCost,
          minCost: Math.round(estimatedCost * 0.85),
          maxCost: Math.round(estimatedCost * 1.15),
          range: `₹${Math.round(estimatedCost * 0.85)} - ₹${Math.round(estimatedCost * 1.15)}`,
          serviceType: svcType,
          estimatedDays: svcType === 'express' ? '1-2' : '3-5',
          message: 'Approximate estimate based on pincode. For accurate estimate, provide coordinates.',
          calculatedAt: new Date(),
          isEstimate: true
        }
      });
    }

    // New format with coordinates - use OSRM
    if (!destination || !destination.lat || !destination.lon) {
      throw new AppError('Destination with lat/lon coordinates is required for accurate estimates', 400);
    }

    // Fetch origin warehouse details if warehouse_id provided
    let originCoords = origin;
    if (origin?.warehouse_id) {
      const warehouseResult = await db.query(
        `SELECT id, name, address, postal_code, 
                latitude as lat, longitude as lon
         FROM warehouses 
         WHERE id = $1`,
        [origin.warehouse_id]
      );
      
      if (warehouseResult.rows.length === 0) {
        throw new AppError('Warehouse not found', 404);
      }
      
      const warehouse = warehouseResult.rows[0];
      originCoords = {
        lat: warehouse.lat,
        lon: warehouse.lon,
        postalCode: warehouse.postal_code,
        address: warehouse.address
      };
    }

    if (!originCoords || !originCoords.lat || !originCoords.lon) {
      throw new AppError('Origin with lat/lon coordinates is required', 400);
    }

    logger.info('Quick estimate with OSRM', {
      origin: originCoords.postalCode || 'N/A',
      destination: destination.postalCode || 'N/A',
      weight: weightKg || 1,
      serviceType: serviceType || 'standard'
    });

    // Call OSRM-based estimate service
    const estimate = await estimateService.getQuickEstimate({
      origin: originCoords,
      destination: destination,
      weightKg: weightKg || 1,
      dimensions: dimensions || null,
      serviceType: serviceType || 'standard'
    });

    res.json({
      success: true,
      data: estimate,
      message: 'Estimate calculated using OSRM routing engine. Final cost determined after carrier confirmation.'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get shipping quotes from all carriers after order is placed
 * Called after customer has paid and order is confirmed
 * Sends to all carriers, collects accept/reject responses
 * POST /api/shipping/quotes
 */
export const getShippingQuotes = async (req, res, next) => {
  try {
    const { origin, destination, items, orderId } = req.body;

    // Validate required fields
    if (!origin || !destination || !items || items.length === 0) {
      throw new AppError('Missing required fields: origin, destination, items', 400);
    }

    // Validate orderId
    if (!orderId) {
      throw new AppError('Order ID is required', 400);
    }

    // Validate origin and destination
    if (!origin.lat || !origin.lon || !origin.address) {
      throw new AppError('Origin must include lat, lon, and address', 400);
    }
    if (!destination.lat || !destination.lon || !destination.address) {
      throw new AppError('Destination must include lat, lon, and address', 400);
    }

    // Validate items have actual measured data
    for (const item of items) {
      if (!item.weight) {
        throw new AppError('Each item must have actual weight (measured at warehouse)', 400);
      }
      if (!item.dimensions) {
        throw new AppError('Each item must have actual dimensions (measured at warehouse)', 400);
      }
    }

    logger.info('Getting quotes from all carriers', {
      orderId,
      origin: origin.address,
      destination: destination.address,
      itemCount: items.length
    });

    // Send to all carriers and collect responses
    const result = await carrierRateService.getQuotesFromAllCarriers({
      origin,
      destination,
      items,
      orderId,
      waitForResponses: true
    });

    const { acceptedQuotes, rejectedCarriers, pendingAssignments, totalCarriers, acceptanceRate, message } = result;

    // Check if we have any accepted quotes
    if (acceptedQuotes.length === 0) {
      // No immediate acceptances - carriers will check portal (PULL model)
      logger.info('No immediate carrier acceptances - quotes pending for carrier portal', {
        orderId,
        pendingAssignments: pendingAssignments?.length || 0,
        rejectedCount: rejectedCarriers.length
      });

      return res.json({
        success: true,
        data: {
          acceptedQuotes: [],
          rejectedCarriers,
          pendingAssignments: pendingAssignments || [],
          recommended: null,
          stats: {
            totalCarriers,
            acceptedCount: 0,
            rejectedCount: rejectedCarriers.length,
            pendingCount: pendingAssignments?.length || 0,
            acceptanceRate: 0
          }
        },
        message: message || `Quote requests sent to ${totalCarriers} carriers. Waiting for carrier acceptance via portal.`
      });
    }

    // Select best quote from accepted ones
    const bestQuote = carrierRateService.selectBestQuote(acceptedQuotes);

    logger.info('Quotes collected successfully', {
      orderId,
      acceptedCount: acceptedQuotes.length,
      rejectedCount: rejectedCarriers.length,
      selectedCarrier: bestQuote.carrierName
    });

    res.json({
      success: true,
      data: {
        acceptedQuotes,
        rejectedCarriers,
        pendingAssignments: pendingAssignments || [],
        recommended: bestQuote,
        stats: {
          totalCarriers,
          acceptedCount: acceptedQuotes.length,
          rejectedCount: rejectedCarriers.length,
          pendingCount: pendingAssignments?.length || 0,
          acceptanceRate
        }
      },
      message: `Received ${acceptedQuotes.length} quotes from carriers. ${rejectedCarriers.length} carriers unavailable.`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DEPRECATED: Old endpoint - use getShippingQuotes instead
 * POST /api/shipping/quotes/legacy
 */
export const getShippingQuotesLegacy = async (req, res, next) => {
  try {
    const { origin, destination, items, orderId } = req.body;

    // Validate required fields
    if (!origin || !destination || !items || items.length === 0) {
      throw new AppError('Missing required fields: origin, destination, items', 400);
    }

    // Validate origin and destination
    if (!origin.lat || !origin.lon || !origin.address) {
      throw new AppError('Origin must include lat, lon, and address', 400);
    }
    if (!destination.lat || !destination.lon || !destination.address) {
      throw new AppError('Destination must include lat, lon, and address', 400);
    }

    // Validate items
    for (const item of items) {
      if (!item.weight) {
        throw new AppError('Each item must have a weight', 400);
      }
    }

    logger.info('Getting shipping quotes', {
      origin: origin.address,
      destination: destination.address,
      itemCount: items.length
    });

    // Get quotes from all carriers
    const quotes = await carrierRateService.getQuotesFromAllCarriers({
      origin,
      destination,
      items,
      orderId
    });

    if (quotes.length === 0) {
      throw new AppError('No carriers available or all carrier APIs failed', 503);
    }

    // Select best quote based on default criteria
    const bestQuote = carrierRateService.selectBestQuote(quotes);

    res.json({
      success: true,
      data: {
        quotes,
        recommended: bestQuote,
        totalQuotes: quotes.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get shipping quotes with custom selection criteria
 * POST /api/shipping/quotes/custom
 */
export const getShippingQuotesWithCriteria = async (req, res, next) => {
  try {
    const { origin, destination, items, orderId, criteria } = req.body;

    // Validate required fields
    if (!origin || !destination || !items || items.length === 0) {
      throw new AppError('Missing required fields: origin, destination, items', 400);
    }

    logger.info('Getting shipping quotes with custom criteria', {
      origin: origin.address,
      destination: destination.address,
      criteria
    });

    // Get quotes from all carriers
    const quotes = await carrierRateService.getQuotesFromAllCarriers({
      origin,
      destination,
      items,
      orderId
    });

    if (quotes.length === 0) {
      throw new AppError('No carriers available or all carrier APIs failed', 503);
    }

    // Select best quote based on custom criteria
    const bestQuote = carrierRateService.selectBestQuote(quotes, criteria);

    res.json({
      success: true,
      data: {
        quotes,
        recommended: bestQuote,
        totalQuotes: quotes.length,
        criteria: criteria || 'default'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get quote from a specific carrier
 * POST /api/shipping/quotes/:carrierId
 */
export const getQuoteFromCarrier = async (req, res, next) => {
  try {
    const { carrierId } = req.params;
    const { origin, destination, items, orderId } = req.body;

    // Validate required fields
    if (!origin || !destination || !items || items.length === 0) {
      throw new AppError('Missing required fields: origin, destination, items', 400);
    }

    logger.info(`Getting quote from carrier ${carrierId}`);

    // Get carrier from database
    const { rows } = await db.query(
      'SELECT * FROM carriers WHERE id = $1 AND is_active = true',
      [carrierId]
    );

    if (rows.length === 0) {
      throw new AppError('Carrier not found or inactive', 404);
    }

    const carrier = rows[0];

    // Calculate shipment details
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0);
    const hasFragileItems = items.some(item => item.is_fragile);
    const requiresColdStorage = items.some(item => item.requires_cold_storage);

    // Get quote from specific carrier
    const quote = await carrierRateService.getQuoteFromCarrier(carrier, {
      origin,
      destination,
      totalWeight,
      hasFragileItems,
      requiresColdStorage,
      items,
      orderId
    });

    // Store the quote
    await carrierRateService.storeQuotes([quote], orderId);

    res.json({
      success: true,
      data: quote
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Select a specific quote for an order
 * POST /api/shipping/quotes/:quoteId/select
 */
export const selectQuote = async (req, res, next) => {
  try {
    const { quoteId } = req.params;
    const { orderId } = req.body;

    if (!orderId) {
      throw new AppError('Order ID is required', 400);
    }

    logger.info(`Selecting quote ${quoteId} for order ${orderId}`);

    // Mark quote as selected
    await carrierRateService.markQuoteAsSelected(quoteId, orderId);

    res.json({
      success: true,
      message: 'Quote selected successfully',
      data: {
        quoteId,
        orderId
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get quotes for an order
 * GET /api/shipping/quotes/order/:orderId
 */
export const getQuotesForOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    logger.info(`Getting quotes for order ${orderId}`);

    const { rows } = await db.query(
      `SELECT cq.*, c.name as carrier_name, c.code as carrier_code
       FROM carrier_quotes cq
       JOIN carriers c ON cq.carrier_id = c.id
       WHERE cq.order_id = $1
       ORDER BY cq.created_at DESC`,
      [orderId]
    );

    const selectedQuote = rows.find(q => q.is_selected);
    const allQuotes = rows;

    res.json({
      success: true,
      data: {
        quotes: allQuotes,
        selected: selectedQuote,
        totalQuotes: allQuotes.length
      }
    });
  } catch (error) {
    next(error);
  }
};
