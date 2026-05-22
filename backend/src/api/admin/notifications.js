/**
 * RupeeFast — Admin Notification API Routes
 *
 * CRUD for notification templates + broadcast scheduling/management.
 * All routes require admin role.
 */

const sentry = require('../../sentry');
const audit = require('../../audit');
const logger = require('../../logger');
const notifications = require('../../notifications');

/**
 * Register admin notification routes on the given Router.
 */
module.exports = function (router, ctx) {
  const { authMiddleware } = ctx;

  // ── Enforce admin role ──
  router.use(authMiddleware, (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
  });

  // ── List notification templates ──
  router.get('/templates', async (req, res) => {
    try {
      const { channel, active } = req.query;
      let sql = 'SELECT * FROM notification_templates';
      const params = [];
      const conditions = [];
      if (channel) { params.push(channel); conditions.push(`channel = $${params.length}`); }
      if (active === 'true') conditions.push('is_active = TRUE');
      if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
      sql += ' ORDER BY label ASC';
      const templates = await ctx.db.all(sql, params);
      res.json({ templates });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/notifications/templates' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── Create a template ──
  router.post('/templates', async (req, res) => {
    const { name, label, channel, subject, body, variables } = req.body;
    if (!name || !label || !channel || !body) return res.status(400).json({ error: 'name, label, channel, and body are required' });
    if (!['sms', 'whatsapp', 'push'].includes(channel)) return res.status(400).json({ error: 'channel must be sms, whatsapp, or push' });
    try {
      const result = await ctx.db.run(
        `INSERT INTO notification_templates (name, label, channel, subject, body, variables, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [name, label, channel, subject || null, body, JSON.stringify(variables || []), req.user.id]
      );
      const template = await ctx.db.get('SELECT * FROM notification_templates WHERE id = $1', [result.lastID]);
      res.status(201).json({ success: true, template });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/notifications/templates/create' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── Update a template ──
  router.put('/templates/:id', async (req, res) => {
    const { id } = req.params;
    const { name, label, channel, subject, body, variables, is_active } = req.body;
    try {
      const sets = [];
      const params = [];
      if (name !== undefined) { params.push(name); sets.push(`name = $${params.length}`); }
      if (label !== undefined) { params.push(label); sets.push(`label = $${params.length}`); }
      if (channel !== undefined) { params.push(channel); sets.push(`channel = $${params.length}`); }
      if (subject !== undefined) { params.push(subject); sets.push(`subject = $${params.length}`); }
      if (body !== undefined) { params.push(body); sets.push(`body = $${params.length}`); }
      if (variables !== undefined) { params.push(JSON.stringify(variables)); sets.push(`variables = $${params.length}`); }
      if (is_active !== undefined) { params.push(is_active); sets.push(`is_active = $${params.length}`); }
      if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
      sets.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);
      await ctx.db.run(`UPDATE notification_templates SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
      const template = await ctx.db.get('SELECT * FROM notification_templates WHERE id = $1', [id]);
      res.json({ success: true, template });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/notifications/templates/update' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── Send a broadcast ──
  router.post('/broadcast', async (req, res) => {
    const { template_id, title, message, channels, target_roles, kyc_status, min_trust_score, scheduled_for } = req.body;
    if (!message && !template_id) return res.status(400).json({ error: 'Either message or template_id is required' });
    if (!channels || !Array.isArray(channels) || channels.length === 0) return res.status(400).json({ error: 'At least one channel (sms, whatsapp, push) is required' });
    const validChannels = ['sms', 'whatsapp', 'push'];
    for (const ch of channels) { if (!validChannels.includes(ch)) return res.status(400).json({ error: `Invalid channel: ${ch}` }); }
    try {
      let resolvedMessage = message;
      let resolvedTitle = title || '';
      if (!resolvedMessage && template_id) {
        const template = await ctx.db.get('SELECT * FROM notification_templates WHERE id = $1', [template_id]);
        if (!template) return res.status(404).json({ error: 'Template not found' });
        resolvedMessage = template.body;
        resolvedTitle = template.subject || title || '';
      }
      const targetFilters = { roles: target_roles || ['borrower', 'investor', 'agent'], kyc_status: kyc_status || null, min_trust_score: min_trust_score || 0 };
      const result = await ctx.db.run(
        `INSERT INTO notification_broadcasts (template_id, title, message, channels, target_filters, status, scheduled_for, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [template_id || null, resolvedTitle, resolvedMessage, JSON.stringify(channels), JSON.stringify(targetFilters), scheduled_for ? 'scheduled' : 'sending', scheduled_for || null, req.user.id]
      );
      const broadcastId = result.lastID;
      if (!scheduled_for) {
        await ctx.db.run(`UPDATE notification_broadcasts SET status = $1 WHERE id = $2`, ['sending', broadcastId]);
        notifications.broadcast({ db: ctx.db, broadcastId, channels, title: resolvedTitle, body: resolvedMessage, targetFilters }).catch(err => {
          logger.error({ err: err.message, broadcastId }, 'Async broadcast failed');
        });
        audit.log({ userId: req.user.id, action: 'admin.notifications.broadcast', resourceType: 'notification_broadcast', resourceId: broadcastId, metadata: { channels, targetRoles: target_roles, templateId: template_id, title: resolvedTitle }, ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role }).catch(() => {});
        res.json({ success: true, broadcast_id: broadcastId, message: 'Broadcast started.' });
      } else {
        audit.log({ userId: req.user.id, action: 'admin.notifications.broadcast.schedule', resourceType: 'notification_broadcast', resourceId: broadcastId, metadata: { channels, targetRoles: target_roles, templateId: template_id, title: resolvedTitle, scheduledFor: scheduled_for }, ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role }).catch(() => {});
        res.json({ success: true, broadcast_id: broadcastId, message: `Broadcast scheduled for ${scheduled_for}.` });
      }
    } catch (err) {
      sentry.captureError(err, { route: 'admin/notifications/broadcast' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── Get broadcast history ──
  router.get('/broadcasts', async (req, res) => {
    try {
      const { status, channel, limit, offset } = req.query;
      const result = await notifications.getBroadcastHistory(ctx.db, { status, channel, limit: parseInt(limit, 10) || 50, offset: parseInt(offset, 10) || 0 });
      res.json(result);
    } catch (err) {
      sentry.captureError(err, { route: 'admin/notifications/broadcasts' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── Cancel a broadcast ──
  router.post('/broadcasts/:id/cancel', async (req, res) => {
    try {
      const broadcast = await ctx.db.get('SELECT * FROM notification_broadcasts WHERE id = $1', [req.params.id]);
      if (!broadcast) return res.status(404).json({ error: 'Broadcast not found' });
      if (!['draft', 'scheduled', 'sending'].includes(broadcast.status)) return res.status(400).json({ error: `Cannot cancel broadcast with status "${broadcast.status}"` });
      await ctx.db.run('UPDATE notification_broadcasts SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['cancelled', req.params.id]);
      audit.log({ userId: req.user.id, action: 'admin.notifications.broadcast.cancel', resourceType: 'notification_broadcast', resourceId: parseInt(req.params.id), metadata: { previousStatus: broadcast.status, title: broadcast.title }, ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role }).catch(() => {});
      res.json({ success: true, message: 'Broadcast cancelled' });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/notifications/broadcasts/cancel' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── Get analytics ──
  router.get('/analytics', async (req, res) => {
    try {
      const stats = await ctx.db.get(`SELECT COUNT(*)::int as total_broadcasts, COALESCE(SUM(total_recipients), 0)::int as total_recipients, COALESCE(SUM(sent_count), 0)::int as total_sent, COALESCE(SUM(delivered_count), 0)::int as total_delivered, COALESCE(SUM(failed_count), 0)::int as total_failed, COALESCE(SUM(opened_count), 0)::int as total_opened FROM notification_broadcasts`);
      const channelStats = await ctx.db.all(`SELECT jsonb_array_elements_text(channels) as channel, COUNT(*)::int as broadcast_count, COALESCE(SUM(total_recipients), 0)::int as recipients FROM notification_broadcasts GROUP BY channel ORDER BY channel`);
      const recent = await ctx.db.all(`SELECT id, title, status, total_recipients, sent_count, failed_count, created_at FROM notification_broadcasts ORDER BY created_at DESC LIMIT 5`);
      res.json({ stats, channelStats, recent });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/notifications/analytics' });
      res.status(500).json({ error: err.message });
    }
  });
};
