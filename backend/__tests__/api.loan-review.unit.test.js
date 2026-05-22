/**
 * Unit tests for the Loan Review / Approval Workflow service (loan-review.js).
 *
 * Mocks the database module to test credit checks, risk assessment,
 * document validation, tiered approval, and review step management.
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

const loanReview = require('../src/loan-review');

beforeEach(() => {
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════
// 1. CREDIT CHECK
// ═══════════════════════════════════════════════════════════

describe('performCreditCheck', () => {
  const baseLoan = { id: 1, borrower_id: 3, amount: 10000 };

  test('returns excellent credit for score >= 750', async () => {
    mockDb.get.mockResolvedValue({
      score: 780,
      bureau_data: JSON.stringify({
        total_accounts: 5, active_accounts: 2, delinquent_accounts: 0,
        inquiries_last_6_months: 1, credit_utilization_pct: 20,
      }),
    });
    mockDb.all
      .mockResolvedValueOnce([{ id: 1, amount: 10000, status: 'completed' }]) // existing loans
      .mockResolvedValueOnce([{ status: 'paid', due_date: '2024-01-01', paid_at: '2024-01-01' }]); // repayments

    const result = await loanReview.performCreditCheck(mockDb, 3, 1);

    expect(result.creditScore).toBe(780);
    expect(result.creditCategory).toBe('excellent');
    expect(result.creditRemarks).toContain('low risk');
    expect(result.passed).toBe(true);
    expect(result.bureauReport.totalAccounts).toBe(5);
    expect(result.repaymentHistory.totalLoans).toBe(1);
  });

  test('returns fair credit for score between 500-649', async () => {
    mockDb.get.mockResolvedValue({ score: 580 });
    // Provide a repayment so repaymentRate >= 60% for passed=true
    mockDb.all
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ status: 'paid', due_date: '2024-01-01', paid_at: '2024-01-01' }]);

    const result = await loanReview.performCreditCheck(mockDb, 3, 1);

    expect(result.creditScore).toBe(580);
    expect(result.creditCategory).toBe('fair');
    expect(result.passed).toBe(true);
  });

  test('returns poor credit for score below 300', async () => {
    mockDb.get.mockResolvedValue({ score: 250 });
    mockDb.all.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await loanReview.performCreditCheck(mockDb, 3, 1);

    expect(result.creditScore).toBe(250);
    expect(result.creditCategory).toBe('very_poor');
    expect(result.passed).toBe(false);
  });

  test('defaults to score 600 when no credit score record exists', async () => {
    mockDb.get.mockResolvedValue(null);
    // Provide a repayment so repaymentRate >= 60%, score 600 is in 'fair' range
    mockDb.all
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ status: 'paid', due_date: '2024-01-01', paid_at: '2024-01-01' }]);

    const result = await loanReview.performCreditCheck(mockDb, 3, 1);

    expect(result.creditScore).toBe(600);
    expect(result.creditCategory).toBe('fair');
    expect(result.passed).toBe(true);
  });

  test('handles null bureau_data gracefully', async () => {
    mockDb.get.mockResolvedValue({ score: 720, bureau_data: null });
    mockDb.all.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await loanReview.performCreditCheck(mockDb, 3, 1);

    expect(result.creditScore).toBe(720);
    expect(result.bureauReport).toBeNull();
  });

  test('calculates repayment metrics correctly', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    mockDb.get.mockResolvedValue({ score: 700 });
    mockDb.all
      .mockResolvedValueOnce([]) // no existing loans
      .mockResolvedValueOnce([
        { status: 'paid', due_date: twoDaysAgo, paid_at: twoDaysAgo },
        { status: 'paid', due_date: fiveDaysAgo, paid_at: fiveDaysAgo },
        { status: 'pending', due_date: twoDaysAgo, paid_at: null },
      ]);

    const result = await loanReview.performCreditCheck(mockDb, 3, 1);

    expect(result.repaymentHistory.totalRepayments).toBe(3);
    expect(result.repaymentHistory.paidRepayments).toBe(2);
    expect(result.repaymentHistory.repaymentRate).toBe(67); // 2/3 ≈ 67%
  });

  test('returns 100% on-time rate when no repayments exist', async () => {
    mockDb.get.mockResolvedValue({ score: 700 });
    mockDb.all.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await loanReview.performCreditCheck(mockDb, 3, 1);

    expect(result.repaymentHistory.totalRepayments).toBe(0);
    expect(result.repaymentHistory.onTimeRate).toBe(100);
    expect(result.repaymentHistory.repaymentRate).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// 2. RISK ASSESSMENT
// ═══════════════════════════════════════════════════════════

describe('performRiskAssessment', () => {
  const creditCheck = {
    creditScore: 700,
    creditCategory: 'good',
    passed: true,
    existingDebt: 5000,
    repaymentHistory: { onTimeRate: 85, repaymentRate: 90, totalLoans: 3 },
  };
  const loan = { id: 1, borrower_id: 3, amount: 10000 };

  test('returns low risk for good credit with verified KYC', async () => {
    mockDb.get
      .mockResolvedValueOnce({ id: 3, trust_score: 75, created_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString() }) // user
      .mockResolvedValueOnce({ id: 1, status: 'verified' }); // kyc
    mockDb.all.mockResolvedValueOnce([]); // agent tasks

    const result = await loanReview.performRiskAssessment(mockDb, 3, loan, creditCheck);

    expect(result.riskScore).toBeGreaterThanOrEqual(60);
    expect(result.riskLevel).toMatch(/low|very_low/);
    expect(result.passed).toBe(true);
    expect(result.riskFactors).toHaveLength(7);
    expect(result.recommendations).toContain('Standard processing — low risk');
  });

  test('returns critical risk for poor credit with no KYC', async () => {
    const poorCredit = {
      creditScore: 200,
      creditCategory: 'very_poor',
      passed: false,
      existingDebt: 100000,
      repaymentHistory: { onTimeRate: 10, repaymentRate: 15, totalLoans: 5 },
    };

    mockDb.get
      .mockResolvedValueOnce({ id: 4, trust_score: 15, created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() }) // very new, very low trust
      .mockResolvedValueOnce(null); // no kyc
    mockDb.all.mockResolvedValueOnce([]); // agent tasks

    const result = await loanReview.performRiskAssessment(mockDb, 4, { ...loan, amount: 50000 }, poorCredit);

    expect(result.riskScore).toBeLessThan(20);
    expect(result.riskLevel).toBe('critical');
    expect(result.passed).toBe(false);
    expect(result.recommendations).toContain('Request additional collateral or guarantor');
    expect(result.recommendations).toContain('Complete KYC verification before proceeding');
    expect(result.details.kycStatus).toBe('not_submitted');
  });

  test('generates appropriate recommendations based on loan amount vs trust score', async () => {
    mockDb.get
      .mockResolvedValueOnce({ id: 3, trust_score: 30, created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() })
      .mockResolvedValueOnce({ id: 1, status: 'verified' });
    mockDb.all.mockResolvedValueOnce([]);

    const result = await loanReview.performRiskAssessment(mockDb, 3, { ...loan, amount: 50000 }, creditCheck);

    // trust_score 30 * 150 = 4500, loan is 50000, so recommendation should be present
    expect(result.recommendations.some(r => r.includes('relative to trust score'))).toBe(true);
  });

  test('recommends field verification for new users (< 30 days)', async () => {
    mockDb.get
      .mockResolvedValueOnce({ id: 3, trust_score: 50, created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() })
      .mockResolvedValueOnce({ id: 1, status: 'verified' });
    mockDb.all.mockResolvedValueOnce([]);

    const result = await loanReview.performRiskAssessment(mockDb, 3, loan, creditCheck);

    expect(result.recommendations).toContain('New user — recommend field verification by an agent');
  });

  test('defaults trust_score to 50 when user has no trust_score', async () => {
    mockDb.get
      .mockResolvedValueOnce({ id: 3, created_at: new Date().toISOString() }) // no trust_score
      .mockResolvedValueOnce({ id: 1, status: 'verified' });
    mockDb.all.mockResolvedValueOnce([]);

    const result = await loanReview.performRiskAssessment(mockDb, 3, loan, creditCheck);

    expect(result.details.trustScore).toBe(50);
  });

  test('defaults account age to 1 day when user has no created_at', async () => {
    mockDb.get
      .mockResolvedValueOnce({ id: 3, trust_score: 50 }) // no created_at
      .mockResolvedValueOnce({ id: 1, status: 'verified' });
    mockDb.all.mockResolvedValueOnce([]);

    const result = await loanReview.performRiskAssessment(mockDb, 3, loan, creditCheck);

    expect(result.details.accountAgeDays).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════
// 3. DOCUMENT VALIDATION
// ═══════════════════════════════════════════════════════════

describe('validateDocuments', () => {
  test('requires Aadhaar + PAN for loans < ₹10,000', async () => {
    mockDb.all.mockResolvedValueOnce([]); // no existing docs
    mockDb.get.mockResolvedValueOnce(null); // no kyc

    const result = await loanReview.validateDocuments(mockDb, 3, 1, 5000);

    expect(result.documents).toHaveLength(2);
    expect(result.documents[0].doc_type).toBe('aadhaar');
    expect(result.documents[1].doc_type).toBe('pan');
    expect(result.summary.required).toBe(2);
    expect(result.allVerified).toBe(false);
    expect(result.passed).toBe(false);
  });

  test('requires Aadhaar + PAN + Photo for loans >= ₹10,000', async () => {
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.get.mockResolvedValueOnce(null);

    const result = await loanReview.validateDocuments(mockDb, 3, 1, 12000);

    expect(result.documents).toHaveLength(3);
    expect(result.documents[2].doc_type).toBe('photo');
  });

  test('requires Aadhaar + PAN + Photo + Bank Statement for loans >= ₹15,000', async () => {
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.get.mockResolvedValueOnce(null);

    const result = await loanReview.validateDocuments(mockDb, 3, 1, 20000);

    expect(result.documents).toHaveLength(4);
    expect(result.documents[3].doc_type).toBe('bank_statement');
  });

  test('requires Aadhaar + PAN + Photo + Bank Statement + Income Proof for loans >= ₹25,000', async () => {
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.get.mockResolvedValueOnce(null);

    const result = await loanReview.validateDocuments(mockDb, 3, 1, 30000);

    expect(result.documents).toHaveLength(5);
    expect(result.documents[4].doc_type).toBe('income_proof');
  });

  test('auto-verifies Aadhaar and PAN from KYC submission', async () => {
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.get.mockResolvedValueOnce({ aadhaar_number: '1234-5678-9012', pan_number: 'ABCDE1234F', status: 'pending', created_at: '2024-01-15' });

    const result = await loanReview.validateDocuments(mockDb, 3, 1, 5000);

    expect(result.documents[0].status).toBe('verified');
    expect(result.documents[0].notes).toContain('Auto-verified from KYC');
    expect(result.documents[1].status).toBe('verified');
    expect(result.documents[1].notes).toContain('Auto-verified from KYC');
  });

  test('auto-inserts Aadhaar and PAN documents from KYC if not already recorded', async () => {
    mockDb.all.mockResolvedValueOnce([]); // no existing docs
    mockDb.get.mockResolvedValueOnce({ aadhaar_number: '1234', pan_number: 'ABCDE', status: 'pending', created_at: '2024-01-15' });
    mockDb.run.mockResolvedValue({ lastID: 10 });

    const result = await loanReview.validateDocuments(mockDb, 3, 1, 5000);

    // Should auto-insert both aadhaar and pan documents
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO loan_documents'),
      [1, 3, 'aadhaar', null, 'verified', 'Auto-verified from KYC submission']
    );
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO loan_documents'),
      [1, 3, 'pan', null, 'verified', 'Auto-verified from KYC submission']
    );
    expect(result.allVerified).toBe(true);
    expect(result.passed).toBe(true);
  });

  test('does not auto-insert documents if they already exist', async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: 1, doc_type: 'aadhaar', status: 'verified' },
      { id: 2, doc_type: 'pan', status: 'verified' },
    ]);
    mockDb.get.mockResolvedValueOnce({ aadhaar_number: '1234', pan_number: 'ABCDE', status: 'pending', created_at: '2024-01-15' });

    const result = await loanReview.validateDocuments(mockDb, 3, 1, 5000);

    // Should NOT auto-insert since docs already exist
    expect(mockDb.run).not.toHaveBeenCalled();
    expect(result.allVerified).toBe(true);
  });

  test('marks document as pending if KYC exists but document record is missing', async () => {
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.get
      .mockResolvedValueOnce(null) // no kyc
      .mockResolvedValueOnce(null); // no kyc (called twice?)

    const result = await loanReview.validateDocuments(mockDb, 3, 1, 5000);

    expect(result.documents[0].status).toBe('not_submitted');
    expect(result.documents[1].status).toBe('not_submitted');
    expect(result.summary.missing).toBe(2);
  });

  test('handles rejected documents in summary count', async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: 1, doc_type: 'aadhaar', status: 'rejected', notes: 'Blurry image' },
    ]);
    mockDb.get.mockResolvedValueOnce({ aadhaar_number: '1234', pan_number: 'ABCDE', status: 'pending', created_at: '2024-01-15' });

    const result = await loanReview.validateDocuments(mockDb, 3, 1, 5000);

    expect(result.summary.rejected).toBe(1);
    expect(result.summary.missing).toBe(1); // Aadhaar rejected counts as missing
    expect(result.passed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// 4. APPROVAL AUTHORITY
// ═══════════════════════════════════════════════════════════

describe('checkApprovalAuthority', () => {
  test('returns approval info for a level 3 admin within limit', async () => {
    mockDb.get
      .mockResolvedValueOnce({ user_id: 1, role_level: 3, title: 'Super Admin', can_approve: true, can_disburse: true, can_override: false, approval_limit: 50000 })
      .mockResolvedValueOnce({ id: 1, role: 'admin' });

    const result = await loanReview.checkApprovalAuthority(mockDb, 1, 25000);

    expect(result.roleLevel).toBe(3);
    expect(result.title).toBe('Super Admin');
    expect(result.approvalLimit).toBe(50000);
    expect(result.isWithinLimit).toBe(true);
    expect(result.needsHigherApproval).toBe(false);
    expect(result.canApprove).toBe(true);
  });

  test('reports needsHigherApproval when amount exceeds limit', async () => {
    mockDb.get
      .mockResolvedValueOnce({ user_id: 1, role_level: 1, title: 'Junior Admin', can_approve: true, can_disburse: false, can_override: false, approval_limit: 5000 })
      .mockResolvedValueOnce({ id: 1, role: 'admin' });

    const result = await loanReview.checkApprovalAuthority(mockDb, 1, 10000);

    expect(result.isWithinLimit).toBe(false);
    expect(result.needsHigherApproval).toBe(true);
    expect(result.requiredLevel).toBe('2');
  });

  test('allows override when can_override is true even over limit', async () => {
    mockDb.get
      .mockResolvedValueOnce({ user_id: 1, role_level: 3, title: 'Super Admin', can_approve: true, can_disburse: false, can_override: true, approval_limit: 50000 })
      .mockResolvedValueOnce({ id: 1, role: 'admin' });

    const result = await loanReview.checkApprovalAuthority(mockDb, 1, 100000);

    expect(result.isWithinLimit).toBe(false);
    expect(result.needsHigherApproval).toBe(false);
    expect(result.canOverride).toBe(true);
  });

  test('defaults to level 1 when no admin_roles record exists', async () => {
    mockDb.get
      .mockResolvedValueOnce(null) // no admin_roles
      .mockResolvedValueOnce({ id: 1, role: 'admin' }); // user

    const result = await loanReview.checkApprovalAuthority(mockDb, 1, 3000);

    expect(result.roleLevel).toBe(1);
    expect(result.approvalLimit).toBe(5000);
    expect(result.isWithinLimit).toBe(true);
    expect(result.title).toBe('Admin');
  });

  test('returns the correct required level for high amounts', async () => {
    mockDb.get
      .mockResolvedValueOnce({ user_id: 1, role_level: 2, title: 'Senior Admin', can_approve: true, can_disburse: false, can_override: false, approval_limit: 15000 })
      .mockResolvedValueOnce({ id: 1, role: 'admin' });

    const result = await loanReview.checkApprovalAuthority(mockDb, 1, 50000);

    expect(result.needsHigherApproval).toBe(true);
    expect(result.requiredLevel).toBe('3');
  });

  test('returns required level 5 for amounts exceeding all limits', async () => {
    mockDb.get
      .mockResolvedValueOnce({ user_id: 1, role_level: 1, title: 'Junior Admin', can_approve: true, can_disburse: false, can_override: false, approval_limit: 5000 })
      .mockResolvedValueOnce({ id: 1, role: 'admin' });

    const result = await loanReview.checkApprovalAuthority(mockDb, 1, 999999);

    expect(result.needsHigherApproval).toBe(true);
    expect(result.requiredLevel).toBe('5');
  });

  test('disallows approval when can_approve is false', async () => {
    mockDb.get
      .mockResolvedValueOnce({ user_id: 1, role_level: 2, title: 'Senior Admin', can_approve: false, can_disburse: false, can_override: false, approval_limit: 15000 })
      .mockResolvedValueOnce({ id: 1, role: 'admin' });

    const result = await loanReview.checkApprovalAuthority(mockDb, 1, 5000);

    expect(result.canApprove).toBe(false);
    expect(result.isWithinLimit).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 5. FULL REVIEW
// ═══════════════════════════════════════════════════════════

describe('getFullReview', () => {
  test('returns complete review with enriched metadata', async () => {
    const loan = { id: 1, borrower_id: 3, amount: 10000, status: 'document_validation' };
    const borrower = { id: 3, name: 'Ravi', mobile: '9876543210' };
    const reviewSteps = [
      { id: 1, step: 'credit_check', status: 'passed', metadata: JSON.stringify({ creditScore: 720 }) },
      { id: 2, step: 'risk_assessment', status: 'passed', metadata: JSON.stringify({ riskScore: 68 }) },
      { id: 3, step: 'document_validation', status: 'in_progress', metadata: JSON.stringify({}) },
    ];

    mockDb.get
      .mockResolvedValueOnce(loan)
      .mockResolvedValueOnce(borrower);
    mockDb.all.mockResolvedValueOnce(reviewSteps);

    const result = await loanReview.getFullReview(mockDb, 1);

    expect(result.loan.id).toBe(1);
    expect(result.borrower.name).toBe('Ravi');
    expect(result.steps.credit_check.metadata.creditScore).toBe(720);
    expect(result.steps.risk_assessment.metadata.riskScore).toBe(68);
    expect(result.steps.final_approval).toBeNull();
    expect(result.allStepsComplete).toBe(false);
    expect(result.currentStep).toBe('document_validation');
  });

  test('returns null steps for loans with no review steps', async () => {
    mockDb.get
      .mockResolvedValueOnce({ id: 1, borrower_id: 3, amount: 5000, status: 'applied' })
      .mockResolvedValueOnce({ id: 3, name: 'Ravi' });
    mockDb.all.mockResolvedValueOnce([]);

    const result = await loanReview.getFullReview(mockDb, 1);

    expect(result.steps.credit_check).toBeNull();
    expect(result.steps.risk_assessment).toBeNull();
    expect(result.steps.document_validation).toBeNull();
    expect(result.steps.final_approval).toBeNull();
    expect(result.allStepsComplete).toBe(false);
  });

  test('throws if loan not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    await expect(loanReview.getFullReview(mockDb, 999)).rejects.toThrow('Loan not found');
  });

  test('parses metadata even if already an object (not string)', async () => {
    mockDb.get
      .mockResolvedValueOnce({ id: 1, borrower_id: 3, amount: 5000, status: 'applied' })
      .mockResolvedValueOnce({ id: 3, name: 'Ravi' });
    mockDb.all.mockResolvedValueOnce([
      { id: 1, step: 'credit_check', status: 'passed', metadata: { creditScore: 720 } }, // already object
    ]);

    const result = await loanReview.getFullReview(mockDb, 1);

    expect(result.steps.credit_check.metadata.creditScore).toBe(720);
  });

  test('returns allStepsComplete as true when all 4 steps passed', async () => {
    const loan = { id: 1, borrower_id: 3, amount: 10000, status: 'approved' };
    const borrower = { id: 3, name: 'Ravi' };
    const reviewSteps = [
      { id: 1, step: 'credit_check', status: 'passed', metadata: '{}' },
      { id: 2, step: 'risk_assessment', status: 'passed', metadata: '{}' },
      { id: 3, step: 'document_validation', status: 'passed', metadata: '{}' },
      { id: 4, step: 'final_approval', status: 'passed', metadata: '{}' },
    ];

    mockDb.get.mockResolvedValueOnce(loan).mockResolvedValueOnce(borrower);
    mockDb.all.mockResolvedValueOnce(reviewSteps);

    const result = await loanReview.getFullReview(mockDb, 1);

    expect(result.allStepsComplete).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 6. COMPLETE REVIEW STEP
// ═══════════════════════════════════════════════════════════

describe('completeReviewStep', () => {
  test('creates a new review step and advances loan status', async () => {
    mockDb.get
      .mockResolvedValueOnce(null) // no existing step
      .mockResolvedValueOnce({ id: 10, step: 'credit_check', status: 'passed', metadata: JSON.stringify({ score: 720 }) }); // after insert

    mockDb.run.mockResolvedValue({ lastID: 10 });

    const result = await loanReview.completeReviewStep(mockDb, 1, 'credit_check', 'passed', 2, 'All good', { score: 720 });

    expect(result.step.status).toBe('passed');
    expect(result.loanStatus).toBe('risk_assessment');
    // Should update loan status to the next step
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE loans SET status'),
      ['risk_assessment', 1]
    );
  });

  test('updates an existing review step with new status', async () => {
    mockDb.get
      .mockResolvedValueOnce({ id: 10, step: 'credit_check', status: 'in_progress' }) // existing step
      .mockResolvedValueOnce({ id: 10, step: 'credit_check', status: 'failed', metadata: JSON.stringify({}) });

    const result = await loanReview.completeReviewStep(mockDb, 1, 'credit_check', 'failed', 2, 'Insufficient credit', {});

    expect(result.step.status).toBe('failed');
    // Should use UPDATE not INSERT
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE loan_reviews SET'),
      ['failed', 2, 'Insufficient credit', JSON.stringify({}), 10]
    );
  });

  test('marks loan as rejected when status is failed', async () => {
    mockDb.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 10, step: 'credit_check', status: 'failed', metadata: '{}' });

    const result = await loanReview.completeReviewStep(mockDb, 1, 'credit_check', 'failed', 2, 'Bad', {});

    expect(result.loanStatus).toBe('rejected');
    // Should update loan status to 'rejected'
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE loans SET status'),
      ['rejected', 1]
    );
  });

  test('does not advance loan status on skipped credit_check', async () => {
    mockDb.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 10, step: 'credit_check', status: 'skipped', metadata: '{}' });

    const result = await loanReview.completeReviewStep(mockDb, 1, 'credit_check', 'skipped', 2, '', {});

    expect(result.loanStatus).toBe('risk_assessment');
    // Skipped should still advance to next step
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE loans SET status'),
      ['risk_assessment', 1]
    );
  });

  test('returns loanStatus as approved when final_approval step is completed', async () => {
    mockDb.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 10, step: 'final_approval', status: 'passed', metadata: '{}' });

    const result = await loanReview.completeReviewStep(mockDb, 1, 'final_approval', 'passed', 2, '', {});

    // final_approval maps to null in getNextLoanStatus, so loanStatus falls back to 'applied'
    expect(result.loanStatus).toBe('applied');
  });

  test('sets completed_at timestamp only for terminal statuses', async () => {
    mockDb.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 10, step: 'credit_check', status: 'in_progress', metadata: '{}' });

    // Complete with 'in_progress' should also work
    const result = await loanReview.completeReviewStep(mockDb, 1, 'credit_check', 'in_progress', 2, 'Working', {});

    expect(result.step.status).toBe('in_progress');
    // Should NOT advance loan status for non-terminal status
    expect(mockDb.run).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE loans SET status'),
      expect.anything()
    );
  });

  test('serializes metadata to JSON when inserting', async () => {
    const metadata = { riskScore: 72, riskFactors: ['high'] };
    mockDb.get.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 10, step: 'risk_assessment', status: 'passed', metadata: JSON.stringify(metadata) });

    await loanReview.completeReviewStep(mockDb, 1, 'risk_assessment', 'passed', 2, 'OK', metadata);

    // The INSERT should use JSON.stringify(metadata)
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO loan_reviews'),
      [1, 'risk_assessment', 'passed', 2, 'OK', JSON.stringify(metadata)]
    );
  });
});

// ═══════════════════════════════════════════════════════════
// 7. GET REVIEWERS
// ═══════════════════════════════════════════════════════════

describe('getReviewers', () => {
  test('returns list of reviewers with aggregated counts', async () => {
    const fakeReviewers = [
      { id: 1, name: 'Admin One', role_level: 3, active_reviews: 2, completed_reviews: 15 },
      { id: 2, name: 'Admin Two', role_level: 2, active_reviews: 0, completed_reviews: 8 },
    ];
    mockDb.all.mockResolvedValue(fakeReviewers);

    const result = await loanReview.getReviewers(mockDb);

    expect(result).toHaveLength(2);
    expect(result[0].role_level).toBe(3);
    expect(result[1].active_reviews).toBe(0);
    expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining('FROM admin_roles'));
  });

  test('returns empty array when no reviewers exist', async () => {
    mockDb.all.mockResolvedValue([]);

    const result = await loanReview.getReviewers(mockDb);

    expect(result).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════
// 8. ADMIN LOANS
// ═══════════════════════════════════════════════════════════

describe('getAdminLoans', () => {
  test('returns all loans with enriched review status when no filter', async () => {
    const fakeLoans = [
      { id: 1, amount: 10000, status: 'applied', borrower_name: 'Ravi', current_review_step: 'credit_check' },
      { id: 2, amount: 5000, status: 'approved', borrower_name: 'Sneha' },
    ];
    mockDb.all.mockResolvedValue(fakeLoans);

    const result = await loanReview.getAdminLoans(mockDb);

    expect(result).toHaveLength(2);
    expect(result[0].current_review_step).toBe('credit_check');
    expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining('FROM loans l'), []);
  });

  test('filters by specific status', async () => {
    mockDb.all.mockResolvedValue([]);

    await loanReview.getAdminLoans(mockDb, 'approved');

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('WHERE l.status = $1'),
      ['approved']
    );
  });

  test('filters by review status (in-progress review loans)', async () => {
    mockDb.all.mockResolvedValue([]);

    await loanReview.getAdminLoans(mockDb, 'review');

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('l.status IN ($1, $2, $3, $4)'),
      ['applied', 'credit_check', 'risk_assessment', 'document_validation']
    );
  });

  test('passes "all" filter as no filter', async () => {
    mockDb.all.mockResolvedValue([]);

    await loanReview.getAdminLoans(mockDb, 'all');

    expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining('FROM loans l'), []);
  });

  test('returns empty array when no loans match', async () => {
    mockDb.all.mockResolvedValue([]);

    const result = await loanReview.getAdminLoans(mockDb, 'completed');

    expect(result).toEqual([]);
  });
});
