/**
 * Carrier Webhook Routes
 * 
 * These endpoints receive responses from carrier partners
 * when they accept or reject shipping quotes
 * 
 * NOTE: No authentication required for webhooks (carriers use API keys in production)
 */

import express from 'express';
import db from '../configs/db.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/carriers/webhook/:carrierId
 * Receive acceptance or rejection from carrier partner
 * 
 * This simulates real carrier webhooks where they send
 * async responses after reviewing shipment details
 */
router.post('/carriers/webhook/:carrierId', async (req, res) => {
  try {
    const { carrierId } = req.params;
    const responseData = req.body;
    
    logger.info('Received carrier webhook', {
      carrier: carrierId,
      orderId: responseData.orderId,
      accepted: responseData.accepted
    });
    
    const { orderId, accepted } = responseData;
    
    if (accepted) {
      // Store accepted quote
      const { quotedPrice, estimatedDeliveryDays, serviceType, currency, validUntil, breakdown } = responseData;
      
      // Get carrier ID from database
      const { rows: carriers } = await db.query(
        'SELECT id FROM carriers WHERE code = $1',
        [carrierId]
      );
      
      if (carriers.length === 0) {
        return res.status(404).json({ error: 'Carrier not found' });
      }
      
      const carrierDbId = carriers[0].id;
      
      // Insert quote
      await db.query(
        `INSERT INTO carrier_quotes 
         (order_id, carrier_id, quoted_price, currency, estimated_delivery_days, 
          estimated_delivery_date, service_type, valid_until, breakdown, is_selected)
         VALUES ($1, $2, $3, $4, $5, NOW() + ($5 || ' days')::INTERVAL, $6, $7, $8, false)`,
        [
          orderId,
          carrierDbId,
          quotedPrice,
          currency || 'INR',
          estimatedDeliveryDays,
          serviceType,
          validUntil,
          JSON.stringify(breakdown || {})
        ]
      );
      
      logger.info('Stored accepted quote from carrier', {
        carrier: carrierId,
        orderId,
        price: quotedPrice
      });
      
      res.json({
        success: true,
        message: 'Quote accepted and stored',
        data: responseData
      });
      
    } else {
      // Store rejection
      const { reason, message } = responseData;
      
      await db.query(
        `INSERT INTO carrier_rejections 
         (order_id, carrier_name, carrier_code, reason, message, rejected_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          orderId,
          carrierId,
          carrierId, // Using code as name for demo
          reason,
          message
        ]
      );
      
      logger.info('Stored rejection from carrier', {
        carrier: carrierId,
        orderId,
        reason
      });
      
      res.json({
        success: true,
        message: 'Rejection recorded',
        data: responseData
      });
    }
    
  } catch (error) {
    logger.error('Error processing carrier webhook', { error: error.message });
    res.status(500).json({
      error: 'Failed to process carrier response',
      message: error.message
    });
  }
});

/**
 * GET /api/carriers/orders/:orderId/quote-status
 * Get current status of quote responses for an order
 */
router.get('/carriers/orders/:orderId/quote-status', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Get accepted quotes
    const { rows: acceptedQuotes } = await db.query(
      `SELECT cq.*, c.name as carrier_name, c.code as carrier_code
       FROM carrier_quotes cq
       JOIN carriers c ON c.id = cq.carrier_id
       WHERE cq.order_id = $1`,
      [orderId]
    );
    
    // Get rejections
    const { rows: rejections } = await db.query(
      `SELECT * FROM carrier_rejections WHERE order_id = $1`,
      [orderId]
    );
    
    res.json({
      orderId,
      acceptedQuotes,
      rejectedCarriers: rejections,
      totalResponses: acceptedQuotes.length + rejections.length
    });
    
  } catch (error) {
    logger.error('Error getting quote status', { error: error.message });
    res.status(500).json({
      error: 'Failed to get quote status',
      message: error.message
    });
  }
});

export default router;
