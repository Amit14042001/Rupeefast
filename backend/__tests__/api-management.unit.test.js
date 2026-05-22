/**
 * Unit tests for the API Management service (api-management.js).
 *
 * Mocks pg.Pool to test DB interaction logic, key generation,
 * health check recording, and integration configuration directly.
 */

const crypto = require('crypto');

// ── Mock pg.Pool before requiring the module ──
const mockPool = {
  query: jest.fn(),
};

jest.mock('pg', () => {
  const MockPool = function () { return mockPool; };
  return { Pool: MockPool };
});

// Mock logger to silence output
jest.mock('../src/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

const apiManagement = require('../src/api-management');

beforeEach(() => {
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════
// API KEY MANAGEMENT
// ═══════════════════════════════════════════════════════════

describe('generateKeyValue', () => {
  // generateKeyValue isn't exported, so we test it indirectly through createApiKey

  test('createApiKey returns key with rf_<service>_<hex> format', async () => {
    const fakeRow = {
      id: 1, service_name: 'razorpay', key_label: 'Prod Key',
      key_prefix: 'rf_razorpay_', environment: 'production', status: 'active',
    };
    mockPool.query.mockResolvedValue({ rows: [fakeRow] });

    const result = await apiManagement.createApiKey({
      serviceName: 'razorpay',
      keyLabel: 'Prod Key',
      environment: 'production',
      createdBy: 1,
      notes: 'Live key',
    });

    expect(result.key.id).toBe(1);
    expect(result.key.key_prefix).toBe('rf_razorpay_');
    expect(result.rawValue).toMatch(/^rf_razorpay_[a-f0-9]{32}$/);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO api_keys'),
      ['razorpay', 'Prod Key', 'rf_razorpay_', 'production', 1, 'Live key']
    );
  });

  test('createApiKey defaults environment and omits optional fields', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ id: 2 }] });

    await apiManagement.createApiKey({
      serviceName: 'sms-gateway',
      keyLabel: 'Test',
    });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO api_keys'),
      ['sms-gateway', 'Test', expect.any(String), 'production', null, null]
    );
  });

  test('createApiKey sanitizes service name for key prefix', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ id: 3 }] });

    const result = await apiManagement.createApiKey({
      serviceName: 'My Super Service!!!',
      keyLabel: 'Test',
    });

    // Prefix is limited to 8 alphanumeric chars; 'My Super Service!!!' → 'mysuper'
    expect(result.rawValue).toMatch(/^rf_mysuper_[a-f0-9]{32}$/);
  });
});

describe('rotateApiKey', () => {
  const activeKey = {
    id: 1, service_name: 'razorpay', key_label: 'Prod Key',
    key_prefix: 'rf_razorpay_', status: 'active',
    environment: 'production', notes: null,
  };

  test('rotates an active key successfully', async () => {
    // First query: find existing key
    mockPool.query.mockResolvedValueOnce({ rows: [activeKey] });
    // Second query: revoke old
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    // Third query: insert new
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 2, service_name: 'razorpay', key_label: expect.any(String), key_prefix: 'rf_razorpay_', environment: 'production', status: 'active' }] });

    const result = await apiManagement.rotateApiKey(1, 5);

    expect(result.oldKey.status).toBe('rotated');
    expect(result.newKey.id).toBe(2);
    expect(result.rawValue).toMatch(/^rf_razorpay_[a-f0-9]{32}$/);
  });

  test('throws error if key not found', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    await expect(apiManagement.rotateApiKey(999, 1)).rejects.toThrow('not found');
  });

  test('throws error if key is not active', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ ...activeKey, status: 'revoked' }] });
    await expect(apiManagement.rotateApiKey(1, 1)).rejects.toThrow('Cannot rotate');
  });
});

describe('revokeApiKey', () => {
  test('revokes an existing key', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ id: 1, status: 'revoked', service_name: 'razorpay' }] });

    const result = await apiManagement.revokeApiKey(1);

    expect(result.status).toBe('revoked');
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE api_keys SET status'),
      [1]
    );
  });

  test('throws error if key not found', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    await expect(apiManagement.revokeApiKey(999)).rejects.toThrow('not found');
  });
});

describe('listApiKeys', () => {
  const fakeKeys = [
    { id: 1, service_name: 'razorpay', status: 'active', environment: 'production', created_by_name: 'Admin' },
    { id: 2, service_name: 'razorpay', status: 'rotated', created_by_name: null },
  ];

  test('returns all keys without filters', async () => {
    mockPool.query.mockResolvedValue({ rows: fakeKeys });

    const result = await apiManagement.listApiKeys();

    expect(result).toHaveLength(2);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT ak.*'),
      []
    );
  });

  test('filters by service_name', async () => {
    mockPool.query.mockResolvedValue({ rows: [fakeKeys[0]] });

    await apiManagement.listApiKeys({ serviceName: 'razorpay' });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE service_name = $1'),
      ['razorpay']
    );
  });

  test('filters by status and environment', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await apiManagement.listApiKeys({ status: 'active', environment: 'production' });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('status = $1'),
      expect.arrayContaining(['active', 'production'])
    );
  });
});

