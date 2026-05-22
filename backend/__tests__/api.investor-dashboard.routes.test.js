/**
 * Route tests for Admin Investor Dashboard Endpoints.
 *
 * These tests mock the investor-dashboard module entirely to focus on
 * route-level behaviour: auth, validation, error handling, and response shape.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// ── Mock investor-dashboard module before requiring server ──
const mockInvestorDashboard = {
  getPortfolioSummary: jest.fn(),
  getInvestors: jest.fn(),
  getInvestorDetail: jest.fn(),
  getAllocationRequests: jest.fn(),
  approveAllocationRequest: jest.fn(),
  rejectAllocationRequest: jest.fn(),
  executeAllocationRequest: jest.fn(),
  getInvestorMetrics: jest.fn(),
  getAumTrend: jest.fn(),
  recordDailySnapshots: jest.fn(),
  logInvestorActivity: jest.fn(),
  addInvestorNote: jest.fn(),
};

jest.mock('../src/investor-dashboard', () => mockInvestorDashboard);

// ── Mock database module (required by server.js startup) ──
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

describe('Investor Dashboard — Auth guards', () => {
  const adminRoutes = [
    { method: 'get', path: '/api/admin/investors/summary' },
    { method: 'get', path: '/api/admin/investors' },
    { method: 'get', path: '/api/admin/investors/detail/1' },
    { method: 'get', path: '/api/admin/investors/allocation-requests' },
    { method: 'post', path: '/api/admin/investors/allocation-requests/1/approve' },
    { method: 'post', path: '/api/admin/investors/allocation-requests/1/reject', body: { reason: 'Bad' } },
    { method: 'post', path: '/api/admin/investors/allocation-requests/1/execute' },
    { method: 'post', path: '/api/admin/investors/1/notes', body: { note: 'Test note' } },
    { method: 'get', path: '/api/admin/investors/aum-trend' },
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
// GET /api/admin/investors/summary
// ═══════════════════════════════════════════════════════════

describe('GET /api/admin/investors/summary', () => {
  test('returns portfolio summary and investor metrics', async () => {
    const fakeSummary = { total_investors: 25, active_investors: 18, total_invested: 5000000, total_returns: 750000, avg_roi: 15.0, pending_requests: 5 };
    const fakeMetrics = { total_investors: 25, kyc_verified: 20, funded_investors: 18, avg_investment: 277777, total_aum: 5000000, growth: [], topInvestors: [] };

    mockInvestorDashboard.getPortfolioSummary.mockResolvedValue(fakeSummary);
    mockInvestorDashboard.getInvestorMetrics.mockResolvedValue(fakeMetrics);

    const res = await request(app)
      .get('/api/admin/investors/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual(fakeSummary);
    expect(res.body.metrics).toEqual(fakeMetrics);
  });

  test('returns 500 if service throws', async () => {
    mockInvestorDashboard.getPortfolioSummary.mockRejectedValue(new Error('DB error'));
    const res = await request(app)
      .get('/api/admin/investors/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('DB error');
  });
});

// ═══════════════════════════════════════════════════════════
// GET /api/admin/investors
// ═══════════════════════════════════════════════════════════

describe('GET /api/admin/investors', () => {
  const fakeInvestors = [
    { id: 1, name: 'Priya Sharma', mobile: '9876543210', total_invested: 500000, roi_pct: 12.5, kyc_status: 'verified' },
    { id: 2, name: 'Meera Patel', mobile: '9876543211', total_invested: 250000, roi_pct: 8.3, kyc_status: 'pending' },
  ];

  test('returns investors list without filters', async () => {
    mockInvestorDashboard.getInvestors.mockResolvedValue({ investors: fakeInvestors, total: 2 });

    const res = await request(app)
      .get('/api/admin/investors')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.investors).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(mockInvestorDashboard.getInvestors).toHaveBeenCalledWith(expect.any(Object), {
      search: undefined,
      kycStatus: undefined,
      sortBy: undefined,
      limit: 50,
      offset: 0,
    });
  });

  test('passes search, kyc_status, sort_by, limit, and offset to service', async () => {
    mockInvestorDashboard.getInvestors.mockResolvedValue({ investors: [], total: 0 });

    await request(app)
      .get('/api/admin/investors?search=priya&kyc_status=verified&sort_by=total_invested&limit=10&offset=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(mockInvestorDashboard.getInvestors).toHaveBeenCalledWith(expect.any(Object), {
      search: 'priya',
      kycStatus: 'verified',
      sortBy: 'total_invested',
      limit: 10,
      offset: 20,
    });
  });

  test('returns 500 on error', async () => {
    mockInvestorDashboard.getInvestors.mockRejectedValue(new Error('Query failed'));
    const res = await request(app)
      .get('/api/admin/investors')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════
// GET /api/admin/investors/:id
// ═══════════════════════════════════════════════════════════

describe('GET /api/admin/investors/:id', () => {
  test('returns investor detail with portfolio breakdown', async () => {
    const fakeDetail = {
      id: 1, name: 'Priya Sharma', total_invested: 500000, roi_pct: 12.5,
      breakdown: [{ risk_bucket: 'safe', total_amount: 300000 }],
      investments: [{ id: 1, amount: 300000, risk_bucket: 'safe' }],
      activity: [{ id: 1, action: 'allocation.approved', created_at: new Date().toISOString() }],
      allocationRequests: [],
      snapshots: [],
    };
    mockInvestorDashboard.getInvestorDetail.mockResolvedValue(fakeDetail);

    const res = await request(app)
      .get('/api/admin/investors/detail/1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.investor.id).toBe(1);
    expect(res.body.investor.breakdown).toHaveLength(1);
    expect(mockInvestorDashboard.getInvestorDetail).toHaveBeenCalledWith(expect.any(Object), 1);
  });

  test('returns 404 if investor not found', async () => {
    mockInvestorDashboard.getInvestorDetail.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/admin/investors/detail/999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Investor not found');
  });

  test('returns 500 on error', async () => {
    mockInvestorDashboard.getInvestorDetail.mockRejectedValue(new Error('DB error'));
    const res = await request(app)
      .get('/api/admin/investors/detail/1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════
// GET /api/admin/investors/allocation-requests
// ═══════════════════════════════════════════════════════════

describe('GET /api/admin/investors/allocation-requests', () => {
  test('returns allocation requests with optional filters', async () => {
    const fakeRequests = {
      requests: [
        { id: 1, investor_id: 1, type: 'deposit', amount: 100000, status: 'pending', investor_name: 'Priya' },
      ],
    };
    mockInvestorDashboard.getAllocationRequests.mockResolvedValue(fakeRequests);

    const res = await request(app)
      .get('/api/admin/investors/allocation-requests?status=pending&investor_id=1&type=deposit')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(1);
    expect(mockInvestorDashboard.getAllocationRequests).toHaveBeenCalledWith(expect.any(Object), {
      status: 'pending',
      investorId: 1,
      type: 'deposit',
    });
  });

  test('returns all requests when no filters provided', async () => {
    mockInvestorDashboard.getAllocationRequests.mockResolvedValue({ requests: [] });

    await request(app)
      .get('/api/admin/investors/allocation-requests')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(mockInvestorDashboard.getAllocationRequests).toHaveBeenCalledWith(expect.any(Object), {
      status: undefined,
      investorId: undefined,
      type: undefined,
    });
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/admin/investors/allocation-requests/:id/approve
// ═══════════════════════════════════════════════════════════

describe('POST /api/admin/investors/allocation-requests/:id/approve', () => {
  test('approves a pending request', async () => {
    const fakeResult = { id: 1, investor_id: 1, type: 'deposit', amount: 100000, status: 'approved' };
    mockInvestorDashboard.approveAllocationRequest.mockResolvedValue(fakeResult);

    const res = await request(app)
      .post('/api/admin/investors/allocation-requests/1/approve')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.request.status).toBe('approved');
    expect(mockInvestorDashboard.approveAllocationRequest).toHaveBeenCalledWith(expect.any(Object), 1, 1);
  });

  test('returns 404 if request not found', async () => {
    mockInvestorDashboard.approveAllocationRequest.mockRejectedValue(new Error('Allocation request not found'));
    const res = await request(app)
      .post('/api/admin/investors/allocation-requests/999/approve')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  test('returns 500 on error', async () => {
    mockInvestorDashboard.approveAllocationRequest.mockRejectedValue(new Error('Unexpected'));
    const res = await request(app)
      .post('/api/admin/investors/allocation-requests/1/approve')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/admin/investors/allocation-requests/:id/reject
// ═══════════════════════════════════════════════════════════

describe('POST /api/admin/investors/allocation-requests/:id/reject', () => {
  test('rejects a request with reason', async () => {
    const fakeResult = { id: 1, status: 'rejected', notes: 'Insufficient funds' };
    mockInvestorDashboard.rejectAllocationRequest.mockResolvedValue(fakeResult);

    const res = await request(app)
      .post('/api/admin/investors/allocation-requests/1/reject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Insufficient funds' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.request.status).toBe('rejected');
    expect(mockInvestorDashboard.rejectAllocationRequest).toHaveBeenCalledWith(expect.any(Object), 1, 1, 'Insufficient funds');
  });

  test('returns 404 if request not found', async () => {
    mockInvestorDashboard.rejectAllocationRequest.mockRejectedValue(new Error('Allocation request not found'));
    const res = await request(app)
      .post('/api/admin/investors/allocation-requests/999/reject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Bad' });
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/admin/investors/allocation-requests/:id/execute
// ═══════════════════════════════════════════════════════════

describe('POST /api/admin/investors/allocation-requests/:id/execute', () => {
  test('executes an approved request', async () => {
    const fakeResult = { id: 1, status: 'executed' };
    mockInvestorDashboard.executeAllocationRequest.mockResolvedValue(fakeResult);

    const res = await request(app)
      .post('/api/admin/investors/allocation-requests/1/execute')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.request.status).toBe('executed');
    expect(mockInvestorDashboard.executeAllocationRequest).toHaveBeenCalledWith(expect.any(Object), 1, 1);
  });

  test('returns 404 if request not found', async () => {
    mockInvestorDashboard.executeAllocationRequest.mockRejectedValue(new Error('Allocation request not found'));
    const res = await request(app)
      .post('/api/admin/investors/allocation-requests/999/execute')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  test('returns 500 if request is not yet approved', async () => {
    mockInvestorDashboard.executeAllocationRequest.mockRejectedValue(new Error('Only approved requests can be executed'));
    const res = await request(app)
      .post('/api/admin/investors/allocation-requests/1/execute')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/admin/investors/:id/notes
// ═══════════════════════════════════════════════════════════

describe('POST /api/admin/investors/:id/notes', () => {
  test('adds a note to investor profile', async () => {
    mockInvestorDashboard.addInvestorNote.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/admin/investors/1/notes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Investor called about ROI concerns.' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Note added');
    expect(mockInvestorDashboard.addInvestorNote).toHaveBeenCalledWith(expect.any(Object), 1, 'Investor called about ROI concerns.', 1);
  });

  test('returns 400 if note text is missing', async () => {
    const res = await request(app)
      .post('/api/admin/investors/1/notes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Note text is required');
    expect(mockInvestorDashboard.addInvestorNote).not.toHaveBeenCalled();
  });

  test('returns 500 on error', async () => {
    mockInvestorDashboard.addInvestorNote.mockRejectedValue(new Error('DB write failed'));
    const res = await request(app)
      .post('/api/admin/investors/1/notes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Test' });
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════
// GET /api/admin/investors/aum-trend
// ═══════════════════════════════════════════════════════════

describe('GET /api/admin/investors/aum-trend', () => {
  test('returns AUM trend data with custom days', async () => {
    const fakeTrend = [
      { snapshot_date: '2025-01-01', aum: 4000000, total_invested: 4000000, total_returns: 600000 },
      { snapshot_date: '2025-02-01', aum: 4500000, total_invested: 4500000, total_returns: 700000 },
    ];
    mockInvestorDashboard.getAumTrend.mockResolvedValue(fakeTrend);

    const res = await request(app)
      .get('/api/admin/investors/aum-trend?days=60')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.trend).toHaveLength(2);
    expect(mockInvestorDashboard.getAumTrend).toHaveBeenCalledWith(expect.any(Object), 60);
  });

  test('defaults to 30 days when not provided', async () => {
    mockInvestorDashboard.getAumTrend.mockResolvedValue([]);

    await request(app)
      .get('/api/admin/investors/aum-trend')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(mockInvestorDashboard.getAumTrend).toHaveBeenCalledWith(expect.any(Object), 30);
  });
});
