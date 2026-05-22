/**
 * Unit tests for the Admin Investor Dashboard service (investor-dashboard.js).
 *
 * Mocks the database module to test portfolio analytics, allocation management,
 * and investor lifecycle functions directly.
 */

// ── Mock database module ──
const mockDb = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn(),
};

jest.mock('../src/database', () => jest.fn(() => Promise.resolve(mockDb)));

// Mock logger to silence output
jest.mock('../src/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const investorDashboard = require('../src/investor-dashboard');

beforeEach(() => {
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════
// PORTFOLIO ANALYTICS
// ═══════════════════════════════════════════════════════════

describe('getPortfolioSummary', () => {
  test('returns aggregated portfolio summary from admin view', async () => {
    const fakeSummary = {
      total_investors: 25,
      active_investors: 18,
      total_invested: 5000000,
      total_returns: 750000,
      avg_roi: 15.0,
      pending_requests: 5,
    };
    mockDb.get.mockResolvedValue(fakeSummary);

    const result = await investorDashboard.getPortfolioSummary(mockDb);

    expect(result).toEqual(fakeSummary);
    expect(mockDb.get).toHaveBeenCalledWith(expect.stringContaining('admin_investor_summary'));
  });

  test('returns zeros when no investors exist', async () => {
    mockDb.get.mockResolvedValue({
      total_investors: 0,
      active_investors: 0,
      total_invested: 0,
      total_returns: 0,
      avg_roi: 0,
      pending_requests: 0,
    });

    const result = await investorDashboard.getPortfolioSummary(mockDb);

    expect(result.total_investors).toBe(0);
    expect(result.avg_roi).toBe(0);
  });
});

describe('getInvestors', () => {
  const fakeInvestors = [
    { id: 1, name: 'Priya Sharma', mobile: '9876543210', total_invested: 500000, roi_pct: 12.5, kyc_status: 'verified' },
    { id: 2, name: 'Meera Patel', mobile: '9876543211', total_invested: 250000, roi_pct: 8.3, kyc_status: 'pending' },
  ];

  test('returns investors without filters', async () => {
    mockDb.get.mockResolvedValue({ total: 2 });
    mockDb.all.mockResolvedValue(fakeInvestors);

    const result = await investorDashboard.getInvestors(mockDb, {});

    expect(result.investors).toHaveLength(2);
    expect(result.total).toBe(2);
    // Default sort is total_invested DESC
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY total_invested DESC'),
      [50, 0]
    );
  });

  test('filters by search and kycStatus', async () => {
    mockDb.get.mockResolvedValue({ total: 1 });
    mockDb.all.mockResolvedValue([fakeInvestors[0]]);

    await investorDashboard.getInvestors(mockDb, {
      search: 'priya',
      kycStatus: 'verified',
    });

    // Should have ILIKE search and kyc_status filter
    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE'),
      ['%priya%', 'verified']
    );
  });

  test('validates sortBy against allowed list', async () => {
    mockDb.get.mockResolvedValue({ total: 0 });
    mockDb.all.mockResolvedValue([]);

    // Invalid sortBy should fall back to total_invested
    await investorDashboard.getInvestors(mockDb, { sortBy: 'invalid_column' });
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY total_invested DESC'),
      [50, 0]
    );

    // Valid sortBy should be used
    await investorDashboard.getInvestors(mockDb, { sortBy: 'roi_pct' });
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY roi_pct DESC'),
      [50, 0]
    );
  });

  test('passes limit and offset correctly', async () => {
    mockDb.get.mockResolvedValue({ total: 0 });
    mockDb.all.mockResolvedValue([]);

    await investorDashboard.getInvestors(mockDb, { limit: 10, offset: 20 });
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.any(String),
      [10, 20]
    );
  });
});

