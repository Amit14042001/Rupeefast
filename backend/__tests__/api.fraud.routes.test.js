/**
 * Route tests for Admin Fraud Events API Endpoints.
 *
 * GET  /api/admin/fraud/events              — List fraud events (filterable)
 * POST /api/admin/fraud/events/:id/status   — Update fraud event status
 *
 * These tests mock the database module to focus on route-level behaviour:
 * admin auth, status lifecycle transitions, validation, error handling.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// ── Mock database module ──
const mockDb = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn(),
  exec: jest.fn(),
  pool: undefined,
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
// AUTH GUARDS — All fraud routes require admin role
// ═══════════════════════════════════════════════════════════

describe('Fraud Event Routes — Auth guards', () => {
  const adminRoutes = [
    { method: 'get', path: '/api/admin/fraud/' },
    { method: 'post', path: '/api/admin/fraud/1/status', body: { status: 'investigating' } },
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
// GET /api/admin/fraud/
// ═══════════════════════════════════════════════════════════

describe('GET /api/admin/fraud/', () => {
  test('returns empty events array when none exist', async () => {
    mockDb.all.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/admin/fraud/')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.events).toEqual([]);
  });

  test('returns all fraud events ordered by creation date DESC', async () => {
    const fakeEvents = [
      { id: 1, event_type: 'multiple_login', severity: 'high', status: 'open', user_id: 3, created_at: '2025-01-02T00:00:00Z' },
      { id: 2, event_type: 'suspicious_transaction', severity: 'critical', status: 'investigating', user_id: 4, created_at: '2025-01-01T00:00:00Z' },
    ];
    mockDb.all.mockResolvedValue(fakeEvents);

    const res = await request(app)
      .get('/api/admin/fraud/')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);
    expect(res.body.events[0].severity).toBe('high');
    expect(res.body.events[1].event_type).toBe('suspicious_transaction');
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY created_at DESC'),
      []
    );
  });

  test('filters events by severity', async () => {
    mockDb.all.mockResolvedValue([]);

    await request(app)
      .get('/api/admin/fraud/?severity=critical')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('severity = $1'),
      ['critical']
    );
  });

  test('filters events by status', async () => {
    mockDb.all.mockResolvedValue([]);

    await request(app)
      .get('/api/admin/fraud/?status=open')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('status = $1'),
      ['open']
    );
  });

  test('filters events by type', async () => {
    mockDb.all.mockResolvedValue([]);

    await request(app)
      .get('/api/admin/fraud/?type=multiple_login')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('event_type = $1'),
      ['multiple_login']
    );
  });

  test('combines multiple filters', async () => {
    mockDb.all.mockResolvedValue([]);

    await request(app)
      .get('/api/admin/fraud/?severity=high&status=open&type=multiple_login')
      .set('Authorization', `Bearer ${adminToken}`);

    const sql = mockDb.all.mock.calls[0][0];
    expect(sql).toContain('severity = $1');
    expect(sql).toContain('status = $2');
    expect(sql).toContain('event_type = $3');
    expect(mockDb.all.mock.calls[0][1]).toEqual(['high', 'open', 'multiple_login']);
  });

  test('returns 500 if database throws an error', async () => {
    mockDb.all.mockRejectedValue(new Error('Query failed'));

    const res = await request(app)
      .get('/api/admin/fraud/')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Query failed');
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/admin/fraud/:id/status
// ═══════════════════════════════════════════════════════════

describe('POST /api/admin/fraud/:id/status', () => {
  const openEvent = {
    id: 1,
    event_type: 'multiple_login',
    severity: 'high',
    status: 'open',
    user_id: 3,
    created_at: '2025-01-01T00:00:00Z',
    resolved_at: null,
    resolved_by: null,
    resolution: null,
    action_taken: null,
  };

  const investigatingEvent = { ...openEvent, id: 2, status: 'investigating' };
  const confirmedEvent   = { ...openEvent, id: 3, status: 'confirmed' };

  test('returns 400 for invalid event ID', async () => {
    const res = await request(app)
      .post('/api/admin/fraud/abc/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'investigating' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid event ID');
  });

  test('returns 400 if status field is missing', async () => {
    const res = await request(app)
      .post('/api/admin/fraud/1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('status is required');
  });

  test('returns 400 for an invalid status value', async () => {
    const res = await request(app)
      .post('/api/admin/fraud/1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'nonexistent_status' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid status');
  });

  test('returns 404 if event is not found', async () => {
    mockDb.get.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/admin/fraud/999/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'investigating' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Fraud event not found');
  });

  test('returns 400 for invalid status transition (open → confirmed directly)', async () => {
    mockDb.get.mockResolvedValue(openEvent);

    const res = await request(app)
      .post('/api/admin/fraud/1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Cannot transition');
    expect(res.body.currentStatus).toBe('open');
    expect(res.body.allowedTransitions).toContain('investigating');
    expect(res.body.allowedTransitions).toContain('dismissed');
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  test('returns 400 for invalid status transition (open → resolved directly)', async () => {
    mockDb.get.mockResolvedValue(openEvent);

    const res = await request(app)
      .post('/api/admin/fraud/1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resolved' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Cannot transition');
  });

  test('allows open → investigating transition', async () => {
    const updatedEvent = { ...openEvent, status: 'investigating' };
    mockDb.get
      .mockResolvedValueOnce(openEvent)
      .mockResolvedValueOnce(updatedEvent);
    mockDb.run.mockResolvedValue({ lastID: null, rowCount: 1, rows: [] });

    const res = await request(app)
      .post('/api/admin/fraud/1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'investigating' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.event.status).toBe('investigating');
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE fraud_events SET status'),
      ['investigating', 1]
    );
  });

  test('allows open → dismissed transition', async () => {
    const updatedEvent = { ...openEvent, status: 'dismissed', resolved_at: '2025-01-02T00:00:00Z', resolved_by: 1 };
    mockDb.get
      .mockResolvedValueOnce(openEvent)
      .mockResolvedValueOnce(updatedEvent);
    mockDb.run.mockResolvedValue({ lastID: null, rowCount: 1, rows: [] });

    const res = await request(app)
      .post('/api/admin/fraud/1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'dismissed', resolution: 'False positive — user verified' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.event.status).toBe('dismissed');

    // Dismissed sets resolved_at and resolved_by
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('resolved_at = CURRENT_TIMESTAMP'),
      ['dismissed', 1, 'False positive — user verified', 1]
    );
  });

  test('allows investigating → confirmed transition', async () => {
    const updatedEvent = { ...investigatingEvent, status: 'confirmed' };
    mockDb.get
      .mockResolvedValueOnce(investigatingEvent)
      .mockResolvedValueOnce(updatedEvent);
    mockDb.run.mockResolvedValue({ lastID: null, rowCount: 1, rows: [] });

    const res = await request(app)
      .post('/api/admin/fraud/2/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe('confirmed');
  });

  test('allows investigating → dismissed transition', async () => {
    const updatedEvent = { ...investigatingEvent, status: 'dismissed' };
    mockDb.get
      .mockResolvedValueOnce(investigatingEvent)
      .mockResolvedValueOnce(updatedEvent);
    mockDb.run.mockResolvedValue({ lastID: null, rowCount: 1, rows: [] });

    const res = await request(app)
      .post('/api/admin/fraud/2/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'dismissed' });

    expect(res.status).toBe(200);
  });

  test('allows confirmed → resolved transition', async () => {
    const updatedEvent = { ...confirmedEvent, status: 'resolved', resolved_at: '2025-01-03T00:00:00Z', resolved_by: 1 };
    mockDb.get
      .mockResolvedValueOnce(confirmedEvent)
      .mockResolvedValueOnce(updatedEvent);
    mockDb.run.mockResolvedValue({ lastID: null, rowCount: 1, rows: [] });

    const res = await request(app)
      .post('/api/admin/fraud/3/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resolved', resolution: 'User blocked and referred to authorities' });

    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe('resolved');

    // Resolved sets resolved_at and resolved_by
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('resolved_at = CURRENT_TIMESTAMP'),
      ['resolved', 1, 'User blocked and referred to authorities', 3]
    );
  });

  test('returns 400 for terminal status transitions (dismissed → anything)', async () => {
    mockDb.get.mockResolvedValue({ ...openEvent, id: 4, status: 'dismissed' });

    const res = await request(app)
      .post('/api/admin/fraud/4/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'open' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Cannot transition');
    expect(res.body.allowedTransitions).toEqual([]);
  });

  test('returns 400 for terminal status transitions (resolved → anything)', async () => {
    mockDb.get.mockResolvedValue({ ...openEvent, id: 5, status: 'resolved' });

    const res = await request(app)
      .post('/api/admin/fraud/5/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'open' });

    expect(res.status).toBe(400);
    expect(res.body.allowedTransitions).toEqual([]);
  });

  test('includes resolution notes when provided', async () => {
    const updatedEvent = { ...openEvent, status: 'dismissed', resolution: 'False positive' };
    mockDb.get
      .mockResolvedValueOnce(openEvent)
      .mockResolvedValueOnce(updatedEvent);
    mockDb.run.mockResolvedValue({ lastID: null, rowCount: 1, rows: [] });

    await request(app)
      .post('/api/admin/fraud/1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'dismissed', resolution: 'False positive' });

    // Resolution should be in the params array
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('resolution'),
      expect.arrayContaining(['False positive'])
    );
  });

  test('accepts action_taken alongside status update', async () => {
    const updatedEvent = { ...openEvent, status: 'investigating', action_taken: 'user_blocked' };
    mockDb.get
      .mockResolvedValueOnce(openEvent)
      .mockResolvedValueOnce(updatedEvent);
    mockDb.run.mockResolvedValue({ lastID: null, rowCount: 1, rows: [] });

    const res = await request(app)
      .post('/api/admin/fraud/1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'investigating', action_taken: 'user_blocked' });

    expect(res.status).toBe(200);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('action_taken'),
      expect.arrayContaining(['user_blocked'])
    );
  });

  test('returns 400 for invalid action_taken value', async () => {
    mockDb.get.mockResolvedValue(openEvent);

    const res = await request(app)
      .post('/api/admin/fraud/1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'investigating', action_taken: 'invalid_action' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid action');
  });

  test('returns 500 if database throws an error', async () => {
    mockDb.get.mockResolvedValue(openEvent);
    mockDb.run.mockRejectedValue(new Error('Update failed'));

    const res = await request(app)
      .post('/api/admin/fraud/1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'investigating' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Update failed');
  });
});
