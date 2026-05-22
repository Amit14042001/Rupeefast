/**
 * RupeeFast — Admin Fraud Events API Routes
 *
 * GET  /admin/fraud/events              — List fraud events (filterable)
 * POST /admin/fraud/events/:id/status   — Update fraud event status (open → investigating → resolved)
 *
 * All routes require admin role.
 */

const sentry = require('../../sentry');
const audit = require('../../audit');
const logger = require('../../logger');

/** Valid lifecycle transitions for fraud event status */
const STATUS_TRANSITIONS = {
  open: ['investigating', 'dismissed'],
  investigating: ['confirmed', 'dismissed'],
  confirmed: ['resolved'],
  dismissed: [],
  resolved: [],
};

/** Fraud event actions that can be set alongside status updates */
const VALID_ACTIONS = ['user_blocked', 'loan_frozen', 'alerted', 'escalated'];

/**
 * Register admin fraud event routes on the given Router.
 * @param {object} router - Express Router
 * @param {object} ctx - Context { db, metrics, authMiddleware }
 */
module.exports = function (router, ctx) {
  const { metrics, authMiddleware } = ctx;

  // ── Enforce admin role for all routes ──
  router.use(authMiddleware, (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });

  /**
   * GET /admin/fraud/events
   * List fraud events with optional filters.
   *
   * Query params:
   *   ?severity=high&status=open&type=multiple_login
   */
  router.get('/', async (req, res) => {
    try {
      const { severity, status, type } = req.query;

      const conditions = [];
      const params = [];

      if (severity) {
        params.push(severity);
        conditions.push(`severity = $${params.length}`);
      }

      if (status) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
      }

      if (type) {
        params.push(type);
        conditions.push(`event_type = $${params.length}`);
      }

      let sql = 'SELECT * FROM fraud_events';
      if (conditions.length) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      sql += ' ORDER BY created_at DESC';

      const events = await ctx.db.all(sql, params);
      res.json({ events });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'admin/fraud/events' });
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /admin/fraud/events/:id/status
   * Update a fraud event's status with optional resolution notes.
   *
   * Enforces valid status lifecycle transitions:
   *   open → investigating | dismissed
   *   investigating → confirmed | dismissed
   *   confirmed → resolved
   *
   * Body: { status, resolution?, action_taken? }
   */
  router.post('/:id/status', async (req, res) => {
    const eventId = parseInt(req.params.id, 10);
    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    const { status: newStatus, resolution, action_taken } = req.body;

    if (!newStatus) {
      return res.status(400).json({ error: 'status is required' });
    }

    const validStatuses = ['open', 'investigating', 'confirmed', 'dismissed', 'resolved'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    try {
      const event = await ctx.db.get('SELECT * FROM fraud_events WHERE id = $1', [eventId]);

      if (!event) {
        return res.status(404).json({ error: 'Fraud event not found' });
      }

      // Validate lifecycle transition
      const allowedTransitions = STATUS_TRANSITIONS[event.status];
      if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
        return res.status(400).json({
          error: `Cannot transition from '${event.status}' to '${newStatus}'`,
          currentStatus: event.status,
          allowedTransitions: allowedTransitions || [],
        });
      }

      // Validate action_taken if provided
      if (action_taken && !VALID_ACTIONS.includes(action_taken)) {
        return res.status(400).json({
          error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`,
        });
      }

      // Build dynamic update
      const sets = ['status = $1'];
      const params = [newStatus];

      if (newStatus === 'resolved' || newStatus === 'dismissed') {
        sets.push('resolved_at = CURRENT_TIMESTAMP');
        sets.push('resolved_by = $2');
        params.push(req.user.id);
      }

      if (resolution) {
        const idx = params.length + 1;
        sets.push(`resolution = $${idx}`);
        params.push(resolution);
      }

      if (action_taken) {
        const idx = params.length + 1;
        sets.push(`action_taken = $${idx}`);
        params.push(action_taken);
      }

      params.push(eventId);
      const idx = params.length;

      await ctx.db.run(
        `UPDATE fraud_events SET ${sets.join(', ')} WHERE id = $${idx}`,
        params
      );

      const updated = await ctx.db.get('SELECT * FROM fraud_events WHERE id = $1', [eventId]);

      // Log audit trail
      audit.log({
        userId: req.user.id,
        action: `fraud.event.${newStatus}`,
        resourceType: 'fraud_event',
        resourceId: eventId,
        metadata: {
          previousStatus: event.status,
          newStatus,
          resolution,
          actionTaken: action_taken,
          event_type: event.event_type,
          severity: event.severity,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        role: req.user.role,
      }).catch(() => {});

      logger.info({
        userId: req.user.id,
        eventId,
        previousStatus: event.status,
        newStatus,
        actionTaken: action_taken,
      }, 'Fraud event status updated');

      res.json({ success: true, event: updated });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'admin/fraud/events/status', eventId });
      res.status(500).json({ error: err.message });
    }
  });
};
