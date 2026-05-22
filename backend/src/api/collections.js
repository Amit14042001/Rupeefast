/**
 * RupeeFast — Collection Logs API Routes
 *
 * GET  /collections/logs        — List collection logs (filterable)
 * POST /collections/logs        — Create a new collection log entry
 * PUT  /collections/logs/:id    — Update an existing collection log
 *
 * All routes require auth. Agents create/log their own entries; admin can view all.
 */

const sentry = require('../sentry');
const audit = require('../audit');
const logger = require('../logger');

/** Fields that are safe to update (whitelist) */
const UPDATABLE_FIELDS = [
  'collection_type', 'status', 'contacted_person', 'relationship',
  'contact_method', 'amount_promised', 'promise_date', 'amount_collected',
  'notes', 'outcome', 'location_lat', 'location_lng', 'duration_minutes',
  'attachments',
];

/**
 * Register collection logs routes on the given Router.
 * @param {object} router - Express Router
 * @param {object} ctx - Context { db, metrics, authMiddleware }
 */
module.exports = function (router, ctx) {
  const { metrics, authMiddleware } = ctx;

  // ── All routes require auth ──
  router.use(authMiddleware);

  /**
   * GET /collections/logs
   * List collection log entries.
   * Query filters: ?loan_id=&status=&agent_id=
   *
   * Agents see their own entries by default.
   * Admin sees all entries. An explicit ?agent_id= overrides scope.
   */
  router.get('/', async (req, res) => {
    try {
      const { loan_id, status, agent_id } = req.query;

      const conditions = [];
      const params = [];

      // Role-based scoping
      const requestedAgentId = agent_id ? parseInt(agent_id, 10) : null;
      if (req.user.role === 'admin' && requestedAgentId) {
        params.push(requestedAgentId);
        conditions.push(`agent_id = $${params.length}`);
      } else if (req.user.role === 'agent') {
        params.push(req.user.id);
        conditions.push(`agent_id = $${params.length}`);
      }
      // Admin without agent_id sees all

      if (loan_id) {
        params.push(parseInt(loan_id, 10));
        conditions.push(`loan_id = $${params.length}`);
      }

      if (status) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
      }

      let sql = 'SELECT * FROM collection_logs';
      if (conditions.length) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      sql += ' ORDER BY created_at DESC';

      const logs = await ctx.db.all(sql, params);
      res.json({ logs });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'collections/logs' });
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /collections/logs
   * Create a new collection log entry.
   *
   * Body supports all CollectionLog fields. agent_id defaults to the
   * authenticated user (must be an agent role).
   */
  router.post('/', async (req, res) => {
    const {
      loan_id, collection_type, contacted_person, relationship,
      contact_method, amount_promised, promise_date, amount_collected,
      notes, outcome, location_lat, location_lng, duration_minutes,
      attachments,
    } = req.body;

    // Validate required fields
    if (!loan_id) {
      return res.status(400).json({ error: 'loan_id is required' });
    }
    if (!collection_type) {
      return res.status(400).json({ error: 'collection_type is required' });
    }

    try {
      // Verify loan exists
      const loan = await ctx.db.get('SELECT id FROM loans WHERE id = $1', [loan_id]);
      if (!loan) {
        return res.status(404).json({ error: 'Loan not found' });
      }

      const result = await ctx.db.run(
        `INSERT INTO collection_logs (
          loan_id, agent_id, collection_type, status,
          contacted_person, relationship, contact_method,
          amount_promised, promise_date, amount_collected,
          notes, outcome, location_lat, location_lng,
          duration_minutes, attachments
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id`,
        [
          loan_id,
          req.user.id,
          collection_type,
          req.body.status || 'scheduled',
          contacted_person || null,
          relationship || null,
          contact_method || null,
          amount_promised || null,
          promise_date || null,
          amount_collected || null,
          notes || null,
          outcome || null,
          location_lat || null,
          location_lng || null,
          duration_minutes || null,
          attachments ? JSON.stringify(attachments) : '[]',
        ]
      );

      const log = await ctx.db.get('SELECT * FROM collection_logs WHERE id = $1', [result.lastID]);

      audit.log({
        userId: req.user.id,
        action: 'collection.log.create',
        resourceType: 'collection_log',
        resourceId: result.lastID,
        metadata: { loan_id, collection_type, outcome },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        role: req.user.role,
      }).catch(() => {});

      metrics.collectionCreated.inc();
      logger.info({ userId: req.user.id, logId: result.lastID, loanId: loan_id }, 'Collection log created');

      res.status(201).json({ success: true, log });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'collections/logs/create' });
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * PUT /collections/logs/:id
   * Update an existing collection log entry.
   *
   * Only allows updating whitelisted fields. Agents can update their own
   * logs; admin can update any.
   */
  router.put('/:id', async (req, res) => {
    const logId = parseInt(req.params.id, 10);
    if (isNaN(logId)) {
      return res.status(400).json({ error: 'Invalid log ID' });
    }

    try {
      const existing = await ctx.db.get('SELECT * FROM collection_logs WHERE id = $1', [logId]);

      if (!existing) {
        return res.status(404).json({ error: 'Collection log not found' });
      }

      // Permission check: agents can only edit their own logs
      if (req.user.role !== 'admin' && existing.agent_id !== req.user.id) {
        return res.status(403).json({ error: 'You can only update your own collection logs' });
      }

      // Build dynamic UPDATE from whitelist
      const sets = [];
      const params = [];

      for (const field of UPDATABLE_FIELDS) {
        if (req.body[field] !== undefined) {
          let value = req.body[field];
          // JSON fields need stringification
          if (field === 'attachments') {
            value = JSON.stringify(value);
          }
          params.push(value);
          sets.push(`${field} = $${params.length}`);
        }
      }

      if (sets.length === 0) {
        return res.status(400).json({ error: 'No updatable fields provided' });
      }

      sets.push('updated_at = CURRENT_TIMESTAMP');
      params.push(logId);

      await ctx.db.run(
        `UPDATE collection_logs SET ${sets.join(', ')} WHERE id = $${params.length}`,
        params
      );

      const updated = await ctx.db.get('SELECT * FROM collection_logs WHERE id = $1', [logId]);

      audit.log({
        userId: req.user.id,
        action: 'collection.log.update',
        resourceType: 'collection_log',
        resourceId: logId,
        metadata: { updatedFields: Object.keys(req.body).filter(f => UPDATABLE_FIELDS.includes(f)) },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        role: req.user.role,
      }).catch(() => {});

      res.json({ success: true, log: updated });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'collections/logs/update', logId });
      res.status(500).json({ error: err.message });
    }
  });
};