describe('getInvestorDetail', () => {
  const fakeInvestor = {
    id: 1, name: 'Priya Sharma', total_invested: 500000, roi_pct: 12.5, kyc_status: 'verified',
  };

  test('returns full detail with breakdown, investments, activity, and snapshots', async () => {
    mockDb.get.mockResolvedValueOnce(fakeInvestor);
    mockDb.all.mockResolvedValueOnce([{ risk_bucket: 'safe', total_amount: 300000 }]);
    mockDb.all.mockResolvedValueOnce([{ id: 1, amount: 300000, risk_bucket: 'safe' }]);
    mockDb.all.mockResolvedValueOnce([{ id: 1, action: 'allocation.approved' }]);
    mockDb.all.mockResolvedValueOnce([{ id: 1, investor_id: 1, type: 'deposit', amount: 100000, status: 'pending' }]);
    mockDb.all.mockResolvedValueOnce([{ snapshot_date: '2025-01-15', total_value: 500000 }]);

    const result = await investorDashboard.getInvestorDetail(mockDb, 1);

    expect(result.id).toBe(1);
    expect(result.breakdown).toHaveLength(1);
    expect(result.investments).toHaveLength(1);
    expect(result.activity).toHaveLength(1);
    expect(result.allocationRequests).toHaveLength(1);
    expect(result.snapshots).toHaveLength(1);
    // Should make 1 db.get + 5 db.all calls
    expect(mockDb.get).toHaveBeenCalledTimes(1);
    expect(mockDb.all).toHaveBeenCalledTimes(5);
  });

  test('returns null when investor not found', async () => {
    mockDb.get.mockResolvedValue(null);

    const result = await investorDashboard.getInvestorDetail(mockDb, 999);
    expect(result).toBeNull();
  });

  test('returns snapshots with last 30 days filter', async () => {
    mockDb.get.mockResolvedValueOnce(fakeInvestor);
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.all.mockResolvedValueOnce([]);

    await investorDashboard.getInvestorDetail(mockDb, 1);

    // Snapshots query should have INTERVAL '30 days'
    expect(mockDb.all.mock.calls[4][0]).toContain("INTERVAL '30 days'");
  });
});

// ═══════════════════════════════════════════════════════════
// FUND ALLOCATION MANAGEMENT
// ═══════════════════════════════════════════════════════════

describe('getAllocationRequests', () => {
  test('returns all requests without filters', async () => {
    mockDb.all.mockResolvedValue([
      { id: 1, investor_id: 1, type: 'deposit', amount: 100000, status: 'pending', investor_name: 'Priya' },
    ]);

    const result = await investorDashboard.getAllocationRequests(mockDb, {});

    expect(result.requests).toHaveLength(1);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('FROM fund_allocation_requests'),
      []
    );
  });

  test('filters by status, investorId, and type', async () => {
    mockDb.all.mockResolvedValue([]);

    await investorDashboard.getAllocationRequests(mockDb, {
      status: 'approved',
      investorId: 5,
      type: 'withdraw',
    });

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('WHERE far.status = $1 AND far.investor_id = $2 AND far.type = $3'),
      ['approved', 5, 'withdraw']
    );
  });
});

describe('approveAllocationRequest', () => {
  const pendingRequest = {
    id: 1, investor_id: 1, type: 'deposit', amount: 100000, status: 'pending',
  };

  test('approves a pending request and logs activity', async () => {
    mockDb.get.mockResolvedValue(pendingRequest);
    mockDb.run.mockResolvedValue(undefined);

    const result = await investorDashboard.approveAllocationRequest(mockDb, 1, 5);

    expect(result.status).toBe('approved');
    expect(result.reviewed_by).toBe(5);
    // Should log investor activity
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO investor_activity_log'),
      [1, 'allocation.approved', expect.any(String)]
    );
  });

  test('throws error if request not found', async () => {
    mockDb.get.mockResolvedValue(null);

    await expect(
      investorDashboard.approveAllocationRequest(mockDb, 999, 1)
    ).rejects.toThrow('not found');
  });

  test('throws error if request is not pending', async () => {
    mockDb.get.mockResolvedValue({ ...pendingRequest, status: 'rejected' });

    await expect(
      investorDashboard.approveAllocationRequest(mockDb, 1, 1)
    ).rejects.toThrow('Cannot approve');
  });
});

