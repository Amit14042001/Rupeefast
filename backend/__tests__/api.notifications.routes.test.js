/**
 * Route tests for Notification Broadcasting API.
 *
 * Mocks the notifications module and the database to test auth guards,
 * validation, error handling, and response shapes for 7 admin endpoints.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// ── Mock notifications module before requiring server ──

const mockNotifications = {
  renderTemplate: jest.fn(),
  sendSingle: jest.fn(),
  broadcast: jest.fn(function() { return Promise.resolve({ total: 0, sent: 0, failed: 0, results: [] }); }),
  getBroadcastHistory: jest.fn(),
};

const mockAuditLog = jest.fn(function() { return Promise.resolve(undefined); });

jest.mock('../src/notifications', () => mockNotifications);

// ── Mock database module (required by server.js startup) ──
const mockDb = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn(),
  exec: jest.fn(),
};

jest.mock('../src/database', () => jest.fn(() => Promise.resolve(mockDb)));

// Mock redis so server starts without connection
jest.mock('../src/redis', () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  getClient: jest.fn().mockReturnValue(null),
  getStatus: jest.fn().mockReturnValue({ connected: false }),
  ping: jest.fn().mockResolvedValue(false),
  get: jest.fn().mockResolvedValue(null),
  setex: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
}));

// Mock other modules to prevent side effects
jest.mock('../src/otp', () => ({ send: jest.fn(function() { return Promise.resolve({ success: true }); }), verify: jest.fn(function() { return Promise.resolve({ success: true }); }), maskMobile: jest.fn(function(m) { return m ? m.slice(0,2)+'****'+m.slice(-2) : 'unknown'; }) }));
jest.mock('../src/razorpay', () => ({ createPlan: jest.fn(), createSubscription: jest.fn(), verifySubscriptionSignature: jest.fn(), cancelSubscription: jest.fn(), pauseSubscription: jest.fn(), resumeSubscription: jest.fn(), verifyWebhookSignature: jest.fn() }));
jest.mock('../src/metrics', () => ({ middleware: (req, res, next) => next(), handler: (req, res) => res.status(200).end(), usersCreated: { inc: jest.fn() }, loansApplied: { inc: jest.fn() }, loansDisbursed: { inc: jest.fn() }, kycSubmitted: { inc: jest.fn() }, mandatesCreated: { inc: jest.fn() }, mandatesCancelled: { inc: jest.fn() }, paymentVerifications: { inc: jest.fn() }, webhooksReceived: { inc: jest.fn() }, errorsTotal: { inc: jest.fn() } }));
jest.mock('../src/audit', () => ({ log: mockAuditLog, middleware: () => (req, res, next) => next() }));
jest.mock('../src/sentry', () => ({ requestHandler: (req, res, next) => next(), tracingHandler: (req, res, next) => next(), errorHandler: (err, req, res, next) => next(), captureError: jest.fn(), close: jest.fn() }));
jest.mock('../src/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), flushAndClose: jest.fn().mockResolvedValue(undefined) }));

const { app, setDb } = require('../src/server');

// Generate tokens AFTER server loads (so process.env.JWT_SECRET is set by dotenv)
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
  jest.clearAllMocks();
  // Re-apply default mock implementations that clearAllMocks may affect
  mockAuditLog.mockImplementation(() => Promise.resolve(undefined));
  mockNotifications.broadcast.mockImplementation(() => Promise.resolve({ total: 0, sent: 0, failed: 0, results: [] }));
  setDb(mockDb);
});

// ══════════════════════════════════════════════════
// AUTH GUARDS — all 7 endpoints
// ══════════════════════════════════════════════════

describe('Auth guards — all notification endpoints require admin', () => {
  const adminRoutes = [
    { method: 'get', path: '/api/admin/notifications/templates' },
    { method: 'post', path: '/api/admin/notifications/templates', body: { name: 'test', label: 'Test', channel: 'sms', body: 'Hello' } },
    { method: 'put', path: '/api/admin/notifications/templates/1', body: { label: 'Updated' } },
    { method: 'post', path: '/api/admin/notifications/broadcast', body: { message: 'Hello', channels: ['sms'] } },
    { method: 'get', path: '/api/admin/notifications/broadcasts' },
    { method: 'post', path: '/api/admin/notifications/broadcasts/1/cancel' },
    { method: 'get', path: '/api/admin/notifications/analytics' },
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

// ══════════════════════════════════════════════════
// GET /api/admin/notifications/templates
// ══════════════════════════════════════════════════

describe('GET /api/admin/notifications/templates', () => {
  const fakeTemplates = [
    { id: 1, name: 'welcome', label: 'Welcome SMS', channel: 'sms', body: 'Hello {{name}}', is_active: true },
    { id: 2, name: 'reminder', label: 'Payment Reminder', channel: 'whatsapp', body: 'Pay {{amount}}', is_active: true },
  ];

  test('returns all templates when no filters provided', async () => {
    mockDb.all.mockResolvedValue(fakeTemplates);

    const res = await request(app)
      .get('/api/admin/notifications/templates')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.templates).toHaveLength(2);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY label ASC'),
      []
    );
  });

  test('filters by channel', async () => {
    mockDb.all.mockResolvedValue([fakeTemplates[0]]);

    const res = await request(app)
      .get('/api/admin/notifications/templates?channel=sms')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('WHERE channel = $1'),
      ['sms']
    );
  });

  test('filters by active = true', async () => {
    mockDb.all.mockResolvedValue(fakeTemplates);

    const res = await request(app)
      .get('/api/admin/notifications/templates?active=true')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('is_active = TRUE'),
      []
    );
  });

  test('returns 500 on DB error', async () => {
    mockDb.all.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .get('/api/admin/notifications/templates')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
  });
});

// ══════════════════════════════════════════════════
// POST /api/admin/notifications/templates
// ══════════════════════════════════════════════════

describe('POST /api/admin/notifications/templates', () => {
  const newTemplate = { name: 'offer', label: 'Loan Offer', channel: 'push', body: 'You have a pre-approved loan!', subject: 'New Offer', variables: ['name'] };

  test('creates a template with all fields', async () => {
    mockDb.run.mockResolvedValue({ lastID: 3 });
    mockDb.get.mockResolvedValue({ id: 3, ...newTemplate, is_active: true });

    const res = await request(app)
      .post('/api/admin/notifications/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(newTemplate);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.template.id).toBe(3);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notification_templates'),
      expect.arrayContaining(['offer', 'Loan Offer', 'push', 'New Offer', expect.any(String), expect.any(String), 1])
    );
  });

  test('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/admin/notifications/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'Test', channel: 'sms', body: 'Hello' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('name');
  });

  test('returns 400 when channel is invalid', async () => {
    const res = await request(app)
      .post('/api/admin/notifications/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'test', label: 'Test', channel: 'email', body: 'Hello' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('channel must be');
  });

  test('stores subject as null when not provided', async () => {
    mockDb.run.mockResolvedValue({ lastID: 3 });
    mockDb.get.mockResolvedValue({ id: 3, name: 'test', label: 'Test', channel: 'sms', body: 'Hello', is_active: true });

    await request(app)
      .post('/api/admin/notifications/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'test', label: 'Test', channel: 'sms', body: 'Hello' });

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([null])
    );
  });

  test('returns 500 on DB error', async () => {
    mockDb.run.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/admin/notifications/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(newTemplate);

    expect(res.status).toBe(500);
  });
});

// ══════════════════════════════════════════════════
// PUT /api/admin/notifications/templates/:id
// ══════════════════════════════════════════════════

describe('PUT /api/admin/notifications/templates/:id', () => {
  test('updates with partial fields', async () => {
    mockDb.run.mockResolvedValue(undefined);
    mockDb.get.mockResolvedValue({ id: 1, label: 'Updated Label', is_active: true });

    const res = await request(app)
      .put('/api/admin/notifications/templates/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'Updated Label' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('serializes variables array to JSON', async () => {
    mockDb.run.mockResolvedValue(undefined);
    mockDb.get.mockResolvedValue({ id: 1, variables: ['name', 'amount'], is_active: true });

    await request(app)
      .put('/api/admin/notifications/templates/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ variables: ['name', 'amount'] });

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([JSON.stringify(['name', 'amount'])])
    );
  });

  test('returns 400 when no fields provided', async () => {
    const res = await request(app)
      .put('/api/admin/notifications/templates/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('No fields to update');
  });

  test('returns 500 on DB error', async () => {
    mockDb.run.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .put('/api/admin/notifications/templates/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'Test' });

    expect(res.status).toBe(500);
  });
});

// ══════════════════════════════════════════════════
// POST /api/admin/notifications/broadcast
// ══════════════════════════════════════════════════

describe('POST /api/admin/notifications/broadcast', () => {
  const validBroadcast = {
    message: 'Hello {{name}}',
    channels: ['sms', 'push'],
    title: 'Test Broadcast',
    target_roles: ['borrower'],
  };

  test('sends broadcast immediately and returns broadcast_id', async () => {
    mockDb.run.mockResolvedValue({ lastID: 42 });
    mockNotifications.broadcast.mockResolvedValue({ total: 1, sent: 1, failed: 0, results: [] });

    const res = await request(app)
      .post('/api/admin/notifications/broadcast')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validBroadcast);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.broadcast_id).toBe(42);
    expect(res.body.message).toContain('Broadcast started');
    expect(mockNotifications.broadcast).toHaveBeenCalled();
    expect(mockNotifications.broadcast.mock.calls[0][0].broadcastId).toBe(42);
  });

  test('resolves message from template_id when message is not provided', async () => {
    mockDb.get.mockResolvedValue({ id: 5, body: 'Template body', subject: 'Template Subject' });
    mockDb.run.mockResolvedValue({ lastID: 99 });
    mockNotifications.broadcast.mockResolvedValue({ total: 1, sent: 1, failed: 0, results: [] });

    await request(app)
      .post('/api/admin/notifications/broadcast')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ template_id: 5, channels: ['sms'] });

    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1'),
      [5]
    );
    expect(mockNotifications.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Template body',
        title: 'Template Subject',
      })
    );
  });

  test('returns 404 when template_id does not exist', async () => {
    mockDb.get.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/admin/notifications/broadcast')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ template_id: 999, channels: ['sms'] });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Template not found');
  });

  test('returns 400 when neither message nor template_id is provided', async () => {
    const res = await request(app)
      .post('/api/admin/notifications/broadcast')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ channels: ['sms'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('message or template_id');
  });

  test('returns 400 when channels is missing or empty', async () => {
    const res1 = await request(app)
      .post('/api/admin/notifications/broadcast')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: 'Hello' });

    expect(res1.status).toBe(400);
    expect(res1.body.error).toContain('At least one channel');

    const res2 = await request(app)
      .post('/api/admin/notifications/broadcast')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: 'Hello', channels: [] });

    expect(res2.status).toBe(400);
  });

  test('returns 400 when channel is invalid', async () => {
    const res = await request(app)
      .post('/api/admin/notifications/broadcast')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: 'Hello', channels: ['email'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid channel');
  });

  test('schedules broadcast when scheduled_for is provided', async () => {
    mockDb.run.mockResolvedValue({ lastID: 77 });

    const res = await request(app)
      .post('/api/admin/notifications/broadcast')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validBroadcast, scheduled_for: '2025-06-01T10:00:00Z' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('scheduled');
    expect(mockNotifications.broadcast).not.toHaveBeenCalled();
  });

  test('defaults target_roles when not provided', async () => {
    mockDb.run.mockResolvedValue({ lastID: 55 });
    mockNotifications.broadcast.mockResolvedValue({ total: 0, sent: 0, failed: 0, results: [] });

    await request(app)
      .post('/api/admin/notifications/broadcast')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: 'Hello', channels: ['sms'] });

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        expect.stringContaining('borrower'),
      ])
    );
  });

  test('returns 500 on DB error', async () => {
    mockDb.run.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/admin/notifications/broadcast')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validBroadcast);

    expect(res.status).toBe(500);
  });
});

// ══════════════════════════════════════════════════
// GET /api/admin/notifications/broadcasts
// ══════════════════════════════════════════════════

describe('GET /api/admin/notifications/broadcasts', () => {
  test('returns broadcast history with defaults', async () => {
    mockNotifications.getBroadcastHistory.mockResolvedValue({
      broadcasts: [{ id: 1, title: 'Test', status: 'sent' }],
      total: 1,
    });

    const res = await request(app)
      .get('/api/admin/notifications/broadcasts')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.broadcasts).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(mockNotifications.getBroadcastHistory).toHaveBeenCalledWith(
      mockDb,
      { status: undefined, channel: undefined, limit: 50, offset: 0 }
    );
  });

  test('passes query params to service', async () => {
    mockNotifications.getBroadcastHistory.mockResolvedValue({ broadcasts: [], total: 0 });

    await request(app)
      .get('/api/admin/notifications/broadcasts?status=sent&channel=sms&limit=10&offset=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(mockNotifications.getBroadcastHistory).toHaveBeenCalledWith(
      mockDb,
      { status: 'sent', channel: 'sms', limit: 10, offset: 20 }
    );
  });

  test('returns 500 on service error', async () => {
    mockNotifications.getBroadcastHistory.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .get('/api/admin/notifications/broadcasts')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
  });
});

// ══════════════════════════════════════════════════
// POST /api/admin/notifications/broadcasts/:id/cancel
// ══════════════════════════════════════════════════

describe('POST /api/admin/notifications/broadcasts/:id/cancel', () => {
  test('cancels a scheduled broadcast', async () => {
    mockDb.get.mockResolvedValue({ id: 1, status: 'scheduled', title: 'Test' });
    mockDb.run.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/admin/notifications/broadcasts/1/cancel')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Broadcast cancelled');
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining("SET status = $1"),
      ['cancelled', '1']
    );
  });

  test('cancels a draft broadcast', async () => {
    mockDb.get.mockResolvedValue({ id: 2, status: 'draft', title: 'Draft' });
    mockDb.run.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/admin/notifications/broadcasts/2/cancel')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 404 when broadcast not found', async () => {
    mockDb.get.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/admin/notifications/broadcasts/999/cancel')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Broadcast not found');
  });

  test('returns 400 when broadcast is already sent/completed', async () => {
    mockDb.get.mockResolvedValue({ id: 3, status: 'sent', title: 'Sent' });

    const res = await request(app)
      .post('/api/admin/notifications/broadcasts/3/cancel')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Cannot cancel');
  });

  test('returns 500 on DB error', async () => {
    mockDb.get.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/admin/notifications/broadcasts/1/cancel')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
  });
});

// ══════════════════════════════════════════════════
// GET /api/admin/notifications/analytics
// ══════════════════════════════════════════════════

describe('GET /api/admin/notifications/analytics', () => {
  test('returns aggregate stats, channel breakdown, and recent broadcasts', async () => {
    mockDb.get.mockResolvedValue({
      total_broadcasts: 10,
      total_recipients: 500,
      total_sent: 480,
      total_delivered: 450,
      total_failed: 20,
      total_opened: 200,
    });
    mockDb.all
      .mockResolvedValueOnce([
        { channel: 'sms', broadcast_count: 6, recipients: 300 },
        { channel: 'push', broadcast_count: 4, recipients: 200 },
      ])
      .mockResolvedValueOnce([
        { id: 1, title: 'Latest', status: 'sent', total_recipients: 50, sent_count: 48, failed_count: 2 },
      ]);

    const res = await request(app)
      .get('/api/admin/notifications/analytics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.stats.total_broadcasts).toBe(10);
    expect(res.body.channelStats).toHaveLength(2);
    expect(res.body.recent).toHaveLength(1);
  });

  test('returns 500 on DB error', async () => {
    mockDb.get.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .get('/api/admin/notifications/analytics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
  });
});
