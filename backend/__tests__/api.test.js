const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock the database module before requiring server
const mockDb = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn(),
  exec: jest.fn(),
  pool: undefined,
};

jest.mock('../src/database', () => jest.fn(() => Promise.resolve(mockDb)));

// Enable mock OTP for auth endpoint tests
process.env.ALLOW_MOCK_OTP = 'true';

const { app, setDb } = require('../src/server');

// Helper to generate a valid test token
function generateToken(overrides = {}) {
  return jwt.sign(
    { id: 1, mobile: '9876543210', role: 'borrower', ...overrides },
    process.env.JWT_SECRET || 'test-secret-not-for-production',
    { expiresIn: '7d' }
  );
}

beforeEach(() => {
  setDb(mockDb);
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════
// GET /api/health
// ═══════════════════════════════════════════════════════
describe('GET /api/health', () => {
  test('returns 200 with status, uptime, and timestamp', async () => {
    mockDb.get.mockResolvedValue({});
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.uptime).toBeGreaterThan(0);
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.database).toBe('connected');
    // Without a pool property, migration data should not be present
    expect(res.body.migrations).toBeUndefined();
  });

  test('returns degraded when DB is unreachable', async () => {
    mockDb.get.mockRejectedValue(new Error('Connection refused'));
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.database).toBe('disconnected');
  });

  test('returns not_initialized when db is null', async () => {
    setDb(null);
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('not_initialized');
    expect(res.body.status).toBe('ok');
  });

  test('includes migrations data when db has a pool (simulating real DB setup)', async () => {
    // Provide a mock pool so the migration check is attempted
    const mockPool = {
      connect: jest.fn().mockRejectedValue(new Error('pool not real')),
    };
    mockDb.pool = mockPool;
    mockDb.get.mockResolvedValue({});
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    // Pool connect will fail (it's a mock), so migrations should default to zeros
    expect(res.body.migrations).toBeDefined();
    expect(res.body.migrations).toHaveProperty('applied');
    expect(res.body.migrations).toHaveProperty('pending');
    expect(res.body.migrations).toHaveProperty('latest');
  });
});

