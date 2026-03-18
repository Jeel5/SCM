/**
 * Webhook Authentication Middleware
 * Implements HMAC-SHA256 signature verification (Industry Standard)
 * Same pattern used by: Stripe, Shopify, GitHub, Twilio
 */
import crypto from 'crypto';
import carrierRepo from '../repositories/CarrierRepository.js';
import logger from '../utils/logger.js';

function sendWebhookError(res, statusCode, message, error, extra = {}) {
  return res.status(statusCode).json({
    success: false,
    message,
    error,
    ...extra,
  });
}

function buildLogData(req, carrierId, signature, timestamp) {
  return {
    endpoint: req.path,
    method: req.method,
    carrierId,
    hasSignature: !!signature,
    hasTimestamp: !!timestamp,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

async function maybeLogAttempt(logAllAttempts, req, data) {
  if (!logAllAttempts) return;
  await logWebhookAttempt(req, data);
}

function parseTimestampCheck(timestamp, toleranceSec) {
  const requestTimestamp = parseInt(timestamp, 10);
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const timeDifference = Math.abs(currentTimestamp - requestTimestamp);
  return {
    requestTimestamp,
    currentTimestamp,
    timeDifference,
    isWithinTolerance: Number.isFinite(requestTimestamp) && timeDifference <= toleranceSec,
  };
}

function isIpWhitelisted(carrier, ipAddress) {
  if (!carrier.ip_whitelist || !Array.isArray(carrier.ip_whitelist)) {
    return true;
  }
  return carrier.ip_whitelist.includes(ipAddress);
}

function verifyHmacSignature(signature, timestamp, req, webhookSecret) {
  const payload = req.rawBody || JSON.stringify(req.body);
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedPayload)
    .digest('hex');

  const providedSignature = signature.replace('sha256=', '');
  const expectedBuf = Buffer.from(expectedSignature);
  const providedBuf = Buffer.from(providedSignature);

  return {
    expectedSignature,
    providedSignature,
    isValid: expectedBuf.length === providedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, providedBuf),
  };
}

async function rejectWebhook({
  res,
  statusCode,
  message,
  error,
  extra,
  req,
  logAllAttempts,
  attemptLog,
}) {
  await maybeLogAttempt(logAllAttempts, req, attemptLog);
  return sendWebhookError(res, statusCode, message, error, extra);
}

async function ensureRequiredHeaders(context, res, logAllAttempts) {
  if (context.signature && context.timestamp && context.carrierId) {
    return true;
  }

  logger.warn('Webhook authentication failed: Missing headers', context.logData);
  await rejectWebhook({
    res,
    statusCode: 401,
    message: 'Missing required authentication headers',
    error: 'Unauthorized',
    extra: { required: ['x-carrier-id', 'x-webhook-signature', 'x-webhook-timestamp'] },
    req: context.req,
    logAllAttempts,
    attemptLog: {
      carrierId: context.carrierId,
      signatureValid: false,
      errorMessage: 'Missing required headers (signature, timestamp, or carrierId)',
      responseStatus: 401,
    },
  });
  return false;
}

async function ensureTimestampWithinTolerance(context, res, logAllAttempts, timestampToleranceSec) {
  const timestampCheck = parseTimestampCheck(context.timestamp, timestampToleranceSec);
  context.timestampCheck = timestampCheck;

  if (timestampCheck.isWithinTolerance) {
    return true;
  }

  logger.warn('Webhook authentication failed: Timestamp too old', {
    ...context.logData,
    requestTimestamp: timestampCheck.requestTimestamp,
    currentTimestamp: timestampCheck.currentTimestamp,
    timeDifference: timestampCheck.timeDifference,
    tolerance: timestampToleranceSec,
  });

  await rejectWebhook({
    res,
    statusCode: 401,
    message: 'Request timestamp too old or too far in future',
    error: 'Unauthorized',
    extra: { tolerance: `${timestampToleranceSec} seconds` },
    req: context.req,
    logAllAttempts,
    attemptLog: {
      carrierId: context.carrierId,
      signatureValid: false,
      errorMessage: `Timestamp too old (${timestampCheck.timeDifference}s > ${timestampToleranceSec}s tolerance)`,
      responseStatus: 401,
    },
  });
  return false;
}

async function resolveCarrierOrReject(context, res, logAllAttempts) {
  const carrier = await carrierRepo.findByIdWithWebhookConfig(context.carrierId);
  context.carrier = carrier;

  if (!carrier) {
    logger.warn('Webhook authentication failed: Unknown carrier', { ...context.logData, carrierId: context.carrierId });
    await rejectWebhook({
      res,
      statusCode: 401,
      message: 'Unknown carrier',
      error: 'Unauthorized',
      req: context.req,
      logAllAttempts,
      attemptLog: {
        carrierId: context.carrierId,
        signatureValid: false,
        errorMessage: 'Unknown carrier ID',
        responseStatus: 401,
      },
    });
    return false;
  }

  if (!carrier.webhook_enabled) {
    logger.warn('Webhook authentication failed: Webhooks disabled for carrier', {
      ...context.logData,
      carrierId: carrier.id,
      carrierCode: carrier.code,
    });
    await rejectWebhook({
      res,
      statusCode: 403,
      message: 'Webhooks are disabled for this carrier',
      error: 'Forbidden',
      req: context.req,
      logAllAttempts,
      attemptLog: {
        carrierId: carrier.id,
        signatureValid: false,
        errorMessage: 'Webhooks disabled for this carrier',
        responseStatus: 403,
      },
    });
    return false;
  }

  return true;
}

