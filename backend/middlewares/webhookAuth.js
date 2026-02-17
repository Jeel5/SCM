/**
 * Webhook Authentication Middleware
 * Implements HMAC-SHA256 signature verification (Industry Standard)
 * Same pattern used by: Stripe, Shopify, GitHub, Twilio
 */
import crypto from 'crypto';
import pool from '../configs/db.js';
import logger from '../utils/logger.js';

/**
 * Verify webhook signature using HMAC-SHA256
 * Prevents:
 * - Unauthorized webhook requests
 * - Replay attacks (timestamp validation)
 * - Request tampering (signature mismatch)
 */
export function verifyWebhookSignature(options = {}) {
  const {
    timestampToleranceSec = 300, // 5 minutes
    logAllAttempts = true
  } = options;

  return async (req, res, next) => {
    const startTime = Date.now();
    
    try {
      // Extract authentication headers
      const signature = req.headers['x-webhook-signature'] || req.headers['x-signature'];
      const timestamp = req.headers['x-webhook-timestamp'] || req.headers['x-timestamp'];
      const carrierId = req.headers['x-carrier-id'] || req.body.carrierId;
      
      // Log attempt
      const logData = {
        endpoint: req.path,
        method: req.method,
        carrierId,
        hasSignature: !!signature,
        hasTimestamp: !!timestamp,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      };

      // Validate required headers
      if (!signature || !timestamp || !carrierId) {
        logger.warn('Webhook authentication failed: Missing headers', logData);
        
        if (logAllAttempts) {
          await logWebhookAttempt(req, {
            carrierId,
            signatureValid: false,
            errorMessage: 'Missing required headers (signature, timestamp, or carrierId)',
            responseStatus: 401
          });
        }
        
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Missing required authentication headers',
          required: ['x-carrier-id', 'x-webhook-signature', 'x-webhook-timestamp']
        });
      }

      // Validate timestamp (prevent replay attacks)
      const requestTimestamp = parseInt(timestamp);
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const timeDifference = Math.abs(currentTimestamp - requestTimestamp);

      if (timeDifference > timestampToleranceSec) {
        logger.warn('Webhook authentication failed: Timestamp too old', {
          ...logData,
          requestTimestamp,
          currentTimestamp,
          timeDifference,
          tolerance: timestampToleranceSec
        });

        if (logAllAttempts) {
          await logWebhookAttempt(req, {
            carrierId,
            signatureValid: false,
            errorMessage: `Timestamp too old (${timeDifference}s > ${timestampToleranceSec}s tolerance)`,
            responseStatus: 401
          });
        }

        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Request timestamp too old or too far in future',
          tolerance: `${timestampToleranceSec} seconds`
        });
      }

      // Get carrier's webhook secret from database
      const carrierResult = await pool.query(
        `SELECT id, code, name, webhook_secret, webhook_enabled, ip_whitelist
         FROM carriers 
         WHERE id = $1`,
        [carrierId]
      );

      if (carrierResult.rows.length === 0) {
        logger.warn('Webhook authentication failed: Unknown carrier', { ...logData, carrierId });
        
        if (logAllAttempts) {
          await logWebhookAttempt(req, {
            carrierId,
            signatureValid: false,
            errorMessage: 'Unknown carrier ID',
            responseStatus: 401
          });
        }

        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Unknown carrier'
        });
      }

      const carrier = carrierResult.rows[0];

      // Check if webhooks are enabled for this carrier
      if (!carrier.webhook_enabled) {
        logger.warn('Webhook authentication failed: Webhooks disabled for carrier', {
          ...logData,
          carrierId: carrier.id,
          carrierCode: carrier.code
        });

        if (logAllAttempts) {
          await logWebhookAttempt(req, {
            carrierId: carrier.id,
            signatureValid: false,
            errorMessage: 'Webhooks disabled for this carrier',
            responseStatus: 403
          });
        }

        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'Webhooks are disabled for this carrier'
        });
      }

      // Optional: IP whitelist check
      if (carrier.ip_whitelist && Array.isArray(carrier.ip_whitelist)) {
        if (!carrier.ip_whitelist.includes(req.ip)) {
          logger.warn('Webhook authentication failed: IP not whitelisted', {
            ...logData,
            requestIp: req.ip,
            allowedIps: carrier.ip_whitelist
          });

          if (logAllAttempts) {
            await logWebhookAttempt(req, {
              carrierId: carrier.id,
              signatureValid: false,
              errorMessage: 'IP address not whitelisted',
              responseStatus: 403
            });
          }

          return res.status(403).json({ 
            error: 'Forbidden',
            message: 'IP address not authorized'
          });
        }
      }

      // Verify HMAC signature
      const webhookSecret = carrier.webhook_secret;
      if (!webhookSecret) {
        logger.error('Carrier has no webhook secret configured', {
          carrierId: carrier.id,
          carrierCode: carrier.code
        });

        return res.status(500).json({ 
          error: 'Internal Server Error',
          message: 'Webhook authentication not configured for this carrier'
        });
      }

      // Recreate the signed payload (timestamp.body)
      const payload = JSON.stringify(req.body);
      const signedPayload = `${timestamp}.${payload}`;

      // Calculate expected signature using HMAC-SHA256
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      // Compare signatures using timing-safe comparison
      const providedSignature = signature.replace('sha256=', '');
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(providedSignature)
      );

      if (!isValid) {
        logger.warn('Webhook authentication failed: Invalid signature', {
          ...logData,
          carrierId: carrier.id,
          carrierCode: carrier.code,
          expectedSignature: expectedSignature.substring(0, 10) + '...',
          providedSignature: providedSignature.substring(0, 10) + '...'
        });

        if (logAllAttempts) {
          await logWebhookAttempt(req, {
            carrierId: carrier.id,
            signatureValid: false,
            errorMessage: 'Invalid HMAC signature',
            responseStatus: 401
          });
        }

        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Invalid webhook signature'
        });
      }

      // Success! Signature is valid
      const processingTime = Date.now() - startTime;
      
      logger.info('Webhook authenticated successfully', {
        ...logData,
        carrierId: carrier.id,
        carrierCode: carrier.code,
        processingTimeMs: processingTime
      });

      // Log successful webhook
      if (logAllAttempts) {
        await logWebhookAttempt(req, {
          carrierId: carrier.id,
          signatureValid: true,
          responseStatus: 200,
          processingTimeMs: processingTime
        });
      }

      // Attach carrier info to request for downstream handlers
      req.authenticatedCarrier = carrier;
      req.webhookTimestamp = requestTimestamp;
      
      next();

    } catch (error) {
      logger.error('Webhook authentication error', {
        error: error.message,
        stack: error.stack,
        path: req.path
      });

      return res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Webhook authentication failed'
      });
    }
  };
}

