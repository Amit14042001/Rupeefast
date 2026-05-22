/**
 * RupeeFast Audit Logging Middleware
 *
 * Logs all sensitive operations to the `audit_logs` table for compliance,
 * fraud investigation, and debugging.
 *
 * Each audit entry captures:
 *   - Who (user_id, role)
 *   - What (action, resource_type, resource_id)
 *   - When (timestamp)
 *   - Where (ip_address, user_agent)
 *   - Context (metadata JSON — request body, previous state, etc.)
 *
 * Usage:
 *   const audit = require('./audit');
 *
 *   // As middleware (auto-captures from req):
 *   app.post('/api/kyc/submit', authMiddleware, audit('kyc.submit', 'kyc_record'), handler);
 *
 *   // Programmatic:
 *   await audit.log({ userId, action: 'loan.disburse', resourceType: 'loan', resourceId: loanId, metadata: { amount } });
 */

const logger = require('./logger');

// ── Sensitive actions that should always be logged ──
// These are used to ensure we don't miss critical events.

const SENSITIVE_ACTIONS = new Set([
  'auth.login',
  'auth.otp.send',
  'auth.otp.verify',
  'auth.logout',
  'loan.apply',
  'loan.disburse',
  'kyc.submit',
  'kyc.verify',
  'kyc.reject',
  'payment.mandate.create',
  'payment.mandate.cancel',
  'payment.mandate.pause',
  'payment.mandate.resume',
  'payment.verify',
  'payment.withdraw',
  'user.profile.update',
  'user.role.change',
  'agent.collect',
  'agent.verify',
  'admin.user.impersonate',
  'admin.user.suspend',
  'admin.loan.modify',
  'admin.kyc.override',
  'admin.notifications.broadcast',
  'admin.notifications.broadcast.schedule',
  'admin.loan.review.credit',
  'admin.loan.review.risk',
  'admin.loan.review.document',
  'admin.loan.approve',
  'admin.loan.reject',
  'admin.notifications.broadcast.cancel',
  'admin.api-key.create',
  'admin.api-key.rotate',
  'admin.api-key.revoke',
  'admin.webhook.replay',
  'admin.service.check',
  'admin.integration.update',
  'admin.integration.enable',
  'admin.integration.disable',
  'admin.investor.allocation.approve',
  'admin.investor.allocation.reject',
  'admin.investor.allocation.execute',
  'admin.investor.note',
]);

// ══════════════════════════════════════════════════
// MAIN LOG FUNCTION
// ══════════════════════════════════════════════════

/**
 * Log an audit event to the database.
 *
 * @param {object} options
 * @param {number} options.userId - The user performing the action
 * @param {string} options.action - The action being performed (dot-notation)
 * @param {string} [options.resourceType] - Type of resource being acted upon
 * @param {string|number} [options.resourceId] - ID of the resource
 * @param {object} [options.metadata] - Additional context (request body, previous state, etc.)
 * @param {string} [options.ipAddress] - Client IP address
 * @param {string} [options.userAgent] - User agent string
 * @param {string} [options.role] - User's role at time of action
 * @returns {Promise<boolean>} Whether the log was written successfully
 */
async function log({ userId, action, resourceType, resourceId, metadata, ipAddress, userAgent, role }) {
  // Validate action (warn for unknown actions, but still log them)
  if (!SENSITIVE_ACTIONS.has(action)) {
    logger.warn({ action }, 'Audit log called with non-standard action');
  }

  // Try to get the db module (lazy require to avoid circular deps)
  let db;
  try {
    db = require('./database');
    const pool = db.getPool ? db.getPool() : null;
    if (!pool) {
      logger.warn({ action, userId }, 'Audit log skipped — database not available');
      return false;
    }

    // Quietly check if the audit_logs table exists before inserting
    const tableCheck = await pool.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs')`
    );

    if (!tableCheck.rows[0].exists) {
      logger.warn({ action }, 'Audit log skipped — audit_logs table does not exist');
      return false;
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId || null,
        action,
        resourceType || null,
        resourceId != null ? String(resourceId) : null,
        metadata ? JSON.stringify(metadata) : null,
        ipAddress || null,
        userAgent ? userAgent.slice(0, 255) : null,
        role || null,
      ]
    );

    return true;
  } catch (err) {
    // Don't crash the app if audit logging fails
    logger.error({ err: err.message, action, userId }, 'Audit log insertion failed');
    return false;
  }
}

// ══════════════════════════════════════════════════
// EXPRESS MIDDLEWARE FACTORY
// ══════════════════════════════════════════════════

/**
 * Creates an Express middleware that automatically logs the action.
 *
 * Usage:
 *   app.post('/api/kyc/submit', authMiddleware, audit.middleware('kyc.submit', 'kyc_record'), handler);
 *
 * The middleware automatically captures:
 *   - userId from req.user (set by authMiddleware)
 *   - IP address from req.ip
 *   - User-agent from headers
 *   - Role from req.user
 *
 * @param {string} action - The action name
 * @param {string} [resourceType] - Optional resource type (e.g., 'loan', 'kyc_record')
 * @param {Function} [getResourceId] - Optional function to extract resource ID from req/res
 * @returns {Function} Express middleware
 */
function middleware(action, resourceType, getResourceId) {
  return (req, res, next) => {
    // Store original res.json to intercept the response
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      // Only log on success (2xx) or error (4xx/5xx)
      const statusCode = res.statusCode;
      const isSuccess = statusCode >= 200 && statusCode < 300;

      // For sensitive actions, log both success and failure
      if (isSuccess || SENSITIVE_ACTIONS.has(action)) {
        const resourceId = getResourceId
          ? getResourceId(req, body)
          : req.params?.id || req.body?.loan_id || req.body?.mandate_id || body?.loan_id || body?.mandate_id || body?.kyc_id || null;

        const metadata = {
          requestBody: sanitizeBody(req.body),
          statusCode,
          responseSuccess: body?.success,
          responseError: body?.error,
        };

        // Fire and forget — don't block the response
        log({
          userId: req.user?.id,
          action,
          resourceType,
          resourceId,
          metadata,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent'],
          role: req.user?.role,
        }).catch(() => {});
      }

      return originalJson(body);
    };

    next();
  };
}

// ══════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════

/**
 * Sanitize request body for audit logging — remove sensitive fields.
 */
function sanitizeBody(body) {
  if (!body) return null;

  const sensitiveFields = new Set([
    'otp', 'password', 'token', 'secret', 'authorization',
    'aadhaar_number', 'pan_number', 'credit_card', 'cvv',
    'razorpay_signature', 'razorpay_payment_id',
  ]);

  const sanitized = {};
  for (const [key, value] of Object.entries(body)) {
    if (sensitiveFields.has(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = '[OBJECT]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

module.exports = { log, middleware, SENSITIVE_ACTIONS };
