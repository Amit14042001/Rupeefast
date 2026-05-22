/**
 * RupeeFast — Loan API Routes
 *
 * GET  /user/:id/dashboard   — Fetch dashboard data (role-aware)
 * POST /apply                — Create loan application
 * POST /disburse             — Disburse approved loan (post-KYC)
 */

const { validate, schemas } = require('../validation');
const sentry = require('../sentry');
const audit = require('../audit');
const logger = require('../logger');

/**
 * Register loan routes on the given Router.
 */
module.exports = function (router, ctx) {
  const { redis, metrics, authMiddleware } = ctx;

  // 2. Fetch Dashboard Data (Protected)
  router.get('/user/:id/dashboard', authMiddleware, async (req, res) => {
    const userId = parseInt(req.params.id);
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    try {
      const user = await ctx.db.get('SELECT * FROM users WHERE id = $1', [userId]);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const data = { user };
      if (user.role === 'borrower') {
        data.activeLoan = await ctx.db.get('SELECT * FROM loans WHERE borrower_id = $1 AND status = $2', [userId, 'active']);
        data.recentRepayments = await ctx.db.all(
          'SELECT * FROM repayments WHERE loan_id = (SELECT id FROM loans WHERE borrower_id = $1 AND status = $2) LIMIT 5',
          [userId, 'active']
        );
      } else if (user.role === 'investor') {
        data.investments = await ctx.db.all('SELECT * FROM investments WHERE investor_id = $1', [userId]);
        data.totalEarned = 1455;
      } else if (user.role === 'agent') {
        data.tasks = await ctx.db.all('SELECT * FROM agent_tasks WHERE agent_id = $1 AND status = $2', [userId, 'pending']);
      }

      if (redis.getStatus().connected) {
        redis.setex(`dashboard:${userId}`, 300, JSON.stringify(data)).catch(() => {
          logger.warn({ userId }, 'Dashboard cache write failed');
        });
      }
      res.json(data);
    } catch (err) {
      sentry.captureError(err, { userId, route: 'user/dashboard' });
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Create Loan Application (Protected)
  router.post('/loans/apply', authMiddleware, validate(schemas.loanApply), audit.middleware('loan.apply', 'loan'), async (req, res) => {
    const { amount, plan, purpose } = req.body;
    const borrower_id = req.user.id;
    try {
      const result = await ctx.db.run(
        'INSERT INTO loans (borrower_id, amount, repayment_plan, purpose, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [borrower_id, amount, plan, purpose, 'applied']
      );
      res.json({ success: true, loan_id: result.lastID });
      metrics.loansApplied.inc();
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'loans/apply', amount, plan });
      res.status(500).json({ error: err.message });
    }
  });

  // 12. Disburse loan (post-KYC) (Protected)
  router.post('/loans/disburse', authMiddleware, validate(schemas.loanDisburse), audit.middleware('loan.disburse', 'loan'), async (req, res) => {
    const { loan_id } = req.body;
    try {
      const loan = await ctx.db.get('SELECT * FROM loans WHERE id = $1 AND borrower_id = $2', [loan_id, req.user.id]);
      if (!loan) return res.status(404).json({ error: 'Loan not found' });

      const kyc = await ctx.db.get('SELECT * FROM kyc_records WHERE user_id = $1', [req.user.id]);
      if (!kyc || kyc.status !== 'verified') {
        return res.status(400).json({ error: 'KYC verification required before disbursement' });
      }

      const creditCheck = await ctx.db.get('SELECT * FROM credit_scores WHERE user_id = $1', [req.user.id]);
      if (!creditCheck || (creditCheck.score || 0) < 300) {
        return res.status(400).json({ error: 'Minimum credit score of 300 required for disbursement' });
      }

      await ctx.db.run('UPDATE loans SET status = $1, disbursed_at = CURRENT_TIMESTAMP WHERE id = $2', ['active', loan_id]);

      const totalCycles = loan.repayment_plan === 'daily' ? 100 : loan.repayment_plan === 'weekly' ? 15 : 6;
      const emiAmount = Math.round(loan.amount * 1.2 / totalCycles);
      for (let i = 1; i <= totalCycles; i++) {
        await ctx.db.run(
            `INSERT INTO repayments (loan_id, borrower_id, amount_due, cycle_number, due_date, status)
             VALUES ($1, $2, $3, $4, CURRENT_DATE + ($5 * interval '1 day'), $6)`,
            [loan_id, req.user.id, emiAmount, i, loan.repayment_plan === 'daily' ? i : i * 7, 'pending']
          );
      }

      metrics.loansDisbursed.inc();
      res.json({ success: true, message: 'Loan disbursed', emi_count: totalCycles, emi_amount: emiAmount });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'loans/disburse' });
      res.status(500).json({ error: err.message });
    }
  });
};
