/**
 * Route tests for Admin API Management Endpoints.
 *
 * These tests mock the api-management module entirely to focus on
 * route-level behaviour: auth, validation, error handling, and response shape.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// ── Mock api-management module before requiring server ──
const mockApiManagement = {
  listApiKeys: jest.fn(),
  createApiKey: jest.fn(),
  rotateApiKey: jest.fn(),
  revokeApiKey: jest.fn(),
  listWebhookLogs: jest.fn(),
  getWebhookAnalytics: jest.fn(),
  replayWebhookEvent: jest.fn(),
  getLatestHealthStatus: jest.fn(),
  getUptimeStats: jest.fn(),
  getHealthCheckHistory: jest.fn(),
  runHealthCheck: jest.fn(),
  runAllHealthChecks: jest.fn(),
  recordHealthCheck: jest.fn(),
  getIntegrationConfigs: jest.fn(),
  upsertIntegrationConfig: jest.fn(),
  toggleIntegration: jest.fn(),
};

jest.mock('../src/api-management', () => mockApiManagement);

// ── Mock database module ──
const mockDb = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn(),
  exec: jest.fn(),
};

jest.mock('../src/database', () => jest.fn(() => Promise.resolve(mockDb)));

const { app, setDb } = require('../src/server');

function generateToken(overrides = {}) {
  return jwt.sign(
    { id: 1, mobile: '9876543210', role: 'admin', ...overrides },
    process.env.JWT_SECRET || 'test-secret-not-for-production',
    { expiresIn: '7d' }
  );
}

const adminToken = generateToken();
const borrowerToken = generateToken({ id: 2, role: 'borrower' });

beforeEach(() => {
  setDb(mockDb);
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════
// SHARED AUTH TESTS
// ═══════════════════════════════════════════════════════════

describe('API Management — Auth guards', () => {
  const adminRoutes = [
    { method: 'get', path: '/api/admin/api-keys' },
    { method: 'post', path: '/api/admin/api-keys', body: { service_name: 'razorpay', key_label: 'Test' } },
    { method: 'post', path: '/api/admin/api-keys/1/rotate' },
    { method: 'post', path: '/api/admin/api-keys/1/revoke' },
    { method: 'get', path: '/api/admin/webhooks/logs' },
    { method: 'get', path: '/api/admin/webhooks/analytics' },
    { method: 'post', path: '/api/admin/webhooks/logs/1/replay' },
    { method: 'get', path: '/api/admin/services/health' },
    { method: 'get', path: '/api/admin/services/razorpay/health-history' },
    { method: 'post', path: '/api/admin/services/razorpay/check' },
    { method: 'post', path: '/api/admin/services/check-all' },
    { method: 'get', path: '/api/admin/integrations' },
    { method: 'post', path: '/api/admin/integrations', body: { service_name: 'razorpay' } },
  ];

  adminRoutes.forEach(({ method, path, body }) => {
    test(`${method.toUpperCase()} ${path} returns 401 without auth`, async () => {
      const req = request(app)[method](path);
      if (body) req.send(body);
      const res = await req;
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });

    test(`${method.toUpperCase()} ${path} returns 403 for non-admin role`, async () => {
      const req = request(app)[method](path)
        .set('Authorization', `Bearer ${borrowerToken}`);
      if (body) req.send(body);
      const res = await req;
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Admin access required');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// API KEYS
// ═══════════════════════════════════════════════════════════

describe('GET /api/admin/api-keys', () => {
  test('returns list of API keys with query filters passed through', async () => {
    const fakeKeys = [
      { id: 1, service_name: 'razorpay', key_prefix: 'rf_razorpay_', status: 'active', environment: 'production' },
      { id: 2, service_name: 'sms_gateway', key_prefix: 'rf_sms_gat', status: 'expired', environment: 'staging' },
    ];
    mockApiManagement.listApiKeys.mockResolvedValue(fakeKeys);

    const res = await request(app)
      .get('/api/admin/api-keys?service_name=razorpay&status=active&environment=production')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.keys).toEqual(fakeKeys);
    expect(mockApiManagement.listApiKeys).toHaveBeenCalledWith({
      serviceName: 'razorpay',
      status: 'active',
      environment: 'production',
    });
  });

  test('returns 500 if service throws', async () => {
    mockApiManagement.listApiKeys.mockRejectedValue(new Error('DB error'));
    const res = await request(app)
      .get('/api/admin/api-keys')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('DB error');
  });
});

describe('POST /api/admin/api-keys', () => {
  test('returns 400 if service_name is missing', async () => {
    const res = await request(app)
      .post('/api/admin/api-keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key_label: 'My Key' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('service_name');
  });

  test('returns 400 if key_label is missing', async () => {
    const res = await request(app)
      .post('/api/admin/api-keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ service_name: 'razorpay' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('key_label');
  });

  test('creates key successfully and returns raw_value once', async () => {
    const fakeKey = { id: 1, service_name: 'razorpay', key_label: 'Prod Key', key_prefix: 'rf_razorpay_', environment: 'production', status: 'active' };
    mockApiManagement.createApiKey.mockResolvedValue({ key: fakeKey, rawValue: 'rf_razorpay_abc123def456' });

    const res = await request(app)
      .post('/api/admin/api-keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ service_name: 'razorpay', key_label: 'Prod Key', environment: 'production', notes: 'Live env key' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.key).toEqual(fakeKey);
    expect(res.body.raw_value).toBe('rf_razorpay_abc123def456');
    expect(res.body.message).toContain('not be shown again');

    expect(mockApiManagement.createApiKey).toHaveBeenCalledWith({
      serviceName: 'razorpay',
      keyLabel: 'Prod Key',
      environment: 'production',
      notes: 'Live env key',
      createdBy: 1,
    });
  });

  test('defaults to production environment when not provided', async () => {
    mockApiManagement.createApiKey.mockResolvedValue({ key: { id: 2 }, rawValue: 'rf_test_' });

    await request(app)
      .post('/api/admin/api-keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ service_name: 'test', key_label: 'Test' });

    expect(mockApiManagement.createApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'production' })
    );
  });

  test('returns 500 if service throws', async () => {
    mockApiManagement.createApiKey.mockRejectedValue(new Error('Creation failed'));
    const res = await request(app)
      .post('/api/admin/api-keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ service_name: 'razorpay', key_label: 'Fail' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Creation failed');
  });
});

describe('POST /api/admin/api-keys/:id/rotate', () => {
  test('rotates key successfully', async () => {
    const result = {
      oldKey: { id: 1, status: 'rotated', service_name: 'razorpay' },
      newKey: { id: 2, service_name: 'razorpay', key_prefix: 'rf_razorpay_' },
      rawValue: 'rf_razorpay_newkey',
    };
    mockApiManagement.rotateApiKey.mockResolvedValue(result);

    const res = await request(app)
      .post('/api/admin/api-keys/1/rotate')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.old_key.status).toBe('rotated');
    expect(res.body.raw_value).toBe('rf_razorpay_newkey');
    expect(res.body.message).toContain('copy it now');
    expect(mockApiManagement.rotateApiKey).toHaveBeenCalledWith(1, 1);
  });

  test('returns 404 if key not found', async () => {
    mockApiManagement.rotateApiKey.mockRejectedValue(new Error('API key 999 not found'));
    const res = await request(app)
      .post('/api/admin/api-keys/999/rotate')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not found');
  });

  test('returns 400 if key cannot be rotated (e.g. already revoked)', async () => {
    mockApiManagement.rotateApiKey.mockRejectedValue(new Error("Cannot rotate key with status 'revoked'"));
    const res = await request(app)
      .post('/api/admin/api-keys/1/rotate')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Cannot rotate');
  });
});

describe('POST /api/admin/api-keys/:id/revoke', () => {
  test('revokes key successfully', async () => {
    const fakeKey = { id: 1, service_name: 'razorpay', status: 'revoked' };
    mockApiManagement.revokeApiKey.mockResolvedValue(fakeKey);

    const res = await request(app)
      .post('/api/admin/api-keys/1/revoke')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.key.status).toBe('revoked');
    expect(mockApiManagement.revokeApiKey).toHaveBeenCalledWith(1, 1);
  });

  test('returns 404 if key not found', async () => {
    mockApiManagement.revokeApiKey.mockRejectedValue(new Error('API key 999 not found'));
    const res = await request(app)
      .post('/api/admin/api-keys/999/revoke')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  test('returns 500 on error', async () => {
    mockApiManagement.revokeApiKey.mockRejectedValue(new Error('Unexpected error'));
    const res = await request(app)
      .post('/api/admin/api-keys/1/revoke')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════
// WEBHOOK LOGS
// ═══════════════════════════════════════════════════════════

describe('GET /api/admin/webhooks/logs', () => {
  test('returns paginated webhook logs with filters', async () => {
    const fakeResult = {
      logs: [{ id: 1, provider: 'razorpay', event_type: 'subscription.activated', status: 'processed' }],
      total: 1, page: 1, pages: 1,
    };
    mockApiManagement.listWebhookLogs.mockResolvedValue(fakeResult);

    const res = await request(app)
      .get('/api/admin/webhooks/logs?provider=razorpay&status=processed&event_type=subscription.activated&page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.logs).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(mockApiManagement.listWebhookLogs).toHaveBeenCalledWith({
      provider: 'razorpay',
      status: 'processed',
      eventType: 'subscription.activated',
      page: 1,
      limit: 10,
    });
  });

  test('uses default page/limit when not provided', async () => {
    mockApiManagement.listWebhookLogs.mockResolvedValue({ logs: [], total: 0, page: 1, pages: 0 });

    await request(app)
      .get('/api/admin/webhooks/logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(mockApiManagement.listWebhookLogs).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 50 })
    );
  });

  test('returns 500 on error', async () => {
    mockApiManagement.listWebhookLogs.mockRejectedValue(new Error('Query failed'));
    const res = await request(app)
      .get('/api/admin/webhooks/logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(500);
  });
});

describe('GET /api/admin/webhooks/analytics', () => {
  test('returns webhook analytics', async () => {
    const fakeAnalytics = {
      totals: { total_all: 100, total_processed: 80, total_failed: 10, total_pending: 10 },
      byProvider: [{ provider: 'razorpay', total: 100, processed: 80, failed: 10, avg_ms: 150 }],
      hourly: [],
    };
    mockApiManagement.getWebhookAnalytics.mockResolvedValue(fakeAnalytics);

    const res = await request(app)
      .get('/api/admin/webhooks/analytics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.analytics.totals.total_all).toBe(100);
    expect(res.body.analytics.byProvider).toHaveLength(1);
  });

  test('returns 500 on error', async () => {
    mockApiManagement.getWebhookAnalytics.mockRejectedValue(new Error('Analytics failed'));
    const res = await request(app)
      .get('/api/admin/webhooks/analytics')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/admin/webhooks/logs/:id/replay', () => {
  test('replays webhook event successfully', async () => {
    const replayed = { id: 2, provider: 'razorpay', replayed_from: 1, status: 'received' };
    mockApiManagement.replayWebhookEvent.mockResolvedValue(replayed);

    const res = await request(app)
      .post('/api/admin/webhooks/logs/1/replay')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.webhook.id).toBe(2);
    expect(res.body.webhook.replayed_from).toBe(1);
    expect(mockApiManagement.replayWebhookEvent).toHaveBeenCalledWith(1);
  });

  test('returns 404 if original webhook not found', async () => {
    mockApiManagement.replayWebhookEvent.mockRejectedValue(new Error('Webhook log 999 not found'));
    const res = await request(app)
      .post('/api/admin/webhooks/logs/999/replay')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════
// SERVICE HEALTH
// ═══════════════════════════════════════════════════════════

describe('GET /api/admin/services/health', () => {
  test('returns services and uptime stats', async () => {
    const fakeServices = [
      { service_name: 'razorpay', status: 'up', response_time_ms: 120 },
      { service_name: 'sms_gateway', status: 'unknown' },
    ];
    const fakeUptime = [
      { service_name: 'razorpay', total_checks: 50, up_count: 48, uptime_pct: 96 },
    ];
    mockApiManagement.getLatestHealthStatus.mockResolvedValue(fakeServices);
    mockApiManagement.getUptimeStats.mockResolvedValue(fakeUptime);

    const res = await request(app)
      .get('/api/admin/services/health')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.services).toHaveLength(2);
    expect(res.body.uptime).toHaveLength(1);
    expect(mockApiManagement.getUptimeStats).toHaveBeenCalledWith(7);
  });

  test('returns 500 on error', async () => {
    mockApiManagement.getLatestHealthStatus.mockRejectedValue(new Error('Health check error'));
    const res = await request(app)
      .get('/api/admin/services/health')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(500);
  });
});

describe('GET /api/admin/services/:name/health-history', () => {
  test('returns health check history for a service', async () => {
    const history = [
      { id: 1, service_name: 'razorpay', status: 'up', response_time_ms: 100 },
      { id: 2, service_name: 'razorpay', status: 'degraded', response_time_ms: 3000 },
    ];
    mockApiManagement.getHealthCheckHistory.mockResolvedValue(history);

    const res = await request(app)
      .get('/api/admin/services/razorpay/health-history?hours=48')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(2);
    expect(mockApiManagement.getHealthCheckHistory).toHaveBeenCalledWith('razorpay', 48);
  });

  test('defaults to 24 hours when not provided', async () => {
    mockApiManagement.getHealthCheckHistory.mockResolvedValue([]);

    await request(app)
      .get('/api/admin/services/razorpay/health-history')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(mockApiManagement.getHealthCheckHistory).toHaveBeenCalledWith('razorpay', 24);
  });
});

describe('POST /api/admin/services/:name/check', () => {
  const configs = [
    { service_name: 'razorpay', base_url: 'https://api.razorpay.com' },
  ];

  test('runs health check when service has a configured URL', async () => {
    const fakeHealth = { id: 1, service_name: 'razorpay', status: 'up', response_time_ms: 150 };
    mockApiManagement.getIntegrationConfigs.mockResolvedValue(configs);
    mockApiManagement.runHealthCheck.mockResolvedValue(fakeHealth);

    const res = await request(app)
      .post('/api/admin/services/razorpay/check')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.health.status).toBe('up');
    expect(mockApiManagement.runHealthCheck).toHaveBeenCalledWith('razorpay', 'https://api.razorpay.com', { manual: true });
  });

  test('records unknown check when service has no base_url', async () => {
    const noUrlConfigs = [{ service_name: 'my_service', base_url: null }];
    const fakeHealth = { id: 2, service_name: 'my_service', status: 'unknown', error_message: 'No endpoint configured' };
    mockApiManagement.getIntegrationConfigs.mockResolvedValue(noUrlConfigs);
    mockApiManagement.recordHealthCheck.mockResolvedValue(fakeHealth);

    const res = await request(app)
      .post('/api/admin/services/my_service/check')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.health.status).toBe('unknown');
    expect(mockApiManagement.recordHealthCheck).toHaveBeenCalledWith({
      serviceName: 'my_service',
      status: 'unknown',
      errorMessage: 'No endpoint configured',
      checkedBy: 'manual',
    });
  });

  test('records unknown check when service is not found in configs', async () => {
    mockApiManagement.getIntegrationConfigs.mockResolvedValue([]);
    const fakeHealth = { id: 3, service_name: 'unknown_svc', status: 'unknown', error_message: 'Service not found' };
    mockApiManagement.recordHealthCheck.mockResolvedValue(fakeHealth);

    const res = await request(app)
      .post('/api/admin/services/unknown_svc/check')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.health.status).toBe('unknown');
    expect(res.body.message).toContain('not found');
  });
});

describe('POST /api/admin/services/check-all', () => {
  test('runs all health checks and returns results', async () => {
    const fakeResults = [
      { id: 1, service_name: 'razorpay', status: 'up' },
      { id: 2, service_name: 'sms_gateway', status: 'down' },
    ];
    mockApiManagement.runAllHealthChecks.mockResolvedValue(fakeResults);

    const res = await request(app)
      .post('/api/admin/services/check-all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.message).toContain('2 services');
  });
});

// ═══════════════════════════════════════════════════════════
// INTEGRATION CONFIGS
// ═══════════════════════════════════════════════════════════

describe('GET /api/admin/integrations', () => {
  test('returns all integration configs', async () => {
    const configs = [
      { id: 1, service_name: 'razorpay', display_name: 'Razorpay', is_enabled: true, current_status: 'up' },
      { id: 2, service_name: 'sms_gateway', display_name: 'SMS Gateway', is_enabled: false, current_status: 'unknown' },
    ];
    mockApiManagement.getIntegrationConfigs.mockResolvedValue(configs);

    const res = await request(app)
      .get('/api/admin/integrations')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.configs).toHaveLength(2);
  });
});

describe('POST /api/admin/integrations', () => {
  test('creates/updates integration config', async () => {
    const fakeIntegration = {
      id: 1, service_name: 'razorpay', display_name: 'Razorpay Live',
      base_url: 'https://api.razorpay.com', is_enabled: true,
    };
    mockApiManagement.upsertIntegrationConfig.mockResolvedValue(fakeIntegration);

    const res = await request(app)
      .post('/api/admin/integrations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        service_name: 'razorpay',
        display_name: 'Razorpay Live',
        base_url: 'https://api.razorpay.com',
        is_enabled: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.integration.service_name).toBe('razorpay');

    expect(mockApiManagement.upsertIntegrationConfig).toHaveBeenCalledWith({
      serviceName: 'razorpay',
      displayName: 'Razorpay Live',
      baseUrl: 'https://api.razorpay.com',
      isEnabled: true,
      config: undefined,
      featureFlags: undefined,
    });
  });

  test('returns 400 if service_name is missing', async () => {
    const res = await request(app)
      .post('/api/admin/integrations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ display_name: 'No service' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('service_name');
  });

  test('uses service_name as display_name when not provided', async () => {
    mockApiManagement.upsertIntegrationConfig.mockResolvedValue({ id: 1, service_name: 'test' });

    await request(app)
      .post('/api/admin/integrations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ service_name: 'test' });

    expect(mockApiManagement.upsertIntegrationConfig).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'test' })
    );
  });

  test('returns 500 on error', async () => {
    mockApiManagement.upsertIntegrationConfig.mockRejectedValue(new Error('Upsert failed'));
    const res = await request(app)
      .post('/api/admin/integrations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ service_name: 'razorpay' });
    expect(res.status).toBe(500);
  });
});

describe('POST /api/admin/integrations/:name/toggle', () => {
  test('enables an integration', async () => {
    const fakeIntegration = { id: 1, service_name: 'razorpay', is_enabled: true };
    mockApiManagement.toggleIntegration.mockResolvedValue(fakeIntegration);

    const res = await request(app)
      .post('/api/admin/integrations/razorpay/toggle')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_enabled: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.integration.is_enabled).toBe(true);
    expect(mockApiManagement.toggleIntegration).toHaveBeenCalledWith('razorpay', true);
  });

  test('disables an integration', async () => {
    const fakeIntegration = { id: 1, service_name: 'razorpay', is_enabled: false };
    mockApiManagement.toggleIntegration.mockResolvedValue(fakeIntegration);

    const res = await request(app)
      .post('/api/admin/integrations/razorpay/toggle')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_enabled: false });

    expect(res.status).toBe(200);
    expect(res.body.integration.is_enabled).toBe(false);
    expect(mockApiManagement.toggleIntegration).toHaveBeenCalledWith('razorpay', false);
  });

  test('returns 400 if is_enabled is missing', async () => {
    const res = await request(app)
      .post('/api/admin/integrations/razorpay/toggle')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('is_enabled');
  });

  test('returns 404 if integration not found', async () => {
    mockApiManagement.toggleIntegration.mockRejectedValue(new Error("Integration 'unknown' not found"));
    const res = await request(app)
      .post('/api/admin/integrations/unknown/toggle')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_enabled: true });
    expect(res.status).toBe(404);
  });
});
