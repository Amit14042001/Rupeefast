/**
 * RupeeFast — Admin Loan Review API Routes
 *
 * Full multi-step loan approval workflow:
 *   1. Credit Check
 *   2. Risk Assessment
 *   3. Document Validation
 *   4. Final Approval (tiered by admin seniority)
 *
 * All routes require admin role.
 */

const sentry = require('../../sentry');
const audit = require('../../audit');
const loanReview = require('../../loan-review');

/**
 * Register admin loan routes on the given Router.
 * @param {object} router - Express Router
 * @param {object} ctx - Context { db, authMiddleware }
 */
module.exports = function (router, ctx) {
  const { authMiddleware } = ctx;

  // ── Enforce admin role for all routes ──
  router.use(authMiddleware, (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });

  // ── Get full loan review data ──
  router.get('/loans/:id/review', async (req, res) => {
    try {
      const review = await loanReview.getFullReview(ctx.db, parseInt(req.params.id));
      res.json({ review });
    } catch (err) {
      if (err.message === 'Loan not found') return res.status(404).json({ error: 'Loan not found' });
      sentry.captureError(err, { route: 'admin/loans/review' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── Initiate credit check ──
  router.post('/loans/:id/review/credit-check', async (req, res) => {
    try {
      const loanId = parseInt(req.params.id);
      const loan = await ctx.db.get('SELECT * FROM loans WHERE id = $1', [loanId]);
      if (!loan) return res.status(404).json({ error: 'Loan not found' });

      const creditCheck = await loanReview.performCreditCheck(ctx.db, loan.borrower_id, loanId);
      const existing =      await ctx.db.get('SELECT * FROM loan_reviews WHERE loan_id = $1 AND step = $2', [loanId, 'credit_check']);
      if (!existing) {
        await ctx.db.run(
          `INSERT INTO loan_reviews (loan_id, step, status, reviewer_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [loanId, 'credit_check', 'in_progress', req.user.id, JSON.stringify(creditCheck)]
        );
      }
      await ctx.db.run('UPDATE loans SET status = $1 WHERE id = $2', ['credit_check', loanId]);
      res.json({ success: true, creditCheck });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/loans/review/credit-check' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── Approve/reject credit check step ──
  router.post('/loans/:id/review/credit-check/complete', async (req, res) => {
    try {
      const loanId = parseInt(req.params.id);
      const { status, notes } = req.body;
      if (!['passed', 'failed'].includes(status)) return res.status(400).json({ error: 'status must be "passed" or "failed"' });
      const result = await loanReview.completeReviewStep(ctx.db, loanId, 'credit_check', status, req.user.id, notes || '');
      await audit.log({
        userId: req.user.id, action: 'admin.loan.review.credit', resourceType: 'loan_review',
        resourceId: result.step.id, metadata: { loanId, step: 'credit_check', status, notes },
        ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role,
      }).catch(() => {});
      res.json({ success: true, ...result });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/loans/review/credit-check/complete' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── Perform risk assessment ──
  router.post('/loans/:id/review/risk-assessment', async (req, res) => {
    try {
      const loanId = parseInt(req.params.id);
      const loan = await ctx.db.get('SELECT * FROM loans WHERE id = $1', [loanId]);
      if (!loan) return res.status(404).json({ error: 'Loan not found' });
      const creditCheckStep =      await ctx.db.get('SELECT * FROM loan_reviews WHERE loan_id = $1 AND step = $2', [loanId, 'credit_check']);
      const creditCheckData = creditCheckStep?.metadata
        ? (typeof creditCheckStep.metadata === 'string' ? JSON.parse(creditCheckStep.metadata) : creditCheckStep.metadata)
        : await loanReview.performCreditCheck(ctx.db, loan.borrower_id, loanId);
      const riskAssessment = await loanReview.performRiskAssessment(ctx.db, loan.borrower_id, loan, creditCheckData);
      const existing = await ctx.db.get('SELECT * FROM loan_reviews WHERE loan_id = $1 AND step = $2', [loanId, 'risk_assessment']);
      if (!existing) {
        await ctx.db.run(
          `INSERT INTO loan_reviews (loan_id, step, status, reviewer_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [loanId, 'risk_assessment', 'in_progress', req.user.id, JSON.stringify(riskAssessment)]
        );
      }
      await ctx.db.run('UPDATE loans SET status = $1 WHERE id = $2', ['risk_assessment', loanId]);
      res.json({ success: true, riskAssessment });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/loans/review/risk-assessment' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── Approve/reject risk assessment step ──
  router.post('/loans/:id/review/risk-assessment/complete', async (req, res) => {
    try {
      const loanId = parseInt(req.params.id);
      const { status, notes } = req.body;
      if (!['passed', 'failed'].includes(status)) return res.status(400).json({ error: 'status must be "passed" or "failed"' });
      const result = await loanReview.completeReviewStep(ctx.db, loanId, 'risk_assessment', status, req.user.id, notes || '');
      await audit.log({
        userId: req.user.id, action: 'admin.loan.review.risk', resourceType: 'loan_review',
        resourceId: result.step.id, metadata: { loanId, step: 'risk_assessment', status, notes },
        ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role,
      }).catch(() => {});
      res.json({ success: true, ...result });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/loans/review/risk-assessment/complete' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── Get document validation status ──
  router.get('/loans/:id/review/documents', async (req, res) => {
    try {
      const loanId = parseInt(req.params.id);
      const loan = await ctx.db.get('SELECT * FROM loans WHERE id = $1', [loanId]);
      if (!loan) return res.status(404).json({ error: 'Loan not found' });
      const docResult = await loanReview.validateDocuments(ctx.db, loan.borrower_id, loanId, Number(loan.amount));
      res.json({ success: true, ...docResult });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/loans/review/documents' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── Verify a specific document ──
  router.post('/loans/:id/review/documents/verify', async (req, res) => {
    try {
      const loanId = parseInt(req.params.id);
      const { doc_type, status, notes } = req.body;
      if (!doc_type || !['verified', 'rejected'].includes(status)) return res.status(400).json({ error: 'doc_type and status (verified/rejected) are required' });
      const existing = await ctx.db.get('SELECT * FROM loan_documents WHERE loan_id = $1 AND doc_type = $2', [loanId, doc_type]);
      if (existing) {
        await ctx.db.run('UPDATE loan_documents SET status = $1, verified_by = $2, verified_at = CURRENT_TIMESTAMP, notes = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4', [status, req.user.id, notes || null, existing.id]);
      } else {
        const loan = await ctx.db.get('SELECT * FROM loans WHERE id = $1', [loanId]);
        await ctx.db.run('INSERT INTO loan_documents (loan_id, user_id, doc_type, status, verified_by, notes) VALUES ($1, $2, $3, $4, $5, $6)', [loanId, loan.borrower_id, doc_type, status, req.user.id, notes || null]);
      }
      const allDocs = await ctx.db.all('SELECT * FROM loan_documents WHERE loan_id = $1', [loanId]);
      const allVerified = allDocs.length > 0 && allDocs.every(d => d.status === 'verified');
      if (allVerified) await loanReview.completeReviewStep(ctx.db, loanId, 'document_validation', 'passed', req.user.id, 'All documents verified');
      await audit.log({
        userId: req.user.id, action: 'admin.loan.review.document', resourceType: 'loan_document',
        resourceId: existing?.id || 'new', metadata: { loanId, doc_type, status, notes },
        ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role,
      }).catch(() => {});
      res.json({ success: true, allVerified });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/loans/review/documents/verify' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── Final loan approval (tiered) ──
  router.post('/loans/:id/review/approve', async (req, res) => {
    try {
      const loanId = parseInt(req.params.id);
      const { notes } = req.body;
      const loan = await ctx.db.get('SELECT * FROM loans WHERE id = $1', [loanId]);
      if (!loan) return res.status(404).json({ error: 'Loan not found' });
      const allSteps = await ctx.db.all('SELECT * FROM loan_reviews WHERE loan_id = $1', [loanId]);
      const requiredSteps = ['credit_check', 'risk_assessment', 'document_validation'];
      const missingSteps = requiredSteps.filter(s => !allSteps.find(st => st.step === s && st.status === 'passed'));
      if (missingSteps.length > 0) return res.status(400).json({ error: `Cannot approve — complete these steps first: ${missingSteps.join(', ')}`, missingSteps });
      const authority = await loanReview.checkApprovalAuthority(ctx.db, req.user.id, Number(loan.amount));
      if (!authority.canApprove) return res.status(403).json({ error: 'You do not have approval permission', authority });
      if (authority.needsHigherApproval) return res.status(403).json({ error: `Loan amount (₹${Number(loan.amount).toLocaleString('en-IN')}) exceeds your approval limit (₹${authority.approvalLimit.toLocaleString('en-IN')}). Requires level ${authority.requiredLevel} approval.`, authority });
      const result = await loanReview.completeReviewStep(ctx.db, loanId, 'final_approval', 'passed', req.user.id, notes || '');
      await audit.log({
        userId: req.user.id, action: 'admin.loan.approve', resourceType: 'loan', resourceId: loanId,
        metadata: { amount: loan.amount, authority: authority.roleLevel, notes },
        ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role,
      }).catch(() => {});
      res.json({ success: true, message: 'Loan approved. Ready for disbursement.', authority: { roleLevel: authority.roleLevel, title: authority.title }, ...result });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/loans/review/approve' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── Reject loan at any step ──
  router.post('/loans/:id/review/reject', async (req, res) => {
    try {
      const loanId = parseInt(req.params.id);
      const { reason, step } = req.body;
      if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });
      const currentStep = step || 'credit_check';
      await loanReview.completeReviewStep(ctx.db, loanId, currentStep, 'failed', req.user.id, reason);
      await audit.log({
        userId: req.user.id, action: 'admin.loan.reject', resourceType: 'loan', resourceId: loanId,
        metadata: { step: currentStep, reason },
        ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role,
      }).catch(() => {});
      res.json({ success: true, message: 'Loan rejected.', loanStatus: 'rejected' });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/loans/review/reject' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── List reviewers with approval limits ──
  router.get('/loan-reviewers', async (req, res) => {
    try {
      const reviewers = await loanReview.getReviewers(ctx.db);
      res.json({ reviewers });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/loan-reviewers' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── List loans with review status ──
  router.get('/loans', async (req, res) => {
    try {
      const { status } = req.query;
      const loans = await loanReview.getAdminLoans(ctx.db, status);
      res.json({ loans });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/loans' });
      res.status(500).json({ error: err.message });
    }
  });
};
