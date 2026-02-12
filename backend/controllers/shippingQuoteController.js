import carrierRateService from '../services/carrierRateService.js';
import { AppError } from '../errors/index.js';
import logger from '../utils/logger.js';
import db from '../configs/db.js';

/**
 * PHASE 1: Get quick shipping estimate for e-commerce checkout
 * Called BEFORE customer places order to show approximate shipping cost
 * POST /api/shipping/quick-estimate
 */
export const getQuickEstimate = async (req, res, next) => {
  try {
    const { fromPincode, toPincode, weightKg, serviceType } = req.body;

    // Validate required fields
    if (!fromPincode || !toPincode) {
      throw new AppError('Missing required fields: fromPincode, toPincode', 400);
    }

    logger.info('Getting quick shipping estimate', {
      fromPincode,
      toPincode,
      weightKg,
      serviceType
    });

    // Get quick estimate without calling carrier APIs
    const estimate = await carrierRateService.getQuickEstimate({
      fromPincode,
      toPincode,
      weightKg: weightKg || 1,
      serviceType: serviceType || 'standard'
    });

    res.json({
      success: true,
      data: estimate,
      message: 'This is an approximate estimate. Final cost determined after order confirmation.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PHASE 2: Get REAL quotes from ALL carriers after order is placed
 * Called AFTER customer has paid and order is confirmed
 * Sends to all carriers, collects accept/reject responses
 * POST /api/shipping/quotes/real
 */
export const getRealShippingQuotes = async (req, res, next) => {
  try {
    const { origin, destination, items, orderId } = req.body;

    // Validate required fields
    if (!origin || !destination || !items || items.length === 0) {
      throw new AppError('Missing required fields: origin, destination, items', 400);
    }

    // Validate orderId
    if (!orderId) {
      throw new AppError('Order ID is required for real quotes', 400);
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

    logger.info('Getting REAL quotes from all carriers', {
      orderId,
      origin: origin.address,
      destination: destination.address,
      itemCount: items.length
    });

    // Send to ALL carriers and collect responses
    const result = await carrierRateService.getRealQuotesFromAllCarriers({
      origin,
      destination,
      items,
      orderId,
      waitForResponses: true
    });

    const { acceptedQuotes, rejectedCarriers, totalCarriers, acceptanceRate } = result;

    // Check if we have any accepted quotes
    if (acceptedQuotes.length === 0) {
      throw new AppError(
        'No carriers available to ship this order. All carriers rejected or unavailable.',
        503,
        {
          rejections: rejectedCarriers,
          totalCarriers
        }
      );
    }

    // Select best quote from accepted ones
    const bestQuote = carrierRateService.selectBestQuote(acceptedQuotes);

    logger.info('Real quotes collected successfully', {
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
        recommended: bestQuote,
        stats: {
          totalCarriers,
          acceptedCount: acceptedQuotes.length,
          rejectedCount: rejectedCarriers.length,
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
 * DEPRECATED: Old endpoint - use getRealShippingQuotes instead
 * POST /api/shipping/quotes
 */
export const getShippingQuotes = async (req, res, next) => {
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
