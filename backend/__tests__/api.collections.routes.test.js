/**
 * Route tests for Collections/Logs API Endpoints.
 *
 * GET  /api/collections         — List collection logs (filterable)
 * POST /api/collections         — Create a new collection log entry
 * PUT  /api/collections/:id     — Update an existing collection log
 *
 * These tests mock the database module to focus on route-level behaviour:
 * auth, validation, role-based scoping, response shape, error handling.
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
    { id: 1, mobile: '9876543210', role: 'borrower', ...overrides },
    process.env.JWT_SECRET || 'test-secret-not-for-production',
    { expiresIn: '7d' }
  );
}

const agentToken = generateToken({ id: 6, role: 'agent' });
const adminToken = generateToken({ id: 8, role: 'admin' });
const borrowerToken = generateToken({ id: 2, role: 'borrower' });

beforeEach(() => {
  setDb(mockDb);
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════
// AUTH GUARDS — All collection routes require authentication
// ═══════════════════════════════════════════════════════════

describe('Collection Routes — Auth guards', () => {
  const protectedRoutes = [
    { method: 'get', path: '/api/collections/' },
    { method: 'post', path: '/api/collections/', body: { loan_id: 1, collection_type: 'phone_call' } },
    { method: 'put', path: '/api/collections/1', body: { notes: 'Updated' } },
  ];

  protectedRoutes.forEach(({ method, path, body }) => {
    test(`${method.toUpperCase()} ${path} returns 401 without auth token`, async () => {
      const req = request(app)[method](path);
      if (body) req.send(body);
      const res = await req;
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// GET /api/collections
// ═══════════════════════════════════════════════════════════

describe('GET /api/collections', () => {
  test('returns empty logs array when none exist', async () => {
    mockDb.all.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/collections/')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.logs).toEqual([]);
  });

  test('agents see only their own logs by default', async () => {
    const fakeLogs = [{ id: 1, agent_id: 6, loan_id: 1, collection_type: 'phone_call' }];
    mockDb.all.mockResolvedValue(fakeLogs);

    const res = await request(app)
      .get('/api/collections/')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.logs).toHaveLength(1);
    // Query is scoped to agent's own ID
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('agent_id = $1'),
      [6]
    );
  });

  test('admins see all logs without agent_id filter', async () => {
    const fakeLogs = [
      { id: 1, agent_id: 6, collection_type: 'phone_call' },
      { id: 2, agent_id: 7, collection_type: 'home_visit' },
    ];
    mockDb.all.mockResolvedValue(fakeLogs);

    const res = await request(app)
      .get('/api/collections/')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.logs).toHaveLength(2);
    // Admin without agent_id sees all — no filter added
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.not.stringContaining('WHERE'),
      []
    );
  });

  test('admins can filter logs by a specific agent_id', async () => {
    mockDb.all.mockResolvedValue([]);

    await request(app)
      .get('/api/collections/?agent_id=7')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('agent_id = $1'),
      [7]
    );
  });

  test('filters by loan_id and status', async () => {
    mockDb.all.mockResolvedValue([]);

    await request(app)
      .get('/api/collections/?loan_id=10&status=completed')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('loan_id = $1'),
      expect.arrayContaining([10, 'completed'])
    );
  });

  test('returns 500 if database throws an error', async () => {
    mockDb.all.mockRejectedValue(new Error('Query failed'));

    const res = await request(app)
      .get('/api/collections/')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Query failed');
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/collections
// ═══════════════════════════════════════════════════════════

describe('POST /api/collections', () => {
  test('returns 400 if loan_id is missing', async () => {
    const res = await request(app)
      .post('/api/collections/')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ collection_type: 'phone_call' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('loan_id is required');
  });

  test('returns 400 if collection_type is missing', async () => {
    const res = await request(app)
      .post('/api/collections/')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ loan_id: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('collection_type is required');
  });

  test('returns 404 if referenced loan does not exist', async () => {
    mockDb.get.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/collections/')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ loan_id: 999, collection_type: 'phone_call' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Loan not found');
  });

  test('successfully creates a collection log with minimal fields', async () => {
    mockDb.get
      .mockResolvedValueOnce({ id: 1 }) // loan exists
      .mockResolvedValueOnce({ id: 10, loan_id: 1, agent_id: 6, collection_type: 'phone_call', status: 'scheduled' }); // fetched log
    mockDb.run.mockResolvedValue({ lastID: 10, rowCount: 1, rows: [{ id: 10 }] }); // INSERT

    const res = await request(app)
      .post('/api/collections/')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ loan_id: 1, collection_type: 'phone_call' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.log.id).toBe(10);
    expect(res.body.log.status).toBe('scheduled');

    // Verify insert with agent_id from token
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO collection_logs'),
      [1, 6, 'phone_call', 'scheduled', null, null, null, null, null, null, null, null, null, null, null, '[]']
    );
  });

  test('creates collection log with all optional fields', async () => {
    mockDb.get
      .mockResolvedValueOnce({ id: 1 }) // loan exists
      .mockResolvedValueOnce({ id: 11, loan_id: 1, agent_id: 6, collection_type: 'home_visit', status: 'completed' }); // fetched log
    mockDb.run.mockResolvedValue({ lastID: 11, rowCount: 1, rows: [{ id: 11 }] });

    const res = await request(app)
      .post('/api/collections/')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        loan_id: 1,
        collection_type: 'home_visit',
        status: 'completed',
        contacted_person: 'Spouse',
        relationship: 'wife',
        contact_method: 'in_person',
        amount_promised: 5000,
        promise_date: '2025-02-01',
        amount_collected: 2000,
        notes: 'Partial payment collected',
        outcome: 'promise_to_pay',
        location_lat: 12.9716,
        location_lng: 77.5946,
        duration_minutes: 30,
        attachments: ['photo1.jpg', 'photo2.jpg'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO collection_logs'),
      [1, 6, 'home_visit', 'completed', 'Spouse', 'wife', 'in_person', 5000, '2025-02-01', 2000, 'Partial payment collected', 'promise_to_pay', 12.9716, 77.5946, 30, '["photo1.jpg","photo2.jpg"]']
    );
  });

  test('defaults status to "scheduled" when not provided', async () => {
    mockDb.get
      .mockResolvedValueOnce({ id: 1 }) // loan exists
      .mockResolvedValueOnce({ id: 12, loan_id: 1, collection_type: 'phone_call', status: 'scheduled' }); // fetched log
    mockDb.run.mockResolvedValue({ lastID: 12, rowCount: 1, rows: [{ id: 12 }] });

    await request(app)
      .post('/api/collections/')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ loan_id: 1, collection_type: 'phone_call' });

    // Second param should have 'scheduled' as default status
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO collection_logs'),
      expect.arrayContaining(['phone_call', 'scheduled'])
    );
  });

  test('returns 500 if database throws during creation', async () => {
    mockDb.get.mockResolvedValue({ id: 1 });
    mockDb.run.mockRejectedValue(new Error('Insert failed'));

    const res = await request(app)
      .post('/api/collections/')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ loan_id: 1, collection_type: 'phone_call' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Insert failed');
  });
});

// ═══════════════════════════════════════════════════════════
// PUT /api/collections/:id
// ═══════════════════════════════════════════════════════════

describe('PUT /api/collections/:id', () => {
  const existingLog = { id: 1, agent_id: 6, loan_id: 1, collection_type: 'phone_call', status: 'scheduled', notes: null, outcome: null, attachments: '[]', updated_at: '2025-01-01T00:00:00Z' };
  const existingLogOtherAgent = { id: 2, agent_id: 7, loan_id: 1, collection_type: 'home_visit', status: 'completed', attachments: '[]' };

  test('returns 400 for invalid log ID', async () => {
    const res = await request(app)
      .put('/api/collections/abc')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ notes: 'Updated' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid log ID');
  });

  test('returns 404 if log is not found', async () => {
    mockDb.get.mockResolvedValue(undefined);

    const res = await request(app)
      .put('/api/collections/999')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ notes: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Collection log not found');
  });

  test('returns 403 if agent tries to update another agent\'s log', async () => {
    mockDb.get.mockResolvedValue(existingLogOtherAgent);

    const res = await request(app)
      .put('/api/collections/2')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ notes: 'Should fail' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('only update your own');
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  test('admin can update any agent\'s log', async () => {
    mockDb.get.mockResolvedValue(existingLogOtherAgent);
    mockDb.run.mockResolvedValue({ lastID: null, rowCount: 1, rows: [] });
    mockDb.get.mockResolvedValueOnce({ ...existingLogOtherAgent, notes: 'Updated by admin', status: 'completed' });

    const res = await request(app)
      .put('/api/collections/2')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Updated by admin' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 400 if no updatable fields are provided', async () => {
    mockDb.get.mockResolvedValue(existingLog);

    const res = await request(app)
      .put('/api/collections/1')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ non_existent_field: 'value' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No updatable fields provided');
  });

  test('successfully updates allowed fields on own log', async () => {
    mockDb.get
      .mockResolvedValueOnce(existingLog) // fetch existing
      .mockResolvedValueOnce({ ...existingLog, notes: 'Followed up', outcome: 'promise_to_pay', updated_at: '2025-01-02T00:00:00Z' }); // fetch updated

    mockDb.run.mockResolvedValue({ lastID: null, rowCount: 1, rows: [] });

    const res = await request(app)
      .put('/api/collections/1')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ notes: 'Followed up', outcome: 'promise_to_pay' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.log.notes).toBe('Followed up');
    expect(res.body.log.outcome).toBe('promise_to_pay');

    // Verify update with whitelist fields
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE collection_logs SET'),
      ['Followed up', 'promise_to_pay', 1]
    );
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('updated_at = CURRENT_TIMESTAMP'),
      expect.any(Array)
    );
  });

  test('serializes attachments as JSON string', async () => {
    mockDb.get
      .mockResolvedValueOnce(existingLog)
      .mockResolvedValueOnce({ ...existingLog, attachments: '["pic.jpg"]' });
    mockDb.run.mockResolvedValue({ lastID: null, rowCount: 1, rows: [] });

    await request(app)
      .put('/api/collections/1')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ attachments: ['pic.jpg'] });

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE collection_logs'),
      expect.arrayContaining(['["pic.jpg"]'])
    );
  });

  test('sanitises fields — only whitelisted fields are updatable', async () => {
    mockDb.get
      .mockResolvedValueOnce(existingLog)
      .mockResolvedValueOnce(existingLog);
    mockDb.run.mockResolvedValue({ lastID: null, rowCount: 1, rows: [] });

    await request(app)
      .put('/api/collections/1')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ notes: 'Updated', malicious_field: 'hack', amount: 999999 });

    // Only whitelisted fields (notes) should be in the SET clause
    const setClause = mockDb.run.mock.calls[0][0];
    expect(setClause).toContain('notes = $1');
    expect(setClause).not.toContain('malicious_field');
    expect(setClause).not.toContain('amount');
  });

  test('updates status to completed', async () => {
    mockDb.get
      .mockResolvedValueOnce(existingLog)
      .mockResolvedValueOnce({ ...existingLog, status: 'completed' });
    mockDb.run.mockResolvedValue({ lastID: null, rowCount: 1, rows: [] });

    const res = await request(app)
      .put('/api/collections/1')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 500 if database throws during update', async () => {
    mockDb.get
      .mockResolvedValueOnce(existingLog)
      .mockResolvedValueOnce(existingLog);
    mockDb.run.mockRejectedValue(new Error('Update failed'));

    const res = await request(app)
      .put('/api/collections/1')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ notes: 'Fail' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Update failed');
  });
});
