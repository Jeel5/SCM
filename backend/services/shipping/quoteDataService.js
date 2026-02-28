/**
 * Quote Data Service
 * 
 * Responsibility: Database operations for carrier quotes and rejections
 * - Store accepted quotes in database
 * - Store carrier rejections for analytics
 * - Handle data persistence without business logic
 */

import CarrierRepository from '../../repositories/CarrierRepository.js';
import logger from '../../utils/logger.js';
import { withTransaction } from '../../utils/dbTransaction.js';

/**
 * Store quotes in database for tracking and auditing
 * 
 * @param {Array} quotes - Array of carrier quotes
 * @param {String} orderId - Order ID
 */
export async function storeQuotes(quotes, orderId) {
  try {
    const insertPromises = quotes.map(quote =>
      CarrierRepository.createQuote({
        orderId,
        carrierId: quote.carrierId,
        quotedPrice: quote.quotedPrice,
        currency: quote.currency,
        estimatedDeliveryDays: quote.estimatedDeliveryDays,
        estimatedDeliveryDate: quote.estimatedDeliveryDate,
        serviceType: quote.serviceType,
        validUntil: quote.validUntil,
        breakdown: quote.breakdown,
      })
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
      CarrierRepository.createRejection({
        orderId,
        carrierName: rejection.carrierName,
        carrierCode: rejection.carrierCode,
        reason: rejection.reason,
        message: rejection.message,
      })
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
  // Wrap both UPDATEs in a transaction so the deselect + select pair is atomic.
  // Without this a concurrent call could see an intermediate state where two
  // quotes are selected (or none), breaking carrier assignment logic (TASK-R12-019).
  await withTransaction(async (tx) => {
    // Unmark any previously selected quotes for this order
    await CarrierRepository.deselectAllQuotesForOrder(orderId, tx);

    // Mark the new quote as selected
    await CarrierRepository.selectQuoteById(quoteId, tx);
  });

  logger.info(`Marked quote ${quoteId} as selected for order ${orderId}`);
}

export default {
  storeQuotes,
  storeRejections,
  markQuoteAsSelected
};