describe('rejectAllocationRequest', () => {
  const pendingRequest = {
    id: 1, investor_id: 1, type: 'deposit', amount: 100000, status: 'pending',
  };

  test('rejects a pending request with reason', async () => {
    mockDb.get.mockResolvedValue(pendingRequest);
    mockDb.run.mockResolvedValue(undefined);

    const result = await investorDashboard.rejectAllocationRequest(mockDb, 1, 5, 'Insufficient funds');

    expect(result.status).toBe('rejected');
    expect(result.notes).toBe('Insufficient funds');
    // Verify the UPDATE sets notes = $3
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('SET status = $1'),
      ['rejected', 5, 'Insufficient funds', 1]
    );
  });

  test('rejects without reason', async () => {
    mockDb.get.mockResolvedValue(pendingRequest);
    mockDb.run.mockResolvedValue(undefined);

    await investorDashboard.rejectAllocationRequest(mockDb, 1, 5);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.any(String),
      ['rejected', 5, null, 1]
    );
  });

  test('throws error if request not found', async () => {
    mockDb.get.mockResolvedValue(null);
    await expect(
      investorDashboard.rejectAllocationRequest(mockDb, 999, 1, 'Bad')
    ).rejects.toThrow('not found');
  });

  test('throws error if already approved', async () => {
    mockDb.get.mockResolvedValue({ ...pendingRequest, status: 'approved' });
    await expect(
      investorDashboard.rejectAllocationRequest(mockDb, 1, 1, 'Bad')
    ).rejects.toThrow('Cannot reject');
  });
});

describe('executeAllocationRequest', () => {
  const approvedRequest = {
    id: 1, investor_id: 1, type: 'deposit', amount: 100000, status: 'approved',
  };

  test('executes an approved request', async () => {
    mockDb.get.mockResolvedValue(approvedRequest);
    mockDb.run.mockResolvedValue(undefined);

    const result = await investorDashboard.executeAllocationRequest(mockDb, 1, 5);

    expect(result.status).toBe('executed');
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE fund_allocation_requests'),
      ['executed', 1]
    );
  });

  test('throws error if request not found', async () => {
    mockDb.get.mockResolvedValue(null);
    await expect(
      investorDashboard.executeAllocationRequest(mockDb, 999, 1)
    ).rejects.toThrow('not found');
  });

  test('throws error if not yet approved', async () => {
    mockDb.get.mockResolvedValue({ ...approvedRequest, status: 'pending' });
    await expect(
      investorDashboard.executeAllocationRequest(mockDb, 1, 1)
    ).rejects.toThrow('Only approved');
  });
});

// ═══════════════════════════════════════════════════════════
// INVESTOR LIFECYCLE
// ═══════════════════════════════════════════════════════════

describe('logInvestorActivity', () => {
  test('logs activity with JSON stringified details', async () => {
    mockDb.run.mockResolvedValue(undefined);

    await investorDashboard.logInvestorActivity(mockDb, 1, 'allocation.approved', {
      requestId: 42,
      amount: 100000,
    });

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO investor_activity_log'),
      [1, 'allocation.approved', JSON.stringify({ requestId: 42, amount: 100000 })]
    );
  });

  test('catches and warns on DB failure without throwing', async () => {
    mockDb.run.mockRejectedValue(new Error('Connection lost'));

    // Should not throw
    await expect(
      investorDashboard.logInvestorActivity(mockDb, 1, 'test', {})
    ).resolves.toBeUndefined();
  });
});

describe('addInvestorNote', () => {
  test('logs activity with admin.note action', async () => {
    mockDb.run.mockResolvedValue(undefined);

    await investorDashboard.addInvestorNote(mockDb, 1, 'Called investor about ROI', 5);

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO investor_activity_log'),
      [1, 'admin.note', JSON.stringify({ note: 'Called investor about ROI', adminId: 5 })]
    );
  });
});

