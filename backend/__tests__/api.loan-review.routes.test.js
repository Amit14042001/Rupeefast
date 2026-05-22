/**
 * Route tests for Admin Loan Review / Approval Workflow Endpoints.
 *
 * These tests mock the loan-review module entirely to focus on
 * route-level behaviour: auth, validation, error handling, and response shape.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// ── Mock loan-review module before requiring server ──
const mockLoanReview = {
  performCreditCheck: jest.fn(),
  performRiskAssessment: jest.fn(),
  validateDocuments: jest.fn(),
  checkApprovalAuthority: jest.fn(),
  getFullReview: jest.fn(),
  completeReviewStep: jest.fn(),
  getReviewers: jest.fn(),
  getAdminLoans: jest.fn(),
};

jest.mock('../src/loan-review', () => mockLoanReview);

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

describe('Loan Review — Auth guards', () => {
  const adminRoutes = [
    { method: 'get', path: '/api/admin/loans/1/review' },
    { method: 'post', path: '/api/admin/loans/1/review/credit-check' },
    { method: 'post', path: '/api/admin/loans/1/review/credit-check/complete', body: { status: 'passed', notes: 'Good' } },
    { method: 'post', path: '/api/admin/loans/1/review/risk-assessment' },
    { method: 'post', path: '/api/admin/loans/1/review/risk-assessment/complete', body: { status: 'passed', notes: 'OK' } },
    { method: 'get', path: '/api/admin/loans/1/review/documents' },
    { method: 'post', path: '/api/admin/loans/1/review/documents/verify', body: { doc_type: 'aadhaar', status: 'verified' } },
    { method: 'post', path: '/api/admin/loans/1/review/approve', body: { notes: 'Approved' } },
    { method: 'post', path: '/api/admin/loans/1/review/reject', body: { reason: 'Poor credit' } },
    { method: 'get', path: '/api/admin/loan-reviewers' },
    { method: 'get', path: '/api/admin/loans' },
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
// GET /api/admin/loans/:id/review
// ═══════════════════════════════════════════════════════════

describe('GET /api/admin/loans/:id/review', () => {
  test('returns full loan review data', async () => {
    const fakeReview = {
      loan: { id: 1, borrower_id: 3, amount: 10000, status: 'risk_assessment' },
      borrower: { id: 3, name: 'Ravi', mobile: '9876543210' },
      steps: {
        credit_check: { id: 1, step: 'credit_check', status: 'passed', metadata: { creditScore: 720 } },
        risk_assessment: null,
        document_validation: null,
        final_approval: null,
      },
      allStepsComplete: false,
      currentStep: 'risk_assessment',
    };
    mockLoanReview.getFullReview.mockResolvedValue(fakeReview);

    const res = await request(app)
      .get('/api/admin/loans/1/review')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.review.loan.id).toBe(1);
    expect(res.body.review.steps.credit_check.status).toBe('passed');
    expect(mockLoanReview.getFullReview).toHaveBeenCalledWith(expect.any(Object), 1);
  });

  test('returns 404 if loan not found', async () => {
    mockLoanReview.getFullReview.mockRejectedValue(new Error('Loan not found'));

    const res = await request(app)
      .get('/api/admin/loans/999/review')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Loan not found');
  });

  test('returns 500 on other errors', async () => {
    mockLoanReview.getFullReview.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .get('/api/admin/loans/1/review')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('DB error');
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/admin/loans/:id/review/credit-check
// ═══════════════════════════════════════════════════════════

describe('POST /api/admin/loans/:id/review/credit-check', () => {
  const fakeCreditCheck = {
    creditScore: 720,
    creditCategory: 'good',
    passed: true,
    repaymentHistory: { totalLoans: 3, activeLoans: 1, completedLoans: 2, onTimeRate: 85, repaymentRate: 90 },
  };

  test('performs credit check and updates loan status', async () => {
    mockDb.get
      .mockResolvedValueOnce({ id: 1, borrower_id: 3, amount: 10000, status: 'applied' }) // loan
      .mockResolvedValueOnce(null); // no existing review step
    mockLoanReview.performCreditCheck.mockResolvedValue(fakeCreditCheck);
    mockDb.run.mockResolvedValue({ lastID: 10 });

    const res = await request(app)
      .post('/api/admin/loans/1/review/credit-check')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.creditCheck.creditScore).toBe(720);
    expect(res.body.creditCheck.passed).toBe(true);
    // Updates loan status to 'credit_check'
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE loans SET status'),
      ['credit_check', 1]
    );
  });

  test('returns 404 if loan not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/admin/loans/999/review/credit-check')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Loan not found');
  });

  test('returns 500 on error', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 1, borrower_id: 3, amount: 10000 });
    mockLoanReview.performCreditCheck.mockRejectedValue(new Error('Bureau API down'));

    const res = await request(app)
      .post('/api/admin/loans/1/review/credit-check')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Bureau API down');
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/admin/loans/:id/review/credit-check/complete
// ═══════════════════════════════════════════════════════════

describe('POST /api/admin/loans/:id/review/credit-check/complete', () => {
  test('completes credit check step with passed status', async () => {
    mockLoanReview.completeReviewStep.mockResolvedValue({
      step: { id: 1, step: 'credit_check', status: 'passed' },
      loanStatus: 'risk_assessment',
    });

    const res = await request(app)
      .post('/api/admin/loans/1/review/credit-check/complete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'passed', notes: 'All good' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.step.status).toBe('passed');
    expect(res.body.loanStatus).toBe('risk_assessment');
    expect(mockLoanReview.completeReviewStep).toHaveBeenCalledWith(
      expect.any(Object), 1, 'credit_check', 'passed', 1, 'All good'
    );
  });

  test('returns 400 if status is not passed or failed', async () => {
    const res = await request(app)
      .post('/api/admin/loans/1/review/credit-check/complete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('status must be');
  });

  test('returns 500 on error', async () => {
    mockLoanReview.completeReviewStep.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/admin/loans/1/review/credit-check/complete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'passed' });

    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/admin/loans/:id/review/risk-assessment
// ═══════════════════════════════════════════════════════════

describe('POST /api/admin/loans/:id/review/risk-assessment', () => {
  const fakeRisk = {
    riskScore: 72,
    riskLevel: 'low',
    passed: true,
    riskFactors: [{ factor: 'Credit Score', risk: 30, weight: 0.3 }],
    recommendations: ['Standard processing'],
  };

  test('performs risk assessment using credit check data', async () => {
    mockDb.get
      .mockResolvedValueOnce({ id: 1, borrower_id: 3, amount: 10000, status: 'credit_check' }) // loan
      .mockResolvedValueOnce({ id: 10, step: 'credit_check', status: 'passed', metadata: JSON.stringify({ creditScore: 720 }) }) // existing credit check
      .mockResolvedValueOnce(null); // no existing risk assessment step
    mockLoanReview.performRiskAssessment.mockResolvedValue(fakeRisk);
    mockDb.run.mockResolvedValue({ lastID: 11 });

    const res = await request(app)
      .post('/api/admin/loans/1/review/risk-assessment')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.riskAssessment.riskLevel).toBe('low');
    expect(res.body.riskAssessment.passed).toBe(true);
    expect(mockLoanReview.performRiskAssessment).toHaveBeenCalledWith(
      expect.any(Object), 3, { id: 1, borrower_id: 3, amount: 10000, status: 'credit_check' },
      { creditScore: 720 }
    );
  });

  test('returns 404 if loan not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/admin/loans/999/review/risk-assessment')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Loan not found');
  });

  test('returns 500 on error', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 1, borrower_id: 3, amount: 10000 });
    mockLoanReview.performRiskAssessment.mockRejectedValue(new Error('Risk model error'));

    const res = await request(app)
      .post('/api/admin/loans/1/review/risk-assessment')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Risk model error');
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/admin/loans/:id/review/risk-assessment/complete
// ═══════════════════════════════════════════════════════════

describe('POST /api/admin/loans/:id/review/risk-assessment/complete', () => {
  test('completes risk assessment step', async () => {
    mockLoanReview.completeReviewStep.mockResolvedValue({
      step: { id: 2, step: 'risk_assessment', status: 'passed' },
      loanStatus: 'document_validation',
    });

    const res = await request(app)
      .post('/api/admin/loans/1/review/risk-assessment/complete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'passed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.step.status).toBe('passed');
    expect(res.body.loanStatus).toBe('document_validation');
  });

  test('returns 400 if status is not passed or failed', async () => {
    const res = await request(app)
      .post('/api/admin/loans/1/review/risk-assessment/complete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'maybe' });

    expect(res.status).toBe(400);
  });

  test('returns 500 on error', async () => {
    mockLoanReview.completeReviewStep.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/admin/loans/1/review/risk-assessment/complete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'passed' });

    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════
// GET /api/admin/loans/:id/review/documents
// ═══════════════════════════════════════════════════════════

describe('GET /api/admin/loans/:id/review/documents', () => {
  test('returns document validation status', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 1, borrower_id: 3, amount: 10000 });
    mockLoanReview.validateDocuments.mockResolvedValue({
      documents: [
        { doc_type: 'aadhaar', status: 'verified' },
        { doc_type: 'pan', status: 'verified' },
        { doc_type: 'photo', status: 'pending' },
      ],
      summary: { required: 3, verified: 2, pending: 1, missing: 0, rejected: 0 },
      passed: false,
      allVerified: false,
    });

    const res = await request(app)
      .get('/api/admin/loans/1/review/documents')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.documents).toHaveLength(3);
    expect(res.body.allVerified).toBe(false);
    expect(mockLoanReview.validateDocuments).toHaveBeenCalledWith(expect.any(Object), 3, 1, 10000);
  });

  test('returns 404 if loan not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/admin/loans/999/review/documents')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  test('returns 500 on error', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 1, borrower_id: 3, amount: 10000 });
    mockLoanReview.validateDocuments.mockRejectedValue(new Error('Doc check error'));

    const res = await request(app)
      .get('/api/admin/loans/1/review/documents')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/admin/loans/:id/review/documents/verify
// ═══════════════════════════════════════════════════════════

describe('POST /api/admin/loans/:id/review/documents/verify', () => {
  test('verifies a document and checks if all verified', async () => {
    mockDb.get
      .mockResolvedValueOnce(null) // no existing doc — will insert
      .mockResolvedValueOnce({ id: 1, borrower_id: 3 }); // loan for borrower_id
    mockDb.all.mockResolvedValue([
      { id: 1, doc_type: 'aadhaar', status: 'verified' },
      { id: 2, doc_type: 'pan', status: 'verified' },
    ]);

    const res = await request(app)
      .post('/api/admin/loans/1/review/documents/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ doc_type: 'pan', status: 'verified' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.allVerified).toBe(true);
  });

  test('returns 400 if doc_type or status is missing', async () => {
    const res = await request(app)
      .post('/api/admin/loans/1/review/documents/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ doc_type: 'aadhaar' }); // missing status

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('required');
  });

  test('returns 400 if status is not verified or rejected', async () => {
    const res = await request(app)
      .post('/api/admin/loans/1/review/documents/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ doc_type: 'aadhaar', status: 'pending' });

    expect(res.status).toBe(400);
  });

  test('returns 500 on error', async () => {
    mockLoanReview.completeReviewStep.mockRejectedValue(new Error('DB error'));
    // The route does a db.get first, then throws when calling completeReviewStep
    mockDb.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 1, borrower_id: 3 });
    mockDb.run.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/admin/loans/1/review/documents/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ doc_type: 'aadhaar', status: 'verified' });

    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/admin/loans/:id/review/approve
// ═══════════════════════════════════════════════════════════

describe('POST /api/admin/loans/:id/review/approve', () => {
  const loan = { id: 1, amount: 10000, borrower_id: 3 };
  const passedSteps = [
    { step: 'credit_check', status: 'passed' },
    { step: 'risk_assessment', status: 'passed' },
    { step: 'document_validation', status: 'passed' },
  ];
  const authority = { roleLevel: 2, title: 'Senior Admin', approvalLimit: 15000, canApprove: true, isWithinLimit: true, needsHigherApproval: false };

  test('approves loan when all steps passed and within authority', async () => {
    mockDb.get
      .mockResolvedValueOnce(loan)
      .mockResolvedValueOnce(null); // checkApprovalAuthority returns via mock
    mockDb.all.mockResolvedValueOnce(passedSteps);
    mockLoanReview.checkApprovalAuthority.mockResolvedValue(authority);
    mockLoanReview.completeReviewStep.mockResolvedValue({
      step: { id: 4, step: 'final_approval', status: 'passed' },
      loanStatus: 'approved',
    });

    const res = await request(app)
      .post('/api/admin/loans/1/review/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Approved after review' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.step.status).toBe('passed');
    expect(res.body.loanStatus).toBe('approved');
    expect(mockLoanReview.checkApprovalAuthority).toHaveBeenCalledWith(expect.any(Object), 1, 10000);
  });

  test('returns 404 if loan not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/admin/loans/999/review/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Approved' });

    expect(res.status).toBe(404);
  });

  test('returns 400 if prior review steps are missing', async () => {
    mockDb.get.mockResolvedValueOnce(loan);
    mockDb.all.mockResolvedValueOnce([]); // no steps

    const res = await request(app)
      .post('/api/admin/loans/1/review/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Approved' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('complete these steps first');
    expect(res.body.missingSteps).toContain('credit_check');
  });

  test('returns 403 if admin cannot approve', async () => {
    mockDb.get.mockResolvedValueOnce(loan);
    mockDb.all.mockResolvedValueOnce(passedSteps);
    mockLoanReview.checkApprovalAuthority.mockResolvedValue({ ...authority, canApprove: false });

    const res = await request(app)
      .post('/api/admin/loans/1/review/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Approved' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('approval permission');
  });

  test('returns 403 if loan amount exceeds approval limit', async () => {
    mockDb.get.mockResolvedValueOnce(loan);
    mockDb.all.mockResolvedValueOnce(passedSteps);
    mockLoanReview.checkApprovalAuthority.mockResolvedValue({ ...authority, isWithinLimit: false, needsHigherApproval: true, approvalLimit: 5000 });

    const res = await request(app)
      .post('/api/admin/loans/1/review/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Approved' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('exceeds your approval limit');
    expect(res.body.authority.needsHigherApproval).toBe(true);
  });

  test('returns 500 on error', async () => {
    mockDb.get.mockResolvedValueOnce(loan);
    mockDb.all.mockResolvedValueOnce(passedSteps);
    mockLoanReview.checkApprovalAuthority.mockResolvedValue(authority);
    mockLoanReview.completeReviewStep.mockRejectedValue(new Error('Unexpected error'));

    const res = await request(app)
      .post('/api/admin/loans/1/review/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Approved' });

    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/admin/loans/:id/review/reject
// ═══════════════════════════════════════════════════════════

describe('POST /api/admin/loans/:id/review/reject', () => {
  test('rejects a loan with reason', async () => {
    mockLoanReview.completeReviewStep.mockResolvedValue({
      step: { id: 1, step: 'credit_check', status: 'failed' },
      loanStatus: 'rejected',
    });

    const res = await request(app)
      .post('/api/admin/loans/1/review/reject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Poor credit history', step: 'credit_check' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('rejected');
    expect(res.body.loanStatus).toBe('rejected');
    expect(mockLoanReview.completeReviewStep).toHaveBeenCalledWith(
      expect.any(Object), 1, 'credit_check', 'failed', 1, 'Poor credit history'
    );
  });

  test('defaults to credit_check step when not specified', async () => {
    mockLoanReview.completeReviewStep.mockResolvedValue({
      step: { id: 1, status: 'failed' },
      loanStatus: 'rejected',
    });

    await request(app)
      .post('/api/admin/loans/1/review/reject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Not eligible' });

    expect(mockLoanReview.completeReviewStep).toHaveBeenCalledWith(
      expect.any(Object), 1, 'credit_check', 'failed', 1, 'Not eligible'
    );
  });

  test('returns 400 if reason is missing', async () => {
    const res = await request(app)
      .post('/api/admin/loans/1/review/reject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Rejection reason is required');
  });

  test('returns 500 on error', async () => {
    mockLoanReview.completeReviewStep.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/admin/loans/1/review/reject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Bad' });

    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════
// GET /api/admin/loan-reviewers
// ═══════════════════════════════════════════════════════════

describe('GET /api/admin/loan-reviewers', () => {
  test('returns list of reviewers', async () => {
    const fakeReviewers = [
      { id: 1, name: 'Admin 1', role_level: 3, active_reviews: 2, completed_reviews: 15 },
      { id: 2, name: 'Admin 2', role_level: 2, active_reviews: 0, completed_reviews: 8 },
    ];
    mockLoanReview.getReviewers.mockResolvedValue(fakeReviewers);

    const res = await request(app)
      .get('/api/admin/loan-reviewers')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.reviewers).toHaveLength(2);
    expect(mockLoanReview.getReviewers).toHaveBeenCalledWith(expect.any(Object));
  });

  test('returns 500 on error', async () => {
    mockLoanReview.getReviewers.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .get('/api/admin/loan-reviewers')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════
// GET /api/admin/loans
// ═══════════════════════════════════════════════════════════

describe('GET /api/admin/loans', () => {
  test('returns all loans without status filter', async () => {
    const fakeLoans = [
      { id: 1, amount: 10000, status: 'applied', borrower_name: 'Ravi', current_review_step: 'credit_check' },
      { id: 2, amount: 5000, status: 'approved', borrower_name: 'Sneha' },
    ];
    mockLoanReview.getAdminLoans.mockResolvedValue(fakeLoans);

    const res = await request(app)
      .get('/api/admin/loans')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.loans).toHaveLength(2);
    expect(mockLoanReview.getAdminLoans).toHaveBeenCalledWith(expect.any(Object), undefined);
  });

  test('filters loans by status', async () => {
    mockLoanReview.getAdminLoans.mockResolvedValue([]);

    await request(app)
      .get('/api/admin/loans?status=applied')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(mockLoanReview.getAdminLoans).toHaveBeenCalledWith(expect.any(Object), 'applied');
  });

  test('returns 500 on error', async () => {
    mockLoanReview.getAdminLoans.mockRejectedValue(new Error('Query failed'));

    const res = await request(app)
      .get('/api/admin/loans')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
  });
});
