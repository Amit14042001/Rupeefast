/**
 * RupeeFast — Payment API Routes
 *
 * POST /create-plan          — Create Razorpay plan
 * POST /create-subscription  — Create subscription (mandate)
 * POST /verify               — Verify payment after checkout
 * GET  /mandates             — List user's mandates
 * POST /cancel-mandate       — Cancel a mandate
 * POST /pause-mandate        — Pause an active mandate
 * POST /resume-mandate       — Resume a paused mandate
 * GET  /transactions         — Transaction history
 */

const { validate, schemas } = require('../validation');
const sentry = require('../sentry');
const audit = require('../audit');
const razorpay = require('../integrations/razorpay');

/**
 * Register payment routes on the given Router.
 */
module.exports = function (router, ctx) {
  const { metrics, authMiddleware } = ctx;

  // 4. Create a Razorpay Plan
  router.post('/create-plan', authMiddleware, validate(schemas.createPlan), async (req, res) => {
    const { frequency, amountPaise, label } = req.body;
    try {
      const plan = await razorpay.createPlan(frequency, amountPaise, label);
      if (!plan) return res.status(503).json({ error: 'Payment gateway not configured' });
      res.json({ success: true, plan, key_id: process.env.RAZORPAY_KEY_ID || '' });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'payments/create-plan' });
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Create Subscription for mandate
  router.post('/create-subscription', authMiddleware, validate(schemas.createSubscription), audit.middleware('payment.mandate.create', 'payment_mandate'), async (req, res) => {
    const { planId, totalCycles, method, amount, frequency, loanId } = req.body;
    try {
      const subscription = await razorpay.createSubscription(
        planId, totalCycles || 100,
        { user_id: req.user.id, loan_id: loanId || '' }
      );
      if (!subscription) return res.status(503).json({ error: 'Payment gateway not configured' });

      const result = await ctx.db.run(
        `INSERT INTO payment_mandates (user_id, loan_id, razorpay_subscription_id, razorpay_plan_id, method, status, amount, frequency, total_cycles, remaining_cycles)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [req.user.id, loanId || null, subscription.id, planId, method, 'pending', amount, frequency, totalCycles || 100, totalCycles || 100]
      );
      metrics.mandatesCreated.inc(method);
      res.json({ success: true, subscription, mandate_id: result.lastID });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'payments/create-subscription' });
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Verify payment / mandate
  router.post('/verify', authMiddleware, validate(schemas.verifyPayment), audit.middleware('payment.verify', 'transaction'), async (req, res) => {
    const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature, mandate_id } = req.body;
    try {
      const isValid = razorpay.verifySubscriptionSignature(razorpay_subscription_id, razorpay_payment_id, razorpay_signature);
      if (!isValid) {
        metrics.paymentVerifications.inc('failure');
        return res.status(400).json({ error: 'Payment signature verification failed' });
      }
      if (mandate_id) {
        await ctx.db.run('UPDATE payment_mandates SET status = $1, activated_at = CURRENT_TIMESTAMP WHERE id = $2', ['active', mandate_id]);
      }
      await ctx.db.run(
        `INSERT INTO transactions (user_id, loan_id, razorpay_payment_id, razorpay_subscription_id, amount, type, status, method)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [req.user.id, null, razorpay_payment_id, razorpay_subscription_id, 0, 'repayment', 'completed', 'upi_autopay']
      );
      metrics.paymentVerifications.inc('success');
      res.json({ success: true, message: 'Mandate activated successfully' });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'payments/verify' });
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Get user's active mandates
  router.get('/mandates', authMiddleware, async (req, res) => {
    try {
      const mandates = await ctx.db.all('SELECT * FROM payment_mandates WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
      res.json({ mandates });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'payments/mandates' });
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Cancel a mandate
  router.post('/cancel-mandate', authMiddleware, validate(schemas.cancelMandate), audit.middleware('payment.mandate.cancel', 'payment_mandate'), async (req, res) => {
    const { mandate_id } = req.body;
    try {
      const mandate = await ctx.db.get('SELECT * FROM payment_mandates WHERE id = $1 AND user_id = $2', [mandate_id, req.user.id]);
      if (!mandate) return res.status(404).json({ error: 'Mandate not found' });
      if (mandate.razorpay_subscription_id) await razorpay.cancelSubscription(mandate.razorpay_subscription_id);
      await ctx.db.run('UPDATE payment_mandates SET status = $1 WHERE id = $2', ['cancelled', mandate_id]);
      metrics.mandatesCancelled.inc();
      res.json({ success: true, message: 'Mandate cancelled' });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'payments/cancel-mandate' });
      res.status(500).json({ error: err.message });
    }
  });

  // 9. Pause a mandate
  router.post('/pause-mandate', authMiddleware, validate(schemas.pauseMandate), audit.middleware('payment.mandate.pause', 'payment_mandate'), async (req, res) => {
    const { mandate_id } = req.body;
    try {
      const mandate = await ctx.db.get('SELECT * FROM payment_mandates WHERE id = $1 AND user_id = $2', [mandate_id, req.user.id]);
      if (!mandate) return res.status(404).json({ error: 'Mandate not found' });
      if (mandate.status !== 'active') return res.status(400).json({ error: 'Only active mandates can be paused' });
      if (mandate.razorpay_subscription_id) await razorpay.pauseSubscription(mandate.razorpay_subscription_id);
      await ctx.db.run('UPDATE payment_mandates SET status = $1 WHERE id = $2', ['paused', mandate_id]);
      res.json({ success: true, message: 'Mandate paused' });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'payments/pause-mandate' });
      res.status(500).json({ error: err.message });
    }
  });

  // 10. Resume a paused mandate
  router.post('/resume-mandate', authMiddleware, validate(schemas.resumeMandate), audit.middleware('payment.mandate.resume', 'payment_mandate'), async (req, res) => {
    const { mandate_id } = req.body;
    try {
      const mandate = await ctx.db.get('SELECT * FROM payment_mandates WHERE id = $1 AND user_id = $2', [mandate_id, req.user.id]);
      if (!mandate) return res.status(404).json({ error: 'Mandate not found' });
      if (mandate.status !== 'paused') return res.status(400).json({ error: 'Only paused mandates can be resumed' });
      if (mandate.razorpay_subscription_id) await razorpay.resumeSubscription(mandate.razorpay_subscription_id);
      await ctx.db.run('UPDATE payment_mandates SET status = $1 WHERE id = $2', ['active', mandate_id]);
      res.json({ success: true, message: 'Mandate resumed' });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'payments/resume-mandate' });
      res.status(500).json({ error: err.message });
    }
  });

  // 11. Get user's transaction history
  router.get('/transactions', authMiddleware, async (req, res) => {
    try {
      const transactions = await ctx.db.all('SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
      res.json({ transactions });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'payments/transactions' });
      res.status(500).json({ error: err.message });
    }
  });
};
