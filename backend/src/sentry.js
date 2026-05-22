/**
 * RupeeFast Sentry Error Tracking
 *
 * Integrates Sentry for production error monitoring and performance tracing.
 * Gracefully disabled when SENTRY_DSN is not configured.
 *
 * Usage:
 *   const sentry = require('./sentry');
 *   // In Express setup:
 *   app.use(sentry.requestHandler);
 *   // ... routes ...
 *   app.use(sentry.errorHandler);   // Must be AFTER all routes
 *
 *   // In catch blocks:
 *   sentry.captureError(err, { userId, route: 'login' });
 *   sentry.captureMessage('Unexpected state', 'warning');
 *
 * Configuration (via .env):
 *   SENTRY_DSN=https://xxx@o1.ingest.sentry.io/123456
 *   SENTRY_ENVIRONMENT=production          # default: NODE_ENV
 *   SENTRY_TRACES_SAMPLE_RATE=0.1          # 0.0 - 1.0 (default: 0.1)
 *   SENTRY_PROFILES_SAMPLE_RATE=0.05       # 0.0 - 1.0 (default: disabled)
 */

const logger = require('./logger');

const SENTRY_DSN = process.env.SENTRY_DSN || '';
const IS_ENABLED = !!SENTRY_DSN;

let Sentry = null;
let requestHandler = null;
let errorHandler = null;
let tracingHandler = null;

if (IS_ENABLED) {
  try {
    Sentry = require('@sentry/node');

    const environment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
    const tracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1;
    const profilesSampleRate = parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE) || 0.0;

    Sentry.init({
      dsn: SENTRY_DSN,
      environment,
      release: `rupeefast@${process.env.npm_package_version || process.env.SENTRY_RELEASE || '1.0.0'}`,

      // Performance tracing — capture a percentage of HTTP requests as transactions
      tracesSampleRate: Math.min(Math.max(tracesSampleRate, 0), 1),

      // Profiling (Node.js event loop, CPU-heavy operations)
      profilesSampleRate: profilesSampleRate > 0
        ? Math.min(Math.max(profilesSampleRate, 0), 1)
        : undefined,

      // Attach stack traces to all errors
      attachStacktrace: true,

      // Filter sensitive data before sending to Sentry
      beforeSend(event, hint) {
        // Remove request body for non-GET requests (could contain PII)
        if (event.request?.data && hint?.originalException?.req?.method !== 'GET') {
          event.request.data = '[REDACTED]';
        }
        // Clear cookies from request headers
        if (event.request?.headers) {
          delete event.request.headers['cookie'];
          delete event.request.headers['set-cookie'];
          delete event.request.headers['authorization'];
          delete event.request.headers['x-razorpay-signature'];
        }
        return event;
      },

      // Don't send errors to Sentry in test mode
      enabled: process.env.NODE_ENV !== 'test',

      // Enable default integrations (console, http, onunhandledrejection, etc.)
      // This is the default in v8, but explicit for clarity
      defaultIntegrations: true,
    });

    // Create Express request handler (adds `req.user` context to Sentry scope)
    requestHandler = Sentry.Handlers.requestHandler({
      serverName: true,          // include hostname
      transaction: 'methodPath', // group by method + path pattern
    });

    // Create Express error handler (MUST be registered after all routes)
    errorHandler = Sentry.Handlers.errorHandler({
      shouldHandleError(error) {
        // Only send 5xx errors to Sentry (not client errors like 400/401/403/404)
        return error.statusCode >= 500 || !error.statusCode;
      },
    });

    // Performance tracing handler (creates transactions for each request)
    tracingHandler = Sentry.Handlers.tracingHandler();

    logger.info({ environment, tracesSampleRate }, 'Sentry error tracking initialized');
  } catch (err) {
    Sentry = null;
    requestHandler = null;
    errorHandler = null;
    tracingHandler = null;
    logger.warn({ err: err.message }, 'Failed to initialize Sentry — error tracking disabled');
  }
} else {
  logger.info('Sentry error tracking disabled (set SENTRY_DSN to enable)');
}

// ── No-op handlers when Sentry is disabled ──
if (!requestHandler) {
  requestHandler = (req, res, next) => next();
}
if (!errorHandler) {
  errorHandler = (err, req, res, next) => next(err);
}
if (!tracingHandler) {
  tracingHandler = (req, res, next) => next();
}

/**
 * Capture an error with optional context.
 * Safe to call even when Sentry is disabled.
 *
 * @param {Error} error - The error object
 * @param {object} [context] - Additional context (userId, route, requestId, etc.)
 */
function captureError(error, context = {}) {
  if (!Sentry || !IS_ENABLED) return;

  if (context.userId) {
    Sentry.setUser({ id: String(context.userId) });
  }

  if (Object.keys(context).length > 0) {
    Sentry.setExtras(context);
  }

  Sentry.captureException(error);
}

/**
 * Capture a message with severity level.
 *
 * @param {string} message - The log message
 * @param {'info'|'warning'|'error'} [level='warning'] - Severity
 * @param {object} [context] - Additional data
 */
function captureMessage(message, level = 'warning', context = {}) {
  if (!Sentry || !IS_ENABLED) return;

  const severityMap = {
    info: 'info',
    warning: 'warning',
    error: 'error',
  };

  if (Object.keys(context).length > 0) {
    Sentry.setExtras(context);
  }

  Sentry.captureMessage(message, severityMap[level] || 'warning');
}

/**
 * Check if Sentry is enabled and connected.
 */
function isEnabled() {
  return IS_ENABLED && Sentry !== null;
}

/**
 * Gracefully close Sentry (flush pending events).
 * Call during process shutdown.
 */
async function close() {
  if (Sentry && IS_ENABLED) {
    try {
      await Sentry.close(2000);
      logger.info('Sentry flushed and closed.');
    } catch (err) {
      logger.warn({ err: err.message }, 'Error closing Sentry');
    }
  }
}

module.exports = {
  IS_ENABLED,
  requestHandler,
  errorHandler,
  tracingHandler,
  captureError,
  captureMessage,
  isEnabled,
  close,
};
