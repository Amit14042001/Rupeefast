/**
 * Route tests for Loan Offers API Endpoints.
 *
 * GET  /api/offers           — List user's pre-approved loan offers
 * POST /api/offers/accept    — Accept an offer → creates a loan
 * POST /api/offers/reject    — Reject an offer
 *
 * These tests mock the database module to focus on route-level behaviour:
 * auth, validation, response shape, error handling, and data access patterns.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// ── Mock database module (required by server.js startup) ──
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

const validToken = generateToken();
const borrowerToken = generateToken({ id: 2, role: 'borrower' });

beforeEach(() => {
  setDb(mockDb);
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════
// AUTH GUARDS — All offer routes require authentication
// ═══════════════════════════════════════════════════════════

describe('Offer Routes — Auth guards', () => {
  const protectedRoutes = [
    { method: 'get', path: '/api/offers/' },
    { method: 'post', path: '/api/offers/accept', body: { offer_id: 1 } },
    { method: 'post', path: '/api/offers/reject', body: { offer_id: 1 } },
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
// GET /api/offers
// ═══════════════════════════════════════════════════════════

describe('GET /api/offers', () => {
  test('returns empty offers array when user has none', async () => {
    mockDb.all.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/offers/')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.offers).toEqual([]);
    // Query scoped to authenticated user
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('WHERE user_id = $1'),
      [1]
    );
  });

  test('returns all offers for the authenticated user', async () => {
    const fakeOffers = [
      { id: 1, user_id: 1, amount: 5000, status: 'pending', interest_rate: 12, created_at: '2025-01-01T00:00:00Z' },
      { id: 2, user_id: 1, amount: 10000, status: 'pending', interest_rate: 10, created_at: '2025-01-02T00:00:00Z' },
    ];
    mockDb.all.mockResolvedValue(fakeOffers);

    const res = await request(app)
      .get('/api/offers/')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.offers).toHaveLength(2);
    expect(res.body.offers[0].amount).toBe(5000);
    expect(res.body.offers[1].status).toBe('pending');
    // Ordered by created_at DESC
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY created_at DESC'),
      [1]
    );
  });

  test('filters offers by status query parameter', async () => {
    mockDb.all.mockResolvedValue([]);

    await request(app)
      .get('/api/offers/?status=pending')
      .set('Authorization', `Bearer ${validToken}`);

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('AND status = $2'),
      [1, 'pending']
    );
  });

  test('returns 500 if database throws an error', async () => {
    mockDb.all.mockRejectedValue(new Error('Query failed'));

    const res = await request(app)
      .get('/api/offers/')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Query failed');
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/offers/accept
// ═══════════════════════════════════════════════════════════

describe('POST /api/offers/accept', () => {
  const pendingOffer = {
    id: 1,
    user_id: 1,
    amount: 5000,
    interest_rate: 12,
    processing_fee: 250,
    status: 'pending',
    source: 'pre_approved',
    expires_at: new Date(Date.now() + 86400000).toISOString(), // tomorrow
  };

  test('returns 400 if offer_id is missing', async () => {
    const res = await request(app)
      .post('/api/offers/accept')
      .set('Authorization', `Bearer ${validToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('offer_id is required');
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  test('returns 400 if user already has an active loan', async () => {
    mockDb.get
      .mockResolvedValueOnce({ id: 99 }) // active loan exists
      .mockResolvedValueOnce(pendingOffer); // this second call shouldn't matter

    const res = await request(app)
      .post('/api/offers/accept')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ offer_id: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already have an active loan');
    // Should not proceed to check the offer
    expect(mockDb.get).toHaveBeenCalledTimes(1);
  });

  test('returns 404 if offer is not found', async () => {
    mockDb.get
      .mockResolvedValueOnce(null) // no active loan
      .mockResolvedValueOnce(undefined); // offer not found

    const res = await request(app)
      .post('/api/offers/accept')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ offer_id: 999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Offer not found');
  });

  test('returns 400 if offer is not in pending status', async () => {
    mockDb.get
      .mockResolvedValueOnce(null) // no active loan
      .mockResolvedValueOnce({ ...pendingOffer, status: 'converted' }); // already accepted

    const res = await request(app)
      .post('/api/offers/accept')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ offer_id: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already converted');
    expect(res.body.currentStatus).toBe('converted');
  });

  test('returns 400 if offer has expired', async () => {
    const expiredOffer = {
      ...pendingOffer,
      expires_at: new Date(Date.now() - 86400000).toISOString(), // yesterday
    };
    mockDb.get
      .mockResolvedValueOnce(null) // no active loan
      .mockResolvedValueOnce(expiredOffer); // expired offer

    const res = await request(app)
      .post('/api/offers/accept')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ offer_id: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('expired');
    // Should mark offer as expired in DB
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE loan_offers SET status'),
      ['expired', 1]
    );
  });

  test('successfully accepts an offer and creates a loan', async () => {
    mockDb.get
      .mockResolvedValueOnce(null) // no active loan
      .mockResolvedValueOnce(pendingOffer); // valid pending offer

    mockDb.run
      .mockResolvedValueOnce({ lastID: 42, rowCount: 1, rows: [{ id: 42 }] }) // INSERT loan
      .mockResolvedValueOnce({ lastID: null, rowCount: 1, rows: [] }); // UPDATE offer

    const res = await request(app)
      .post('/api/offers/accept')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ offer_id: 1 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.loan_id).toBe(42);
    expect(res.body.message).toContain('Offer accepted');

    // Verify loan was created with offer terms
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO loans'),
      [
        1,                       // user_id
        5000,                    // offer.amount
        12,                      // offer.interest_rate
        250,                     // offer.processing_fee
        'Pre-approved offer (pre_approved)',
        'applied',
      ]
    );

    // Verify offer was marked as converted with loan reference
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE loan_offers SET status'),
      ['converted', 42, 1]
    );
  });

  test('accepts an offer with zero processing fee', async () => {
    const noFeeOffer = { ...pendingOffer, processing_fee: null };
    mockDb.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(noFeeOffer);
    mockDb.run
      .mockResolvedValueOnce({ lastID: 43, rowCount: 1, rows: [{ id: 43 }] })
      .mockResolvedValueOnce({ lastID: null, rowCount: 1, rows: [] });

    const res = await request(app)
      .post('/api/offers/accept')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ offer_id: 1 });

    expect(res.status).toBe(201);
    expect(res.body.loan_id).toBe(43);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO loans'),
      [1, 5000, 12, 0, expect.any(String), 'applied']
    );
  });

  test('returns 500 if database throws an error', async () => {
    mockDb.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(pendingOffer);
    mockDb.run.mockRejectedValue(new Error('Insert failed'));

    const res = await request(app)
      .post('/api/offers/accept')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ offer_id: 1 });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Insert failed');
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/offers/reject
// ═══════════════════════════════════════════════════════════

describe('POST /api/offers/reject', () => {
  const pendingOffer = {
    id: 1,
    user_id: 1,
    amount: 5000,
    status: 'pending',
    source: 'pre_approved',
  };

  test('returns 400 if offer_id is missing', async () => {
    const res = await request(app)
      .post('/api/offers/reject')
      .set('Authorization', `Bearer ${validToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('offer_id is required');
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  test('returns 404 if offer is not found', async () => {
    mockDb.get.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/offers/reject')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ offer_id: 999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Offer not found');
  });

  test('returns 400 if offer is not pending', async () => {
    mockDb.get.mockResolvedValue({ ...pendingOffer, status: 'converted' });

    const res = await request(app)
      .post('/api/offers/reject')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ offer_id: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already converted');
    expect(res.body.currentStatus).toBe('converted');
  });

  test('successfully rejects a pending offer', async () => {
    mockDb.get.mockResolvedValue(pendingOffer);
    mockDb.run.mockResolvedValue({ lastID: null, rowCount: 1, rows: [] });

    const res = await request(app)
      .post('/api/offers/reject')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ offer_id: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Offer rejected');

    // Verify offer was marked as rejected
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE loan_offers SET status'),
      ['rejected', 1]
    );
  });

  test('returns 500 if database throws an error', async () => {
    mockDb.get.mockResolvedValue(pendingOffer);
    mockDb.run.mockRejectedValue(new Error('Update failed'));

    const res = await request(app)
      .post('/api/offers/reject')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ offer_id: 1 });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Update failed');
  });
});
