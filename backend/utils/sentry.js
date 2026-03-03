/**
 * Sentry initialisation.
 *
 * Call initSentry(app) BEFORE any routes.
 * Call sentryErrorHandler() as the FIRST error middleware (before your own errorHandler).
 *
 * Environment variable required:
 *   SENTRY_DSN=https://xxxxx@oXXXX.ingest.sentry.io/XXXXXXX
 *
 * If SENTRY_DSN is absent, Sentry is disabled and all exports become no-ops
 * so local dev / CI without a DSN works fine.
 */
import * as Sentry from '@sentry/node';
import logger from './logger.js';

let initialised = false;

export function initSentry(app) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('Sentry disabled — SENTRY_DSN not set');
    return;
  }

  Sentry.init({
    dsn,
    environment:  process.env.NODE_ENV || 'development',
    release:      process.env.npm_package_version,
    // Capture 100% of transactions in dev, 10% in production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Don't capture 4xx errors as exceptions — those are expected operational errors
    beforeSend(event, hint) {
      const err = hint?.originalException;
      if (err?.statusCode && err.statusCode < 500) return null;
      return event;
    },
    integrations: [
      // Auto-instrument Express routes + HTTP calls
      Sentry.expressIntegration({ app }),
    ],
  });

  initialised = true;
  logger.info('✅ Sentry initialised', { env: process.env.NODE_ENV });
}

/**
 * Express error handler — must be registered BEFORE your own errorHandler.
 * Only active when Sentry was successfully initialised.
 */
export function sentryErrorHandler() {
  if (!initialised) {
    // Return a no-op middleware so the middleware chain stays valid
    return (_err, _req, _res, next) => next(_err);
  }
  return Sentry.expressErrorHandler({
    shouldHandleError(error) {
      // Only report 5xx to Sentry
      return !error.statusCode || error.statusCode >= 500;
    },
  });
}

/**
 * Manually capture an exception (use in catch blocks where you recover
 * but still want visibility in Sentry).
 */
export function captureException(err, context = {}) {
  if (!initialised) return;
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
    Sentry.captureException(err);
  });
}
