/**
 * Quote Data Service
 * 
 * Responsibility: Database operations for carrier quotes and rejections
 * - Store accepted quotes in database
 * - Store carrier rejections for analytics
 * - Handle data persistence without business logic
 */

import db from '../../configs/db.js';
import logger from '../../utils/logger.js';

/**
 * Store quotes in database for tracking and auditing
 * 
 * @param {Array} quotes - Array of carrier quotes
 * @param {String} orderId - Order ID
 */
export async function storeQuotes(quotes, orderId) {
  try {
    const insertPromises = quotes.map(quote => 
      db.query(
        `INSERT INTO carrier_quotes 
         (order_id, carrier_id, quoted_price, currency, estimated_delivery_days, 
          estimated_delivery_date, service_type, valid_until, breakdown, is_selected)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
         RETURNING id`,
        [
          orderId,
          quote.carrierId,
          quote.quotedPrice,
          quote.currency,
          quote.estimatedDeliveryDays,
          quote.estimatedDeliveryDate,
          quote.serviceType,
          quote.validUntil,
          JSON.stringify(quote.breakdown)
        ]
      )
    );

    await Promise.all(insertPromises);
    logger.info(`Stored ${quotes.length} quotes for order ${orderId}`);
  } catch (error) {
    logger.error('Error storing quotes', { error: error.message });
    // Don't throw - storing quotes is not critical for order flow
  }
}

/**
 * Store carrier rejections for analysis and reporting
 * 
 * @param {Array} rejections - Array of rejection objects
 * @param {String} orderId - Order ID
 */
export async function storeRejections(rejections, orderId) {
  try {
    const insertPromises = rejections.map(rejection =>
      db.query(
        `INSERT INTO carrier_rejections 
         (order_id, carrier_name, carrier_code, reason, message, rejected_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          orderId,
          rejection.carrierName,
          rejection.carrierCode,
          rejection.reason,
          rejection.message
        ]
      )
    );

    await Promise.all(insertPromises);
    logger.info(`Stored ${rejections.length} carrier rejections for order ${orderId}`);
  } catch (error) {
    logger.error('Error storing carrier rejections', { error: error.message });
    // Don't throw - storing rejections is not critical
  }
}

/**
 * Mark a specific quote as selected for an order
 * 
 * @param {String} quoteId - Quote ID to mark as selected
 * @param {String} orderId - Order ID
 */
export async function markQuoteAsSelected(quoteId, orderId) {
  try {
    // Unmark any previously selected quotes for this order
    await db.query(
      'UPDATE carrier_quotes SET is_selected = false WHERE order_id = $1',
      [orderId]
    );

    // Mark the new quote as selected
    await db.query(
      'UPDATE carrier_quotes SET is_selected = true WHERE id = $1',
      [quoteId]
    );

    logger.info(`Marked quote ${quoteId} as selected for order ${orderId}`);
  } catch (error) {
    logger.error('Error marking quote as selected', { error: error.message });
    throw error;
  }
}

export default {
  storeQuotes,
  storeRejections,
  markQuoteAsSelected
};
