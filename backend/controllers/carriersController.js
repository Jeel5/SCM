/**
 * carriersController.js
 *
 * Handles carrier webhook callbacks (async accept/reject responses) and
 * quote-status enquiries.  Extracted from routes/carriers.js where it was
 * previously embedded as inline route-handler functions.
 */
import CarrierRepository from '../repositories/CarrierRepository.js';
import logger from '../utils/logger.js';
import { asyncHandler, NotFoundError } from '../errors/index.js';

// ---------------------------------------------------------------------------
// POST /api/carriers/webhook/:carrierId
// ---------------------------------------------------------------------------
/**
 * handleCarrierWebhook
 *
 * Receive an acceptance or rejection from a carrier partner.
 * Carrier systems call this endpoint asynchronously after reviewing a
 * shipment assignment request; they do NOT hold a user JWT so this route
 * is protected by HMAC signature verification (verifyWebhookSignature)
 * rather than standard authentication.
 */
export const handleCarrierWebhook = asyncHandler(async (req, res) => {
  const { carrierId } = req.params;
  const responseData = req.body;

  logger.info('Received carrier webhook', {
    carrier: carrierId,
    orderId: responseData.orderId,
    accepted: responseData.accepted,
  });

  const { orderId, accepted } = responseData;

  // Resolve the carrier row once — needed in both the accept and reject paths.
  const carrier = await CarrierRepository.findByCodeSimple(carrierId);
  if (!carrier) throw new NotFoundError('Carrier');

  const { id: carrierDbId, name: carrierName } = carrier;

  if (accepted) {
    const {
      quotedPrice,
      estimatedDeliveryDays,
      serviceType,
      currency,
      validUntil,
      breakdown,
    } = responseData;

    await CarrierRepository.createQuote({
      orderId,
      carrierId: carrierDbId,
      quotedPrice,
      currency,
      estimatedDeliveryDays,
      serviceType,
      validUntil,
      breakdown,
    });

    logger.info('Stored accepted quote from carrier', {
      carrier: carrierId,
      orderId,
      price: quotedPrice,
    });

    res.json({ success: true, message: 'Quote accepted and stored', data: responseData });
  } else {
    const { reason, message } = responseData;

    await CarrierRepository.createRejection({
      orderId, carrierName, carrierCode: carrierId, reason, message,
    });

    logger.info('Stored rejection from carrier', { carrier: carrierId, orderId, reason });

    res.json({ success: true, message: 'Rejection recorded', data: responseData });
  }
});

// ---------------------------------------------------------------------------
// GET /api/carriers/orders/:orderId/quote-status
// ---------------------------------------------------------------------------
/**
 * getCarrierQuoteStatus
 *
 * Return accepted quotes and rejections recorded for a given order, giving
 * visibility into which carriers have responded and what they offered.
 */
export const getCarrierQuoteStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const [acceptedQuotes, rejections] = await Promise.all([
    CarrierRepository.findQuotesByOrder(orderId),
    CarrierRepository.findRejectionsByOrder(orderId),
  ]);

  res.json({
    orderId,
    acceptedQuotes,
    rejectedCarriers: rejections,
    totalResponses: acceptedQuotes.length + rejections.length,
  });
});