/**
 * Log webhook attempt to database for audit trail
 */
async function logWebhookAttempt(req, data) {
  try {
    await pool.query(
      `INSERT INTO webhook_logs 
       (carrier_id, endpoint, method, request_signature, request_timestamp,
        signature_valid, ip_address, user_agent, payload, headers,
        response_status, error_message, processing_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        data.carrierId || null,
        req.path,
        req.method,
        req.headers['x-webhook-signature'] || req.headers['x-signature'] || null,
        req.headers['x-webhook-timestamp'] || req.headers['x-timestamp'] || null,
        data.signatureValid,
        req.ip,
        req.headers['user-agent'] || null,
        JSON.stringify(req.body),
        JSON.stringify({
          'content-type': req.headers['content-type'],
          'x-carrier-id': req.headers['x-carrier-id']
        }),
        data.responseStatus,
        data.errorMessage || null,
        data.processingTimeMs || null
      ]
    );
  } catch (error) {
    logger.error('Failed to log webhook attempt', { error: error.message });
    // Don't throw - logging failure shouldn't break webhook processing
  }
}

/**
 * Generate webhook signature for outgoing requests
 * Use this when YOU send requests to carrier/supplier APIs
 */
export function generateWebhookSignature(payload, secret, timestamp = null) {
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signedPayload = `${ts}.${payloadString}`;
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  return {
    signature: `sha256=${signature}`,
    timestamp: ts
  };
}

export default {
  verifyWebhookSignature,
  generateWebhookSignature
};