async function ensureIpAllowed(context, res, logAllAttempts) {
  if (isIpWhitelisted(context.carrier, context.req.ip)) {
    return true;
  }

  logger.warn('Webhook authentication failed: IP not whitelisted', {
    ...context.logData,
    requestIp: context.req.ip,
    allowedIps: context.carrier.ip_whitelist,
  });

  await rejectWebhook({
    res,
    statusCode: 403,
    message: 'IP address not authorized',
    error: 'Forbidden',
    req: context.req,
    logAllAttempts,
    attemptLog: {
      carrierId: context.carrier.id,
      signatureValid: false,
      errorMessage: 'IP address not whitelisted',
      responseStatus: 403,
    },
  });
  return false;
}

async function ensureValidSignature(context, res, logAllAttempts) {
  const webhookSecret = context.carrier.webhook_secret;
  if (!webhookSecret) {
    logger.error('Carrier has no webhook secret configured', {
      carrierId: context.carrier.id,
      carrierCode: context.carrier.code,
    });

    sendWebhookError(
      res,
      500,
      'Webhook authentication not configured for this carrier',
      'Internal Server Error'
    );
    return false;
  }

  const signatureCheck = verifyHmacSignature(
    context.signature,
    context.timestamp,
    context.req,
    webhookSecret
  );

  if (signatureCheck.isValid) {
    return true;
  }

  logger.warn('Webhook authentication failed: Invalid signature', {
    ...context.logData,
    carrierId: context.carrier.id,
    carrierCode: context.carrier.code,
    expectedSignature: `${signatureCheck.expectedSignature.substring(0, 10)}...`,
    providedSignature: `${signatureCheck.providedSignature.substring(0, 10)}...`,
  });

  await rejectWebhook({
    res,
    statusCode: 401,
    message: 'Invalid webhook signature',
    error: 'Unauthorized',
    req: context.req,
    logAllAttempts,
    attemptLog: {
      carrierId: context.carrier.id,
      signatureValid: false,
      errorMessage: 'Invalid HMAC signature',
      responseStatus: 401,
    },
  });
  return false;
}

async function authenticateWebhookRequest(req, res, next, { timestampToleranceSec, logAllAttempts }) {
  const startTime = Date.now();
  const signature = req.headers['x-webhook-signature'] || req.headers['x-signature'];
  const timestamp = req.headers['x-webhook-timestamp'] || req.headers['x-timestamp'];
  const carrierId = req.headers['x-carrier-id'] || req.body.carrierId;

  const context = {
    req,
    signature,
    timestamp,
    carrierId,
    logData: buildLogData(req, carrierId, signature, timestamp),
    carrier: null,
    timestampCheck: null,
  };

  if (!await ensureRequiredHeaders(context, res, logAllAttempts)) return;
  if (!await ensureTimestampWithinTolerance(context, res, logAllAttempts, timestampToleranceSec)) return;
  if (!await resolveCarrierOrReject(context, res, logAllAttempts)) return;
  if (!await ensureIpAllowed(context, res, logAllAttempts)) return;
  if (!await ensureValidSignature(context, res, logAllAttempts)) return;

  const processingTime = Date.now() - startTime;
  logger.info('Webhook authenticated successfully', {
    ...context.logData,
    carrierId: context.carrier.id,
    carrierCode: context.carrier.code,
    processingTimeMs: processingTime,
  });

  await maybeLogAttempt(logAllAttempts, req, {
    carrierId: context.carrier.id,
    signatureValid: true,
    responseStatus: 200,
    processingTimeMs: processingTime,
  });

  req.authenticatedCarrier = context.carrier;
  req.webhookTimestamp = context.timestampCheck.requestTimestamp;
  next();
}

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
    try {
      await authenticateWebhookRequest(req, res, next, {
        timestampToleranceSec,
        logAllAttempts,
      });

    } catch (error) {
      logger.error('Webhook authentication error', {
        error: error.message,
        stack: error.stack,
        path: req.path
      });

      return sendWebhookError(res, 500, 'Webhook authentication failed', 'Internal Server Error');
    }
  };
}

/**
 * Log webhook attempt to database for audit trail
 */
async function logWebhookAttempt(req, data) {
  try {
    await carrierRepo.logWebhookAttempt({
      carrierId: data.carrierId || null,
      endpoint: req.path,
      method: req.method,
      requestSignature: req.headers['x-webhook-signature'] || req.headers['x-signature'] || null,
      requestTimestamp: req.headers['x-webhook-timestamp'] || req.headers['x-timestamp'] || null,
      signatureValid: data.signatureValid,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null,
      payload: JSON.stringify(req.body),
      headers: JSON.stringify({
        'content-type': req.headers['content-type'],
        'x-carrier-id': req.headers['x-carrier-id']
      }),
      responseStatus: data.responseStatus,
      errorMessage: data.errorMessage || null,
      processingTimeMs: data.processingTimeMs || null
    });
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