describe('getInvestorMetrics', () => {
  test('returns metrics with growth trend and top investors', async () => {
    const fakeMetrics = {
      total_investors: 25, kyc_verified: 20, funded_investors: 18,
      unfunded_investors: 7, investors_with_requests: 3,
      avg_investment: 277777, total_aum: 5000000, total_pending_requests: 5,
    };
    mockDb.get.mockResolvedValue(fakeMetrics);
    mockDb.all.mockResolvedValueOnce([{ month: '2025-01', new_investors: 3 }]);
    mockDb.all.mockResolvedValueOnce([{ id: 1, name: 'Priya', total_invested: 500000 }]);

    const result = await investorDashboard.getInvestorMetrics(mockDb);

    expect(result.total_investors).toBe(25);
    expect(result.kyc_verified).toBe(20);
    expect(result.growth).toHaveLength(1);
    expect(result.topInvestors).toHaveLength(1);
  });

  test('returns empty arrays when no growth or top investors', async () => {
    mockDb.get.mockResolvedValue({
      total_investors: 0, kyc_verified: 0, funded_investors: 0,
      unfunded_investors: 0, investors_with_requests: 0,
      avg_investment: 0, total_aum: 0, total_pending_requests: 0,
    });
    mockDb.all.mockResolvedValue([]);
    mockDb.all.mockResolvedValue([]);

    const result = await investorDashboard.getInvestorMetrics(mockDb);

    expect(result.growth).toEqual([]);
    expect(result.topInvestors).toEqual([]);
    expect(result.avg_investment).toBe(0);
  });
});

describe('getAumTrend', () => {
  test('returns AUM trend for default 30 days', async () => {
    mockDb.all.mockResolvedValue([
      { snapshot_date: '2025-01-01', aum: 4000000, total_invested: 4000000, total_returns: 600000 },
    ]);

    const result = await investorDashboard.getAumTrend(mockDb);

    expect(result).toHaveLength(1);
    expect(result[0].aum).toBe(4000000);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('$1::interval'),
      ['30 days']
    );
  });

  test('accepts custom days parameter', async () => {
    mockDb.all.mockResolvedValue([]);

    await investorDashboard.getAumTrend(mockDb, 90);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.any(String),
      ['90 days']
    );
  });
});

describe('recordDailySnapshots', () => {
  test('records snapshots for all active investors', async () => {
    const activeInvestors = [{ id: 1 }, { id: 2 }];
    mockDb.all.mockResolvedValueOnce(activeInvestors);
    mockDb.get.mockResolvedValueOnce({ total_invested: 500000, total_returns: 50000, active_count: 3, total_value: 550000 });
    mockDb.run.mockResolvedValueOnce(undefined);
    mockDb.get.mockResolvedValueOnce({ total_invested: 250000, total_returns: 25000, active_count: 2, total_value: 275000 });
    mockDb.run.mockResolvedValueOnce(undefined);

    const result = await investorDashboard.recordDailySnapshots(mockDb);

    expect(result.recorded).toBe(2);
    // 1 db.all + 2 db.get + 2 db.run = 5 calls
    expect(mockDb.all).toHaveBeenCalledTimes(1);
    expect(mockDb.get).toHaveBeenCalledTimes(2);
    expect(mockDb.run).toHaveBeenCalledTimes(2);
  });

  test('returns 0 when no active investors have investments', async () => {
    mockDb.all.mockResolvedValue([]);

    const result = await investorDashboard.recordDailySnapshots(mockDb);

    expect(result.recorded).toBe(0);
    expect(mockDb.get).not.toHaveBeenCalled();
  });

  test('uses ON CONFLICT for upsert', async () => {
    mockDb.all.mockResolvedValueOnce([{ id: 1 }]);
    mockDb.get.mockResolvedValueOnce({ total_invested: 100, total_returns: 10, active_count: 1, total_value: 110 });
    mockDb.run.mockResolvedValueOnce(undefined);

    await investorDashboard.recordDailySnapshots(mockDb);

    const runCall = mockDb.run.mock.calls[0];
    expect(runCall[0]).toContain('ON CONFLICT');
    expect(runCall[0]).toContain('DO UPDATE');
  });
});
