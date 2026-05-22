/**
 * RupeeFast — Admin System Management Routes
 *
 * API key lifecycle, webhook log management, service health checks,
 * integration configuration. All routes require admin role.
 */

const sentry = require('../../sentry');
const audit = require('../../audit');
const apiManagement = require('../../api-management');

/**
 * Register admin system management routes on the given Router.
 */
module.exports = function (router, ctx) {
  const { authMiddleware } = ctx;

  // ── Enforce admin role ──
  router.use(authMiddleware, (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
  });

  // ═══════════════════════════════
  // API KEYS
  // ═══════════════════════════════

  router.get('/api-keys', async (req, res) => {
    try {
      const { service_name, status, environment } = req.query;
      const keys = await apiManagement.listApiKeys({ serviceName: service_name, status, environment });
      res.json({ keys });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/api-keys' });
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api-keys', async (req, res) => {
    const { service_name, key_label, environment, notes } = req.body;
    if (!service_name || !key_label) return res.status(400).json({ error: 'service_name and key_label are required' });
    try {
      const result = await apiManagement.createApiKey({ serviceName: service_name, keyLabel: key_label, environment: environment || 'production', notes, createdBy: req.user.id });
      audit.log({ userId: req.user.id, action: 'admin.api-key.create', resourceType: 'api_key', resourceId: result.key.id, metadata: { serviceName: service_name, keyLabel: key_label, environment }, ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role }).catch(() => {});
      res.status(201).json({ success: true, key: result.key, raw_value: result.rawValue, message: 'Copy the raw key now — it will not be shown again.' });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/api-keys/create' });
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api-keys/:id/rotate', async (req, res) => {
    try {
      const result = await apiManagement.rotateApiKey(parseInt(req.params.id), req.user.id);
      audit.log({ userId: req.user.id, action: 'admin.api-key.rotate', resourceType: 'api_key', resourceId: parseInt(req.params.id), metadata: { newKeyId: result.newKey.id, serviceName: result.oldKey.service_name }, ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role }).catch(() => {});
      res.json({ success: true, old_key: result.oldKey, new_key: result.newKey, raw_value: result.rawValue, message: 'Old key revoked. A new key has been generated — copy it now.' });
    } catch (err) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      if (err.message.includes('Cannot rotate')) return res.status(400).json({ error: err.message });
      sentry.captureError(err, { route: 'admin/api-keys/rotate' });
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api-keys/:id/revoke', async (req, res) => {
    try {
      const key = await apiManagement.revokeApiKey(parseInt(req.params.id), req.user.id);
      audit.log({ userId: req.user.id, action: 'admin.api-key.revoke', resourceType: 'api_key', resourceId: parseInt(req.params.id), metadata: { serviceName: key.service_name }, ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role }).catch(() => {});
      res.json({ success: true, message: 'API key revoked', key });
    } catch (err) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      sentry.captureError(err, { route: 'admin/api-keys/revoke' });
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════
  // WEBHOOK LOGS
  // ═══════════════════════════════

  router.get('/webhooks/logs', async (req, res) => {
    try {
      const { provider, status, event_type, page, limit } = req.query;
      const result = await apiManagement.listWebhookLogs({ provider, status, eventType: event_type, page: parseInt(page, 10) || 1, limit: parseInt(limit, 10) || 50 });
      res.json(result);
    } catch (err) {
      sentry.captureError(err, { route: 'admin/webhooks/logs' });
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/webhooks/analytics', async (req, res) => {
    try {
      const analytics = await apiManagement.getWebhookAnalytics();
      res.json({ analytics });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/webhooks/analytics' });
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/webhooks/logs/:id/replay', async (req, res) => {
    try {
      const replayed = await apiManagement.replayWebhookEvent(parseInt(req.params.id));
      audit.log({ userId: req.user.id, action: 'admin.webhook.replay', resourceType: 'webhook_log', resourceId: parseInt(req.params.id), metadata: { replayedId: replayed.id }, ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role }).catch(() => {});
      res.json({ success: true, webhook: replayed, message: 'Webhook event replayed.' });
    } catch (err) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      sentry.captureError(err, { route: 'admin/webhooks/replay' });
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════
  // SERVICE HEALTH
  // ═══════════════════════════════

  router.get('/services/health', async (req, res) => {
    try {
      const services = await apiManagement.getLatestHealthStatus();
      const uptime = await apiManagement.getUptimeStats(7);
      res.json({ services, uptime });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/services/health' });
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/services/:name/health-history', async (req, res) => {
    try {
      const { hours } = req.query;
      const history = await apiManagement.getHealthCheckHistory(req.params.name, parseInt(hours, 10) || 24);
      res.json({ history });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/services/health-history' });
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/services/:name/check', async (req, res) => {
    try {
      const serviceName = req.params.name;
      const configs = await apiManagement.getIntegrationConfigs();
      const config = configs.find(c => c.service_name === serviceName);
      if (!config || !config.base_url) {
        const result = await apiManagement.recordHealthCheck({ serviceName, status: 'unknown', errorMessage: config ? 'No endpoint configured' : 'Service not found', checkedBy: 'manual' });
        return res.json({ health: result, message: 'Service not found — no endpoint configured.' });
      }
      const result = await apiManagement.runHealthCheck(serviceName, config.base_url, { manual: true });
      audit.log({ userId: req.user.id, action: 'admin.service.check', resourceType: 'service_health', resourceId: result.id, metadata: { serviceName, status: result.status, responseTimeMs: result.response_time_ms }, ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role }).catch(() => {});
      res.json({ health: result });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/services/check' });
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/services/check-all', async (req, res) => {
    try {
      const results = await apiManagement.runAllHealthChecks();
      res.json({ success: true, results, message: `Checked ${results.length} services.` });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/services/check-all' });
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════
  // INTEGRATIONS
  // ═══════════════════════════════

  router.get('/integrations', async (req, res) => {
    try {
      const configs = await apiManagement.getIntegrationConfigs();
      res.json({ configs });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/integrations' });
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/integrations', async (req, res) => {
    const { service_name, display_name, base_url, config, is_enabled, feature_flags } = req.body;
    if (!service_name) return res.status(400).json({ error: 'service_name is required' });
    try {
      const integration = await apiManagement.upsertIntegrationConfig({ serviceName: service_name, displayName: display_name || service_name, baseUrl: base_url, config, isEnabled: is_enabled, featureFlags: feature_flags });
      audit.log({ userId: req.user.id, action: 'admin.integration.update', resourceType: 'integration_config', resourceId: integration.id, metadata: { serviceName: service_name, isEnabled: is_enabled }, ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role }).catch(() => {});
      res.json({ success: true, integration });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/integrations' });
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/integrations/:name/toggle', async (req, res) => {
    const { is_enabled } = req.body;
    if (is_enabled === undefined) return res.status(400).json({ error: 'is_enabled is required' });
    try {
      const integration = await apiManagement.toggleIntegration(req.params.name, is_enabled);
      audit.log({ userId: req.user.id, action: is_enabled ? 'admin.integration.enable' : 'admin.integration.disable', resourceType: 'integration_config', resourceId: integration.id, metadata: { serviceName: req.params.name }, ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role }).catch(() => {});
      res.json({ success: true, integration });
    } catch (err) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      sentry.captureError(err, { route: 'admin/integrations/toggle' });
      res.status(500).json({ error: err.message });
    }
  });
};