// ═══════════════════════════════════════════════════════════
// WEBHOOK LOGGING
// ═══════════════════════════════════════════════════════════

describe('logWebhookEvent', () => {
  test('logs a webhook event with all fields', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ id: 42 }] });

    const id = await apiManagement.logWebhookEvent({
      provider: 'razorpay',
      eventType: 'subscription.activated',
      eventId: 'evt_123',
      httpMethod: 'POST',
      sourceIp: '203.0.113.1',
      headers: { 'content-type': 'application/json' },
      rawBody: '{"event":"test"}',
      parsedBody: { event: 'test' },
    });

    expect(id).toBe(42);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO webhook_logs'),
      ['razorpay', 'subscription.activated', 'evt_123', 'POST', '203.0.113.1',
       expect.any(String), '{"event":"test"}', expect.any(String)]
    );
  });

  test('logs a minimal webhook event', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await apiManagement.logWebhookEvent({
      provider: 'sms_dlr',
      eventType: 'delivery.success',
    });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO webhook_logs'),
      ['sms_dlr', 'delivery.success', null, 'POST', null, null, null, null]
    );
  });
});

describe('updateWebhookLog', () => {
  test('updates with processed status', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await apiManagement.updateWebhookLog(1, {
      status: 'processed',
      httpStatus: 200,
      processingTimeMs: 45,
    });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE webhook_logs'),
      ['processed', 200, null, 45, 1]
    );
  });

  test('updates with failed status and error message', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await apiManagement.updateWebhookLog(5, {
      status: 'failed',
      errorMessage: 'Signature mismatch',
    });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE webhook_logs'),
      ['failed', null, 'Signature mismatch', null, 5]
    );
  });
});

describe('replayWebhookEvent', () => {
  const originalEvent = {
    id: 1, provider: 'razorpay', event_type: 'subscription.charged',
    event_id: 'evt_001', http_method: 'POST', source_ip: '203.0.113.1',
    headers: '{"x-custom":"val"}', raw_body: '{"foo":"bar"}',
    parsed_body: '{"foo":"bar"}',
  };

  test('replays an existing webhook event', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [originalEvent] });
    mockPool.query.mockResolvedValueOnce({ rows: [{ ...originalEvent, id: 2, replayed_from: 1 }] });

    const result = await apiManagement.replayWebhookEvent(1);

    expect(result.id).toBe(2);
    expect(result.replayed_from).toBe(1);
  });

  test('throws error if original event not found', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    await expect(apiManagement.replayWebhookEvent(999)).rejects.toThrow('not found');
  });
});

describe('listWebhookLogs', () => {
  test('returns paginated logs without filters', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ count: '25' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

    const result = await apiManagement.listWebhookLogs({ page: 2, limit: 10 });

    expect(result.total).toBe(25);
    expect(result.page).toBe(2);
    expect(result.pages).toBe(3);
    expect(result.logs).toHaveLength(2);
  });

  test('filters by provider and status', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })
      .mockResolvedValueOnce({ rows: [] });

    await apiManagement.listWebhookLogs({ provider: 'razorpay', status: 'failed', page: 1, limit: 50 });

    // Should have WHERE clause with both filters
    const queryCall = mockPool.query.mock.calls[0][0];
    expect(queryCall).toContain('WHERE provider = $1 AND status = $2');
  });

  test('clamps limit to max 200', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    await apiManagement.listWebhookLogs({ limit: 500 });

    // The limit param should be 200
    const queryCall = mockPool.query.mock.calls[1];
    expect(queryCall[1]).toContain(200);
  });
});

describe('getWebhookAnalytics', () => {
  test('returns aggregated analytics', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ provider: 'razorpay', total: 100, processed: 80, failed: 10, avg_ms: 150 }] })
      .mockResolvedValueOnce({ rows: [{ hour: new Date(), total: 10, failures: 1 }] })
      .mockResolvedValueOnce({ rows: [{ total_all: 100, total_processed: 80, total_failed: 10, total_pending: 10 }] });

    const result = await apiManagement.getWebhookAnalytics();

    expect(result.byProvider).toHaveLength(1);
    expect(result.byProvider[0].total).toBe(100);
    expect(result.hourly).toHaveLength(1);
    expect(result.totals.total_all).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════
// SERVICE HEALTH CHECKS
// ═══════════════════════════════════════════════════════════