// ═══════════════════════════════════════════════════════
// POST /api/auth/login
// ═══════════════════════════════════════════════════════
describe('POST /api/auth/login', () => {
  test('returns 400 if mobile number is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ role: 'borrower' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
    expect(res.body.details[0].field).toBe('mobile');
  });

  test('returns 400 if mobile number is invalid format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ mobile: '12345', role: 'borrower' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
    expect(res.body.details[0].field).toBe('mobile');
    expect(res.body.details[0].message).toContain('10-digit');
  });

  test('logs in existing user and returns JWT token', async () => {
    const existingUser = { id: 1, mobile: '9876543210', role: 'borrower', name: 'Test User' };
    mockDb.get.mockResolvedValue(existingUser);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ mobile: '9876543210', role: 'borrower' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.id).toBe(1);
    expect(res.body.token).toBeDefined();
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.id).toBe(1);
    expect(decoded.role).toBe('borrower');
  });

  test('registers a new user if mobile does not exist', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);
    mockDb.run.mockResolvedValue({ lastID: 2, rowCount: 1, rows: [{ id: 2 }] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ mobile: '9988776655', role: 'investor' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.id).toBe(2);
    expect(res.body.user.role).toBe('investor');
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      ['9988776655', 'investor']
    );
  });

  test('uses default borrower role if role is not provided', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);
    mockDb.run.mockResolvedValue({ lastID: 3, rowCount: 1, rows: [{ id: 3 }] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ mobile: '9123456789' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('borrower');
  });

  test('returns 500 if database throws an error', async () => {
    mockDb.get.mockRejectedValue(new Error('Connection refused'));
    const res = await request(app)
      .post('/api/auth/login')
      .send({ mobile: '9876543210', role: 'borrower' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Connection refused');
  });

  test('returns 400 if mobile starts with non-6-9 digit', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ mobile: '5123456789', role: 'borrower' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
    expect(res.body.details[0].field).toBe('mobile');
  });

  test('returns 400 if mobile has non-digit characters (spaces)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ mobile: '98765 43210', role: 'borrower' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
    expect(res.body.details[0].field).toBe('mobile');
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/user/:id/dashboard (Protected)
// ═══════════════════════════════════════════════════════
describe('GET /api/user/:id/dashboard', () => {
  const validToken = generateToken();

  test('returns 401 if no auth token is provided', async () => {
    const res = await request(app).get('/api/user/1/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  test('returns 401 if token is invalid', async () => {
    const res = await request(app)
      .get('/api/user/1/dashboard')
      .set('Authorization', 'Bearer invalid-token-here');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired token');
  });

  test('returns 403 if user tries to access another user\'s dashboard', async () => {
    const token = generateToken({ id: 2 });
    const res = await request(app)
      .get('/api/user/1/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Unauthorized access');
  });

  test('returns 404 if user is not found in database', async () => {
    mockDb.get.mockResolvedValue(undefined);
    const res = await request(app)
      .get('/api/user/1/dashboard')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });

  test('returns borrower dashboard with active loan and repayments', async () => {
    const user = { id: 1, mobile: '9876543210', role: 'borrower', name: 'Ravi', trust_score: 72 };
    const activeLoan = { id: 10, amount: 10000, status: 'active' };
    const recentRepayments = [{ id: 1, amount: 120, status: 'paid' }, { id: 2, amount: 120, status: 'paid' }];
    mockDb.get.mockResolvedValueOnce(user);
    mockDb.get.mockResolvedValueOnce(activeLoan);
    mockDb.all.mockResolvedValue(recentRepayments);
    const res = await request(app)
      .get('/api/user/1/dashboard')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('borrower');
    expect(res.body.activeLoan.id).toBe(10);
    expect(res.body.recentRepayments).toHaveLength(2);
  });

  test('returns investor dashboard with investments', async () => {
    const token = generateToken({ id: 2, role: 'investor' });
    const user = { id: 2, mobile: '9876543210', role: 'investor', name: 'Priya' };
    const investments = [{ id: 1, amount: 5000, risk_bucket: 'safe' }, { id: 2, amount: 3000, risk_bucket: 'moderate' }];
    mockDb.get.mockResolvedValue(user);
    mockDb.all.mockResolvedValue(investments);
    const res = await request(app)
      .get('/api/user/2/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('investor');
    expect(res.body.investments).toHaveLength(2);
    expect(res.body.totalEarned).toBe(1455);
  });

  test('returns agent dashboard with pending tasks', async () => {
    const token = generateToken({ id: 3, role: 'agent' });
    const user = { id: 3, mobile: '9876543210', role: 'agent', name: 'Vikram' };
    const tasks = [{ id: 1, task_type: 'collect', status: 'pending' }, { id: 2, task_type: 'verify', status: 'pending' }];
    mockDb.get.mockResolvedValue(user);
    mockDb.all.mockResolvedValue(tasks);
    const res = await request(app)
      .get('/api/user/3/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('agent');
    expect(res.body.tasks).toHaveLength(2);
  });

  test('returns 500 if database throws an error', async () => {
    mockDb.get.mockRejectedValue(new Error('Connection lost'));
    const res = await request(app)
      .get('/api/user/1/dashboard')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Connection lost');
  });

  test('returns borrower dashboard with NO active loan', async () => {
    const user = { id: 1, mobile: '9876543210', role: 'borrower', name: 'NoLoanUser', trust_score: 50 };
    mockDb.get.mockResolvedValueOnce(user);
    // activeLoan is null — no active loan exists
    mockDb.get.mockResolvedValueOnce(null);
    // recentRepayments with null subquery returns empty
    mockDb.all.mockResolvedValue([]);
    const res = await request(app)
      .get('/api/user/1/dashboard')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('borrower');
    expect(res.body.activeLoan).toBeNull();
    expect(res.body.recentRepayments).toEqual([]);
  });

  test('returns 401 if Authorization header has wrong format', async () => {
    const res = await request(app)
      .get('/api/user/1/dashboard')
      .set('Authorization', 'Token 12345');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  test('returns 401 if Authorization header is empty Bearer token', async () => {
    const res = await request(app)
      .get('/api/user/1/dashboard')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/user/:id/dashboard — Admin Role
// ═══════════════════════════════════════════════════════
describe('GET /api/user/:id/dashboard (Admin Role)', () => {
  test('returns user data even for unhandled roles (no role-specific data)', async () => {
    const token = generateToken({ id: 5, role: 'admin' });
    const user = { id: 5, mobile: '9876543210', role: 'admin', name: 'Admin' };
    mockDb.get.mockResolvedValue(user);
    const res = await request(app)
      .get('/api/user/5/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
    // No role-specific data (investments, tasks, etc.) for unhandled roles
    expect(res.body.activeLoan).toBeUndefined();
    expect(res.body.investments).toBeUndefined();
    expect(res.body.tasks).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════
// POST /api/loans/apply (Protected)
// ═══════════════════════════════════════════════════════
describe('POST /api/loans/apply', () => {
  const validToken = generateToken({ id: 1, role: 'borrower' });

  test('returns 401 if no auth token is provided', async () => {
    const res = await request(app)
      .post('/api/loans/apply')
      .send({ amount: 10000, plan: 'Daily', purpose: 'Business expansion' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  test('returns 400 if amount is below minimum', async () => {
    const res = await request(app)
      .post('/api/loans/apply')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ amount: 500, plan: 'Daily', purpose: 'Business' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('returns 400 if amount exceeds maximum', async () => {
    const res = await request(app)
      .post('/api/loans/apply')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ amount: 100000, plan: 'Daily', purpose: 'Business' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('returns 400 if amount is missing', async () => {
    const res = await request(app)
      .post('/api/loans/apply')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ plan: 'Daily', purpose: 'Business' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('returns 400 if plan is invalid', async () => {
    const res = await request(app)
      .post('/api/loans/apply')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ amount: 10000, plan: 'Yearly', purpose: 'Business' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('returns 400 if purpose is too short', async () => {
    const res = await request(app)
      .post('/api/loans/apply')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ amount: 10000, plan: 'Weekly', purpose: 'AB' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('successfully creates a loan application', async () => {
    mockDb.run.mockResolvedValue({ lastID: 42, rowCount: 1, rows: [{ id: 42 }] });
    const res = await request(app)
      .post('/api/loans/apply')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ amount: 25000, plan: 'Monthly', purpose: 'Home renovation' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.loan_id).toBe(42);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO loans'),
      [1, 25000, 'Monthly', 'Home renovation', 'applied']
    );
  });

  test('returns 500 if database throws an error', async () => {
    mockDb.run.mockRejectedValue(new Error('Insert failed'));
    const res = await request(app)
      .post('/api/loans/apply')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ amount: 10000, plan: 'Daily', purpose: 'Business' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Insert failed');
  });

  test('accepts minimum valid amount of 2000', async () => {
    mockDb.run.mockResolvedValue({ lastID: 50, rowCount: 1, rows: [{ id: 50 }] });
    const res = await request(app)
      .post('/api/loans/apply')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ amount: 2000, plan: 'Daily', purpose: 'Emergency' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('accepts maximum valid amount of 50000', async () => {
    mockDb.run.mockResolvedValue({ lastID: 51, rowCount: 1, rows: [{ id: 51 }] });
    const res = await request(app)
      .post('/api/loans/apply')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ amount: 50000, plan: 'Monthly', purpose: 'Business expansion' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 400 if amount is 0', async () => {
    const res = await request(app)
      .post('/api/loans/apply')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ amount: 0, plan: 'Daily', purpose: 'Business' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('returns 400 if amount is a non-numeric string — Zod catches numeric type', async () => {
    // Zod's z.number() rejects non-numeric strings — this is an improvement
    // over the old code which would pass NaN to the DB.
    const res = await request(app)
      .post('/api/loans/apply')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ amount: 'abc', plan: 'Daily', purpose: 'Business' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
    expect(res.body.details[0].field).toBe('amount');
  });

  test('returns 400 if plan has wrong casing (lowercase)', async () => {
    const res = await request(app)
      .post('/api/loans/apply')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ amount: 10000, plan: 'daily', purpose: 'Business' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('handles whitespace purpose that passes Zod min(3) check', async () => {
    // Zod's .min(3) checks length, not trimmed length. '   ' has length 3.
    // The DB handler inserts it without issue.
    mockDb.run.mockResolvedValue({ lastID: 52, rowCount: 1, rows: [{ id: 52 }] });
    const res = await request(app)
      .post('/api/loans/apply')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ amount: 10000, plan: 'Weekly', purpose: '   ' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('allows non-borrower roles to apply for loans', async () => {
    const investorToken = generateToken({ id: 2, role: 'investor' });
    mockDb.run.mockResolvedValue({ lastID: 60, rowCount: 1, rows: [{ id: 60 }] });
    const res = await request(app)
      .post('/api/loans/apply')
      .set('Authorization', `Bearer ${investorToken}`)
      .send({ amount: 10000, plan: 'Daily', purpose: 'Personal' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