describe('recordHealthCheck', () => {
  test('records a health check result', async () => {
    const fakeRow = { id: 1, service_name: 'razorpay', status: 'up', response_time_ms: 120 };
    mockPool.query.mockResolvedValue({ rows: [fakeRow] });

    const result = await apiManagement.recordHealthCheck({
      serviceName: 'razorpay',
      status: 'up',
      responseTimeMs: 120,
      endpointTested: 'https://api.razorpay.com/v1/health',
      checkedBy: 'system',
    });

    expect(result.id).toBe(1);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO service_health_checks'),
      ['razorpay', 'up', 120, 'https://api.razorpay.com/v1/health', null, null, 'system']
    );
  });

  test('records a down check with details', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ id: 2 }] });

    await apiManagement.recordHealthCheck({
      serviceName: 'sms_gateway',
      status: 'down',
      errorMessage: 'Connection refused',
      details: { code: 'ECONNREFUSED', host: 'sms.example.com' },
      checkedBy: 'manual',
    });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO service_health_checks'),
      ['sms_gateway', 'down', null, null, 'Connection refused', expect.any(String), 'manual']
    );
  });
});

describe('getLatestHealthStatus', () => {
  test('returns latest check per service + fallback for unconfigured', async () => {
    // Service health checks
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, service_name: 'razorpay', status: 'up', response_time_ms: 120 }] })
      // Integration configs
      .mockResolvedValueOnce({ rows: [
        { service_name: 'razorpay', display_name: 'Razorpay', is_enabled: true, last_checked_at: null },
        { service_name: 'sms_gateway', display_name: 'SMS Gateway', is_enabled: true, last_checked_at: null },
      ] });

    const result = await apiManagement.getLatestHealthStatus();

    // razorpay has a check, sms_gateway falls back to 'unknown'
    expect(result).toHaveLength(2);
    expect(result.find(r => r.service_name === 'razorpay')?.status).toBe('up');
    expect(result.find(r => r.service_name === 'sms_gateway')?.status).toBe('unknown');
  });
});

describe('getHealthCheckHistory', () => {
  test('returns history for a service filtered by hours', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ id: 1, service_name: 'razorpay', status: 'up' }] });

    const result = await apiManagement.getHealthCheckHistory('razorpay', 48);

    expect(result).toHaveLength(1);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE service_name = $1'),
      ['razorpay', 48]
    );
  });
});

describe('getUptimeStats', () => {
  test('returns uptime percentage per service', async () => {
    mockPool.query.mockResolvedValue({ rows: [
      { service_name: 'razorpay', total_checks: 100, up_count: 98, degraded_count: 2, down_count: 0, uptime_pct: 98, avg_response_ms: 150 },
    ] });

    const result = await apiManagement.getUptimeStats(7);

    expect(result).toHaveLength(1);
    expect(result[0].uptime_pct).toBe(98);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('uptime_pct'),
      [7]
    );
  });
});

// ═══════════════════════════════════════════════════════════
// INTEGRATION CONFIGURATION
// ═══════════════════════════════════════════════════════════

describe('getIntegrationConfigs', () => {
  test('returns configs with latest health status', async () => {
    mockPool.query.mockResolvedValue({ rows: [
      { id: 1, service_name: 'razorpay', display_name: 'Razorpay', is_enabled: true, current_status: 'up' },
    ] });

    const result = await apiManagement.getIntegrationConfigs();

    expect(result).toHaveLength(1);
    expect(result[0].current_status).toBe('up');
  });
});

describe('upsertIntegrationConfig', () => {
  test('inserts a new config', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ id: 1, service_name: 'razorpay', is_enabled: true }] });

    const result = await apiManagement.upsertIntegrationConfig({
      serviceName: 'razorpay',
      displayName: 'Razorpay Payments',
      baseUrl: 'https://api.razorpay.com',
      isEnabled: true,
    });

    expect(result.id).toBe(1);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      ['razorpay', 'Razorpay Payments', 'https://api.razorpay.com', '{}', true, '{}']
    );
  });

  test('updates an existing config by service_name', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ id: 1, service_name: 'razorpay' }] });

    await apiManagement.upsertIntegrationConfig({
      serviceName: 'razorpay',
      displayName: 'Updated Name',
      isEnabled: false,
    });

    // Verify it's an upsert (ON CONFLICT)
    expect(mockPool.query.mock.calls[0][0]).toContain('ON CONFLICT');
  });
});

describe('toggleIntegration', () => {
  test('enables a config', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ id: 1, service_name: 'razorpay', is_enabled: true }] });

    const result = await apiManagement.toggleIntegration('razorpay', true);

    expect(result.is_enabled).toBe(true);
  });

  test('disables a config', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ id: 1, service_name: 'razorpay', is_enabled: false }] });

    const result = await apiManagement.toggleIntegration('razorpay', false);

    expect(result.is_enabled).toBe(false);
  });

  test('throws error if integration not found', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    await expect(apiManagement.toggleIntegration('unknown', true)).rejects.toThrow('not found');
  });
});
